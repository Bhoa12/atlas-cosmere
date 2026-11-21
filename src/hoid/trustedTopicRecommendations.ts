import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { buildHoidCursorReadingContext } from "./cursorReadingContext";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import {
  getHoidTopicDefinition,
  getHoidTopicDimensionDefinition,
} from "./topicTaxonomy";
import type { HoidTrustedScreenAnswerPort } from "./trustedScreenAnswer";
import type { HoidTopicRecommendation } from "./topicRecommendations";
import type { HoidPresentedCitation } from "./answerPresentation";

export type HoidTrustedTopicRecommendationResult =
  | Readonly<{
      status: "ready";
      items: readonly HoidTopicRecommendation[];
      progressRevision: number;
      progressFingerprint: string;
      verifiedClaimCount: number;
    }>
  | Readonly<{
      status: "withheld";
      reason:
        | "invalid-input"
        | "invalid-progress"
        | "progress-changed"
        | "invalid-recommendations"
        | "approved-claims-unavailable"
        | "claim-presentation-withheld"
        | "invalid-claim-presentation";
    }>;

export type HoidTrustedTopicRecommendationPresenterConfig = Readonly<{
  /** Local-only loader; it must return claim records, never provider-authored prose. */
  loadApprovedClaims: (claimIds: readonly string[], progress: unknown) => unknown | Promise<unknown>;
  /** The same signed presenter used by ordinary narrative answers. */
  trustedAnswerPort: HoidTrustedScreenAnswerPort;
  /** Required durable read-through from the host-owned SQLite progress coordinator. */
  refreshCurrentProgress: () => unknown | Promise<unknown>;
}>;

export type HoidTrustedTopicRecommendationPresenter = Readonly<{
  /** Re-authenticates every distinct claim before any recommendation is returned to the UI. */
  present(input: unknown): Promise<HoidTrustedTopicRecommendationResult>;
}>;

type ProgressIdentity = Readonly<{ revision: number; fingerprint: string }>;
type CanonicalMatch = Readonly<{
  topicId: string;
  topicLabel: string;
  dimensionId: string;
  dimensionLabel: string;
  claimId: string;
  reasonText: string;
  citations: readonly HoidPresentedCitation[];
}>;
type VerifiedClaim = Readonly<{ text: string; citations: readonly HoidPresentedCitation[] }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_RECOMMENDATIONS = 10;
const MAX_MATCHES_PER_RECOMMENDATION = 16;
const MAX_TOTAL_MATCHES = 32;
const MAX_UNIQUE_CLAIMS = 20;
const MAX_TEXT_LENGTH = 4_000;
const WORKS = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work] as const));

function exactRecord(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const allowed = new Set([...requiredKeys, ...optionalKeys]);
    const keys = Reflect.ownKeys(value);
    if (keys.length < requiredKeys.length || keys.length > allowed.size) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
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
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function canonicalIds(value: unknown, maximum: number): readonly string[] | null {
  const entries = denseArray(value, 1, maximum);
  if (!entries) return null;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (typeof entry !== "string" || !ID_PATTERN.test(entry) || seen.has(entry)) return null;
    seen.add(entry);
    result.push(entry);
  }
  return Object.freeze(result);
}

function safeText(value: unknown, maximum = MAX_TEXT_LENGTH): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim() &&
    !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value);
}

function canonicalCitation(value: unknown): HoidPresentedCitation | null {
  const raw = exactRecord(value, [
    "evidenceId", "sourceBookId", "title", "chapter", "locatorId",
  ]);
  if (
    !raw ||
    typeof raw.evidenceId !== "string" ||
    !ID_PATTERN.test(raw.evidenceId) ||
    typeof raw.sourceBookId !== "string" ||
    !WORKS.has(raw.sourceBookId) ||
    raw.title !== WORKS.get(raw.sourceBookId)!.title ||
    typeof raw.chapter !== "number" ||
    !Number.isSafeInteger(raw.chapter) ||
    raw.chapter < 1 ||
    raw.chapter > 100_000_000 ||
    typeof raw.locatorId !== "string" ||
    raw.locatorId.length < 1 ||
    raw.locatorId.length > 256 ||
    /[\u0000-\u001F\u007F]/u.test(raw.locatorId)
  ) return null;
  return Object.freeze({
    evidenceId: raw.evidenceId,
    sourceBookId: raw.sourceBookId,
    title: raw.title as string,
    chapter: raw.chapter,
    locatorId: raw.locatorId,
  });
}

function canonicalCitations(value: unknown): readonly HoidPresentedCitation[] | null {
  const entries = denseArray(value, 1, 16);
  if (!entries) return null;
  const result: HoidPresentedCitation[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const citation = canonicalCitation(entry);
    if (!citation || seen.has(citation.evidenceId)) return null;
    seen.add(citation.evidenceId);
    result.push(citation);
  }
  return Object.freeze(result);
}

function sameCitation(left: HoidPresentedCitation, right: HoidPresentedCitation): boolean {
  return left.evidenceId === right.evidenceId &&
    left.sourceBookId === right.sourceBookId &&
    left.title === right.title &&
    left.chapter === right.chapter &&
    left.locatorId === right.locatorId;
}

function sameCitations(
  left: readonly HoidPresentedCitation[],
  right: readonly HoidPresentedCitation[],
): boolean {
  return left.length === right.length &&
    left.every((citation, index) => sameCitation(citation, right[index]));
}

function progressIdentity(value: unknown): ProgressIdentity | null {
  const projection = projectHoidCursorProgressSnapshot(value);
  if (projection.status !== "ready") return null;
  return Object.freeze({
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
  });
}

function sameProgress(left: ProgressIdentity, right: ProgressIdentity): boolean {
  return left.revision === right.revision && left.fingerprint === right.fingerprint;
}

function canonicalRecommendations(
  value: unknown,
  startedWorks: ReadonlySet<string>,
): Readonly<{
  items: readonly HoidTopicRecommendation[];
  claimIds: readonly string[];
}> | null {
  const entries = denseArray(value, 1, MAX_RECOMMENDATIONS);
  if (!entries) return null;
  const items: HoidTopicRecommendation[] = [];
  const claimIds = new Set<string>();
  const sourceIds = new Set<string>();
  const assignmentKeys = new Set<string>();
  let totalMatches = 0;

  for (const entry of entries) {
    const raw = exactRecord(entry, ["sourceId", "title", "reason", "matches"]);
    if (
      !raw ||
      typeof raw.sourceId !== "string" ||
      !ID_PATTERN.test(raw.sourceId) ||
      !WORKS.has(raw.sourceId) ||
      raw.title !== WORKS.get(raw.sourceId)!.title ||
      raw.reason !== "reviewed-topic-match" ||
      startedWorks.has(raw.sourceId) ||
      sourceIds.has(raw.sourceId)
    ) return null;
    sourceIds.add(raw.sourceId);

    const rawMatches = denseArray(raw.matches, 1, MAX_MATCHES_PER_RECOMMENDATION);
    if (!rawMatches) return null;
    totalMatches += rawMatches.length;
    if (totalMatches > MAX_TOTAL_MATCHES) return null;

    const matches: CanonicalMatch[] = [];
    for (const rawMatch of rawMatches) {
      const match = exactRecord(rawMatch, [
        "topicId", "topicLabel", "dimensionId", "dimensionLabel",
        "claimId", "reasonText", "citations",
      ]);
      if (
        !match ||
        typeof match.topicId !== "string" ||
        typeof match.dimensionId !== "string" ||
        typeof match.claimId !== "string" ||
        !ID_PATTERN.test(match.claimId) ||
        !safeText(match.reasonText)
      ) return null;

      const topic = getHoidTopicDefinition(match.topicId);
      const dimension = getHoidTopicDimensionDefinition(match.topicId, match.dimensionId);
      if (
        !topic ||
        !dimension ||
        match.topicLabel !== topic.label ||
        match.dimensionLabel !== dimension.label
      ) return null;

      const citations = canonicalCitations(match.citations);
      if (!citations || citations.some(citation => citation.sourceBookId === raw.sourceId)) {
        return null;
      }

      const assignmentKey = [raw.sourceId, match.topicId, match.dimensionId, match.claimId].join(":");
      if (assignmentKeys.has(assignmentKey)) return null;
      assignmentKeys.add(assignmentKey);
      claimIds.add(match.claimId);
      matches.push(Object.freeze({
        topicId: match.topicId,
        topicLabel: topic.label,
        dimensionId: match.dimensionId,
        dimensionLabel: dimension.label,
        claimId: match.claimId,
        reasonText: match.reasonText,
        citations,
      }));
    }

    items.push(Object.freeze({
      sourceId: raw.sourceId,
      title: WORKS.get(raw.sourceId)!.title,
      reason: "reviewed-topic-match",
      matches: Object.freeze(matches),
    }));
  }

  if (claimIds.size < 1 || claimIds.size > MAX_UNIQUE_CLAIMS) return null;
  return Object.freeze({
    items: Object.freeze(items),
    claimIds: Object.freeze([...claimIds].sort()),
  });
}

function canonicalAnswerRecords(
  value: unknown,
  expectedClaimIds: readonly string[],
): ReadonlyMap<string, unknown> | null {
  const entries = denseArray(value, expectedClaimIds.length, MAX_UNIQUE_CLAIMS);
  if (!entries || entries.length !== expectedClaimIds.length) return null;
  const expected = new Set(expectedClaimIds);
  const records = new Map<string, unknown>();
  for (const entry of entries) {
    const record = exactRecord(entry, ["claimId", "answer"]);
    if (
      !record ||
      typeof record.claimId !== "string" ||
      !expected.has(record.claimId) ||
      records.has(record.claimId) ||
      record.answer === null ||
      (typeof record.answer !== "object" && typeof record.answer !== "function")
    ) return null;
    records.set(record.claimId, record.answer);
  }
  return records.size === expected.size ? records : null;
}

function canonicalTrustedClaimPresentation(
  value: unknown,
  expectedClaimId: string,
): VerifiedClaim | null {
  const result = exactRecord(value, ["status", "depth", "metrics", "presentation"]);
  if (!result || result.status !== "ready" || result.depth !== "brief") return null;

  const presentation = exactRecord(result.presentation, [
    "status", "text", "claimIds", "evidenceIds", "citations", "layout", "segments",
  ]);
  if (
    !presentation ||
    presentation.status !== "ready" ||
    !safeText(presentation.text, 6_000) ||
    (presentation.layout !== "plain" && presentation.layout !== "numbered" && presentation.layout !== "grouped")
  ) return null;

  const claimIds = canonicalIds(presentation.claimIds, 3);
  const evidenceIds = canonicalIds(presentation.evidenceIds, 4);
  const citations = canonicalCitations(presentation.citations);
  const segments = denseArray(presentation.segments, 1, 1);
  if (
    !claimIds ||
    claimIds.length !== 1 ||
    claimIds[0] !== expectedClaimId ||
    !evidenceIds ||
    !citations ||
    !segments
  ) return null;

  const segment = exactRecord(segments[0], ["claimId", "text", "evidenceIds", "citations"]);
  if (!segment || segment.claimId !== expectedClaimId || !safeText(segment.text)) return null;
  const segmentEvidenceIds = canonicalIds(segment.evidenceIds, 4);
  const segmentCitations = canonicalCitations(segment.citations);
  if (
    !segmentEvidenceIds ||
    !segmentCitations ||
    segmentEvidenceIds.length !== evidenceIds.length ||
    segmentEvidenceIds.some((id, index) => id !== evidenceIds[index]) ||
    !sameCitations(citations, segmentCitations) ||
    segmentEvidenceIds.length !== segmentCitations.length ||
    segmentEvidenceIds.some((id, index) => id !== segmentCitations[index].evidenceId)
  ) return null;

  const metrics = exactRecord(result.metrics, [
    "claimCount", "evidenceCount", "workCount", "characterCount",
  ]);
  const workCount = new Set(citations.map(citation => citation.sourceBookId)).size;
  if (
    !metrics ||
    metrics.claimCount !== 1 ||
    metrics.evidenceCount !== evidenceIds.length ||
    metrics.workCount !== workCount ||
    metrics.characterCount !== presentation.text.length
  ) return null;

  return Object.freeze({
    text: segment.text,
    citations: segmentCitations,
  });
}

async function readProgress(refresh: () => unknown | Promise<unknown>): Promise<unknown | null> {
  try {
    return await refresh();
  } catch {
    return null;
  }
}

function withheld(
  reason: Extract<HoidTrustedTopicRecommendationResult, { status: "withheld" }>["reason"],
): HoidTrustedTopicRecommendationResult {
  return Object.freeze({ status: "withheld", reason });
}

export function createHoidTrustedTopicRecommendationPresenter(
  configInput: unknown,
): HoidTrustedTopicRecommendationPresenter | null {
  const config = exactRecord(configInput, [
    "loadApprovedClaims", "trustedAnswerPort", "refreshCurrentProgress",
  ]);
  if (
    !config ||
    typeof config.loadApprovedClaims !== "function" ||
    typeof config.refreshCurrentProgress !== "function"
  ) return null;

  let presentDescriptor: PropertyDescriptor | undefined;
  try {
    presentDescriptor = config.trustedAnswerPort !== null &&
      typeof config.trustedAnswerPort === "object"
      ? Object.getOwnPropertyDescriptor(config.trustedAnswerPort, "present")
      : undefined;
  } catch {
    return null;
  }
  if (
    !presentDescriptor ||
    !Object.prototype.hasOwnProperty.call(presentDescriptor, "value") ||
    typeof presentDescriptor.value !== "function"
  ) return null;

  const loadApprovedClaims = config.loadApprovedClaims as (
    claimIds: readonly string[],
    progress: unknown,
  ) => unknown | Promise<unknown>;
  const refreshCurrentProgress = config.refreshCurrentProgress as () => unknown | Promise<unknown>;
  const presentClaim = (presentDescriptor.value as HoidTrustedScreenAnswerPort["present"])
    .bind(config.trustedAnswerPort);

  return Object.freeze({
    async present(input: unknown): Promise<HoidTrustedTopicRecommendationResult> {
      const request = exactRecord(input, [
        "items", "progress", "progressRevision", "progressFingerprint",
      ]);
      if (
        !request ||
        typeof request.progressRevision !== "number" ||
        !Number.isSafeInteger(request.progressRevision) ||
        request.progressRevision < 0 ||
        typeof request.progressFingerprint !== "string" ||
        !SHA_PATTERN.test(request.progressFingerprint)
      ) return withheld("invalid-input");

      const requestedProgress = progressIdentity(request.progress);
      if (
        !requestedProgress ||
        requestedProgress.revision !== request.progressRevision ||
        requestedProgress.fingerprint !== request.progressFingerprint
      ) return withheld("invalid-progress");

      const reading = buildHoidCursorReadingContext(request.progress);
      if (reading.status !== "ready") return withheld("invalid-progress");
      const startedWorks = new Set(reading.context.positions.map(position => position.bookId));
      const recommendations = canonicalRecommendations(request.items, startedWorks);
      if (!recommendations) return withheld("invalid-recommendations");

      const currentBefore = await readProgress(refreshCurrentProgress);
      const beforeIdentity = currentBefore === null ? null : progressIdentity(currentBefore);
      if (!beforeIdentity) return withheld("invalid-progress");
      if (!sameProgress(requestedProgress, beforeIdentity)) return withheld("progress-changed");

      let rawRecords: unknown;
      try {
        rawRecords = await loadApprovedClaims(recommendations.claimIds, request.progress);
      } catch {
        return withheld("approved-claims-unavailable");
      }
      const records = canonicalAnswerRecords(rawRecords, recommendations.claimIds);
      if (!records) return withheld("approved-claims-unavailable");

      const requestAfterLoad = progressIdentity(request.progress);
      if (!requestAfterLoad || !sameProgress(requestedProgress, requestAfterLoad)) {
        return withheld("progress-changed");
      }

      const verifiedClaims = new Map<string, VerifiedClaim>();
      for (const claimId of recommendations.claimIds) {
        let rawResult: unknown;
        try {
          rawResult = await presentClaim(records.get(claimId), "brief");
        } catch {
          return withheld("claim-presentation-withheld");
        }
        let resultStatus: unknown;
        try {
          if (rawResult !== null && typeof rawResult === "object" && !Array.isArray(rawResult)) {
            const statusDescriptor = Object.getOwnPropertyDescriptor(rawResult, "status");
            if (statusDescriptor && Object.prototype.hasOwnProperty.call(statusDescriptor, "value")) {
              resultStatus = statusDescriptor.value;
            }
          }
        } catch {
          return withheld("invalid-claim-presentation");
        }
        if (resultStatus === "withheld") return withheld("claim-presentation-withheld");
        const verified = canonicalTrustedClaimPresentation(rawResult, claimId);
        if (!verified) return withheld("invalid-claim-presentation");
        verifiedClaims.set(claimId, verified);
      }

      const items: HoidTopicRecommendation[] = [];
      for (const item of recommendations.items) {
        const matches: CanonicalMatch[] = [];
        for (const match of item.matches) {
          const verified = verifiedClaims.get(match.claimId);
          if (
            !verified ||
            match.reasonText !== verified.text ||
            !sameCitations(match.citations, verified.citations)
          ) return withheld("invalid-claim-presentation");
          matches.push(Object.freeze({
            ...match,
            reasonText: verified.text,
            citations: verified.citations,
          }));
        }
        items.push(Object.freeze({
          sourceId: item.sourceId,
          title: item.title,
          reason: "reviewed-topic-match",
          matches: Object.freeze(matches),
        }));
      }

      const requestAfter = progressIdentity(request.progress);
      if (!requestAfter || !sameProgress(requestedProgress, requestAfter)) {
        return withheld("progress-changed");
      }
      const currentAfter = await readProgress(refreshCurrentProgress);
      const afterIdentity = currentAfter === null ? null : progressIdentity(currentAfter);
      if (!afterIdentity) return withheld("invalid-progress");
      if (!sameProgress(requestedProgress, afterIdentity)) return withheld("progress-changed");

      return Object.freeze({
        status: "ready",
        items: Object.freeze(items),
        progressRevision: requestedProgress.revision,
        progressFingerprint: requestedProgress.fingerprint,
        verifiedClaimCount: verifiedClaims.size,
      });
    },
  });
}
