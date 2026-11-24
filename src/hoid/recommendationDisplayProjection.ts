import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { validateHoidReadingCursor } from "./readingManifest";
import {
  getHoidTopicDefinition,
  getHoidTopicDimensionDefinition,
} from "./topicTaxonomy";

export type HoidRecommendationNavigationAvailability =
  | "catalog-only"
  | "cursor-only"
  | "verified";

export type HoidEditionRecommendationDisplayItem = Readonly<{
  sourceId: string;
  title: string;
  heading: string;
  detail: string;
  navigation: HoidRecommendationNavigationAvailability;
}>;

export type HoidEditionRecommendationDisplayChoice = Readonly<{
  sourceId: string;
  title: string;
  currentChapter: number;
  detail: string;
}>;

export type HoidEditionRecommendationDisplayProjection =
  | Readonly<{
      status: "ready";
      items: readonly HoidEditionRecommendationDisplayItem[];
    }>
  | Readonly<{
      status: "selection-required";
      heading: string;
      detail: string;
      choices: readonly HoidEditionRecommendationDisplayChoice[];
    }>;

export type HoidTopicRecommendationDisplayCitation = Readonly<{
  sourceBookId: string;
  title: string;
  chapter: number;
}>;

export type HoidTopicRecommendationDisplayMatch = Readonly<{
  key: string;
  topicLabel: string;
  dimensionLabel: string;
  reasonText: string;
  citations: readonly HoidTopicRecommendationDisplayCitation[];
}>;

export type HoidTopicRecommendationDisplayItem = Readonly<{
  sourceId: string;
  title: string;
  matches: readonly HoidTopicRecommendationDisplayMatch[];
}>;

const WORKS = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work]));
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_RECOMMENDATIONS = HOID_SOURCE_BIBLIOGRAPHY.length;
const MAX_TOPIC_MATCHES = 32;
const MAX_CITATIONS = 16;

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = allowedKeys,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const record = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }
    for (const key of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) return null;
    }
    return record;
  } catch {
    return null;
  }
}

function hasExactKeys(
  record: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  return Object.keys(record).length === expectedKeys.length &&
    expectedKeys.every(key => Object.prototype.hasOwnProperty.call(record, key));
}

function canonicalDenseArray(
  value: unknown,
  minimum: number,
  maximum: number,
): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < minimum ||
      value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (
        typeof key !== "string" ||
        !/^(0|[1-9][0-9]*)$/u.test(key) ||
        Number(key) >= value.length
      ) return null;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function safeText(value: unknown, maximum = 6_000): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim() &&
    !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value);
}

function canonicalNavigationAvailability(
  value: unknown,
  sourceId: string,
  recommendationReason: unknown,
): HoidRecommendationNavigationAvailability | null {
  const record = canonicalRecord(
    value,
    ["kind", "reason", "cursor", "editionId", "navigationSha256", "locatorStatus", "locatorId"],
    ["kind"],
  );
  if (!record) return null;

  if (record.kind === "catalog-only") {
    if (
      !hasExactKeys(record, ["kind", "reason"]) ||
      (record.reason !== "segmentation-unverified" && record.reason !== "unit-not-found")
    ) return null;
    return "catalog-only";
  }

  if (record.kind !== "edition-cursor") return null;
  const hasLocator = Object.prototype.hasOwnProperty.call(record, "locatorId");
  const expectedKeys = hasLocator
    ? ["kind", "cursor", "editionId", "navigationSha256", "locatorStatus", "locatorId"]
    : ["kind", "cursor", "editionId", "navigationSha256", "locatorStatus"];
  if (!hasExactKeys(record, expectedKeys)) return null;

  const cursorValidation = validateHoidReadingCursor(record.cursor);
  if (cursorValidation.status !== "valid") return null;
  const cursor = cursorValidation.cursor;
  const manifest = cursorValidation.manifest;
  if (
    cursor.bookId !== sourceId ||
    record.editionId !== manifest.editionId ||
    record.navigationSha256 !== manifest.navigationSha256
  ) return null;

  const unit = manifest.units.find(candidate =>
    candidate.id === cursor.unitId &&
    candidate.ordinal === cursor.ordinal &&
    candidate.chapterNumber === cursor.chapterNumber
  );
  if (!unit) return null;

  if (unit.locatorId) {
    if (
      !hasLocator ||
      record.locatorStatus !== "verified" ||
      record.locatorId !== unit.locatorId ||
      typeof record.locatorId !== "string"
    ) return null;
    return "verified";
  }

  if (hasLocator || record.locatorStatus !== "cursor-only") return null;
  if (recommendationReason !== "resume-current-work" && cursor.chapterNumber !== 1) {
    return null;
  }
  return "cursor-only";
}

/**
 * Convert a trusted, progress-bound edition recommendation into the exact
 * metadata needed by the UI. Navigation cursors, edition hashes, EPUB locator
 * IDs and progress fingerprints are deliberately not returned.
 *
 * HoidScreen retains the original trusted presentation only in a private ref
 * for a later, independently revalidated navigation handoff.
 */
export function projectHoidEditionRecommendationsForDisplay(
  value: unknown,
): HoidEditionRecommendationDisplayProjection | null {
  const record = canonicalRecord(
    value,
    ["status", "progressRevision", "items", "choices", "heading", "detail", "progressFingerprint"],
    ["status", "progressRevision", "progressFingerprint"],
  );
  if (
    !record ||
    !Number.isSafeInteger(record.progressRevision) ||
    (record.progressRevision as number) < 0 ||
    typeof record.progressFingerprint !== "string" ||
    !SHA256_PATTERN.test(record.progressFingerprint)
  ) return null;

  if (record.status === "ready") {
    if (
      !hasExactKeys(record, ["status", "progressRevision", "items", "progressFingerprint"])
    ) return null;
    const rawItems = canonicalDenseArray(record.items, 0, MAX_RECOMMENDATIONS);
    if (!rawItems) return null;

    const seen = new Set<string>();
    const items: HoidEditionRecommendationDisplayItem[] = [];
    for (const rawItem of rawItems) {
      const item = canonicalRecord(rawItem, [
        "sourceId", "title", "reason", "explanationCode", "heading", "detail", "target",
      ]);
      if (
        !item ||
        typeof item.sourceId !== "string" ||
        !ID_PATTERN.test(item.sourceId) ||
        seen.has(item.sourceId) ||
        typeof item.title !== "string" ||
        WORKS.get(item.sourceId)?.title !== item.title ||
        (item.reason !== "resume-current-work" && item.reason !== "unread-source") ||
        ![
          "resume-current-cursor",
          "start-first-numbered-chapter",
          "catalog-only-unsegmented",
          "catalog-only-unit-missing",
        ].includes(String(item.explanationCode)) ||
        !safeText(item.heading, 512) ||
        !safeText(item.detail, 2_000)
      ) return null;

      const navigation = canonicalNavigationAvailability(
        item.target,
        item.sourceId,
        item.reason,
      );
      if (!navigation) return null;
      seen.add(item.sourceId);
      items.push(Object.freeze({
        sourceId: item.sourceId,
        title: item.title,
        heading: item.heading,
        detail: item.detail,
        navigation,
      }));
    }

    return Object.freeze({
      status: "ready",
      items: Object.freeze(items),
    });
  }

  if (record.status === "selection-required") {
    if (!hasExactKeys(record, [
      "status", "progressRevision", "heading", "detail", "choices", "progressFingerprint",
    ])) return null;
    if (!safeText(record.heading, 512) || !safeText(record.detail, 2_000)) return null;
    const rawChoices = canonicalDenseArray(record.choices, 2, MAX_RECOMMENDATIONS);
    if (!rawChoices) return null;

    const seen = new Set<string>();
    const choices: HoidEditionRecommendationDisplayChoice[] = [];
    for (const rawChoice of rawChoices) {
      const choice = canonicalRecord(rawChoice, [
        "sourceId", "title", "currentChapter", "completedThroughChapter", "detail",
      ]);
      if (
        !choice ||
        typeof choice.sourceId !== "string" ||
        !ID_PATTERN.test(choice.sourceId) ||
        seen.has(choice.sourceId) ||
        typeof choice.title !== "string" ||
        WORKS.get(choice.sourceId)?.title !== choice.title ||
        !Number.isSafeInteger(choice.currentChapter) ||
        (choice.currentChapter as number) < 1 ||
        !(
          choice.completedThroughChapter === null ||
          (Number.isSafeInteger(choice.completedThroughChapter) &&
            (choice.completedThroughChapter as number) >= 1 &&
            (choice.completedThroughChapter as number) < (choice.currentChapter as number))
        ) ||
        !safeText(choice.detail, 2_000)
      ) return null;
      seen.add(choice.sourceId);
      choices.push(Object.freeze({
        sourceId: choice.sourceId,
        title: choice.title,
        currentChapter: choice.currentChapter as number,
        detail: choice.detail,
      }));
    }

    return Object.freeze({
      status: "selection-required",
      heading: record.heading,
      detail: record.detail,
      choices: Object.freeze(choices),
    });
  }

  return null;
}

function canonicalTopicCitation(
  value: unknown,
  recommendedSourceId: string,
): Readonly<{
  evidenceId: string;
  display: HoidTopicRecommendationDisplayCitation;
}> | null {
  const citation = canonicalRecord(value, [
    "evidenceId", "sourceBookId", "title", "chapter", "locatorId",
  ]);
  if (
    !citation ||
    typeof citation.evidenceId !== "string" ||
    !ID_PATTERN.test(citation.evidenceId) ||
    typeof citation.sourceBookId !== "string" ||
    citation.sourceBookId === recommendedSourceId ||
    typeof citation.title !== "string" ||
    WORKS.get(citation.sourceBookId)?.title !== citation.title ||
    !Number.isSafeInteger(citation.chapter) ||
    (citation.chapter as number) < 1 ||
    typeof citation.locatorId !== "string" ||
    citation.locatorId.length < 1 ||
    citation.locatorId.length > 256 ||
    /[\u0000-\u001F\u007F]/u.test(citation.locatorId)
  ) return null;

  return Object.freeze({
    evidenceId: citation.evidenceId,
    display: Object.freeze({
      sourceBookId: citation.sourceBookId,
      title: citation.title,
      chapter: citation.chapter as number,
    }),
  });
}

/**
 * Strip claim IDs, evidence IDs and EPUB locator IDs from already trusted
 * thematic recommendations before they enter React state. Every citation is
 * rebuilt from the canonical bibliography and retains only work/title/chapter.
 */
export function projectHoidTopicRecommendationsForDisplay(
  value: unknown,
): readonly HoidTopicRecommendationDisplayItem[] | null {
  const rawItems = canonicalDenseArray(value, 0, MAX_RECOMMENDATIONS);
  if (!rawItems) return null;

  const seenSources = new Set<string>();
  const items: HoidTopicRecommendationDisplayItem[] = [];
  for (const rawItem of rawItems) {
    const item = canonicalRecord(rawItem, ["sourceId", "title", "reason", "matches"]);
    if (
      !item ||
      typeof item.sourceId !== "string" ||
      !ID_PATTERN.test(item.sourceId) ||
      seenSources.has(item.sourceId) ||
      typeof item.title !== "string" ||
      WORKS.get(item.sourceId)?.title !== item.title ||
      item.reason !== "reviewed-topic-match"
    ) return null;

    const rawMatches = canonicalDenseArray(item.matches, 1, MAX_TOPIC_MATCHES);
    if (!rawMatches) return null;
    const seenClaims = new Set<string>();
    const matches: HoidTopicRecommendationDisplayMatch[] = [];
    for (let index = 0; index < rawMatches.length; index += 1) {
      const match = canonicalRecord(rawMatches[index], [
        "topicId", "topicLabel", "dimensionId", "dimensionLabel", "claimId", "reasonText", "citations",
      ]);
      if (
        !match ||
        typeof match.topicId !== "string" ||
        typeof match.dimensionId !== "string" ||
        typeof match.claimId !== "string" ||
        !ID_PATTERN.test(match.claimId) ||
        seenClaims.has(match.claimId) ||
        !safeText(match.reasonText, 4_000)
      ) return null;

      const topic = getHoidTopicDefinition(match.topicId);
      const dimension = getHoidTopicDimensionDefinition(match.topicId, match.dimensionId);
      if (
        !topic ||
        !dimension ||
        match.topicLabel !== topic.label ||
        match.dimensionLabel !== dimension.label
      ) return null;

      const rawCitations = canonicalDenseArray(match.citations, 1, MAX_CITATIONS);
      if (!rawCitations) return null;
      const citations: HoidTopicRecommendationDisplayCitation[] = [];
      const seenEvidence = new Set<string>();
      for (const rawCitation of rawCitations) {
        const citation = canonicalTopicCitation(rawCitation, item.sourceId);
        if (!citation || seenEvidence.has(citation.evidenceId)) return null;
        seenEvidence.add(citation.evidenceId);
        citations.push(citation.display);
      }

      seenClaims.add(match.claimId);
      matches.push(Object.freeze({
        key: item.sourceId + ":" + match.topicId + ":" + match.dimensionId + ":" + String(index),
        topicLabel: topic.label,
        dimensionLabel: dimension.label,
        reasonText: match.reasonText,
        citations: Object.freeze(citations),
      }));
    }

    seenSources.add(item.sourceId);
    items.push(Object.freeze({
      sourceId: item.sourceId,
      title: item.title,
      matches: Object.freeze(matches),
    }));
  }

  return Object.freeze(items);
}
