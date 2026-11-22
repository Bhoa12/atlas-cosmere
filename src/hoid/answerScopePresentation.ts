import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { composeHoidNarrative, HOID_NARRATIVE_LAYOUTS } from "./narrativeComposition";
import {
  canonicalizeHoidAnswerBookScope,
  selectedEvidenceSatisfiesHoidBookScope,
  type HoidAnswerBookScope,
} from "./answerScope";

/**
 * Result of binding a trusted, already-renderable answer presentation to the
 * exact work set selected by the reader. This is a presentation consistency
 * check, not a progress grant; the trusted presenter remains authoritative
 * for per-book chapter unlocks.
 */
export type HoidPresentedAnswerScopeResult =
  | Readonly<{ status: "ready"; sourceBookIds: readonly string[] }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-presentation" | "invalid-scope" | "scope-mismatch";
    }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const TITLES = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title] as const));
const WORK_ORDER = new Map(HOID_SOURCE_BIBLIOGRAPHY.map((work, index) => [work.id, index] as const));

function exactDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
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

function denseIds(value: unknown, maximum: number): readonly string[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < 1 ||
      value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string" ||
        descriptor.value.length > 128 ||
        !ID_PATTERN.test(descriptor.value) ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      result.push(descriptor.value);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

type CitationIdentity = Readonly<{
  evidenceId: string;
  sourceBookId: string;
  title: string;
  chapter: number;
  locatorId: string;
}>;

function canonicalCitationIdentity(value: unknown): CitationIdentity | null {
  const record = exactDataRecord(
    value,
    ["evidenceId", "sourceBookId", "title", "chapter", "locatorId"],
    ["evidenceId", "sourceBookId", "title", "chapter", "locatorId"],
  );
  if (
    !record ||
    typeof record.evidenceId !== "string" ||
    record.evidenceId.length > 128 ||
    !ID_PATTERN.test(record.evidenceId) ||
    typeof record.sourceBookId !== "string" ||
    !TITLES.has(record.sourceBookId) ||
    record.title !== TITLES.get(record.sourceBookId) ||
    typeof record.chapter !== "number" ||
    !Number.isSafeInteger(record.chapter) ||
    record.chapter < 1 ||
    typeof record.locatorId !== "string" ||
    record.locatorId.length < 1 ||
    record.locatorId.length > 256 ||
    Array.from(record.locatorId).some(character => {
      const code = character.charCodeAt(0);
      return code <= 0x1f || code === 0x7f;
    })
  ) return null;

  return Object.freeze({
    evidenceId: record.evidenceId,
    sourceBookId: record.sourceBookId,
    title: record.title as string,
    chapter: record.chapter,
    locatorId: record.locatorId,
  });
}

function denseCitationIdentities(value: unknown): readonly CitationIdentity[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < 1 ||
      value.length > 16 ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: CitationIdentity[] = [];
    const seenEvidence = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      const citation = canonicalCitationIdentity(descriptor.value);
      if (!citation || seenEvidence.has(citation.evidenceId)) return null;
      seenEvidence.add(citation.evidenceId);
      result.push(citation);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function sameCitation(left: CitationIdentity, right: CitationIdentity): boolean {
  return left.evidenceId === right.evidenceId &&
    left.sourceBookId === right.sourceBookId &&
    left.title === right.title &&
    left.chapter === right.chapter &&
    left.locatorId === right.locatorId;
}

/**
 * Check the claim-to-evidence mapping whenever a segmented presentation is
 * supplied. This is defense in depth: a segment cannot introduce a citation
 * absent from the canonical top-level citation set, change its chapter or
 * locator, or leave top-level evidence unattached to any displayed claim.
 */
function segmentProvenanceMatches(
  value: unknown,
  claimIds: readonly string[],
  evidenceIds: readonly string[],
  citations: readonly CitationIdentity[],
  layout: unknown,
  expectedText: string,
): boolean {
  try {
    if (
      !Array.isArray(value) ||
      value.length !== claimIds.length ||
      value.length < 1 ||
      value.length > 12 ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return false;

    const citationsById = new Map(citations.map(citation => [citation.evidenceId, citation]));
    const referencedEvidence = new Set<string>();
    const compositionSegments: { claimId: string; text: string; evidenceIds: readonly string[] }[] = [];

    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return false;

      const segment = exactDataRecord(
        descriptor.value,
        ["claimId", "text", "evidenceIds", "citations"],
        ["claimId", "text", "evidenceIds", "citations"],
      );
      if (
        !segment ||
        typeof segment.claimId !== "string" ||
        segment.claimId !== claimIds[index] ||
        typeof segment.text !== "string" ||
        segment.text.length < 1 ||
        segment.text.length > 4_000 ||
        segment.text !== segment.text.trim()
      ) return false;

      const segmentEvidenceIds = denseIds(segment.evidenceIds, 16);
      const segmentCitations = denseCitationIdentities(segment.citations);
      if (
        !segmentEvidenceIds ||
        !segmentCitations ||
        segmentEvidenceIds.length !== segmentCitations.length
      ) return false;

      const segmentEvidenceSet = new Set(segmentEvidenceIds);
      for (const citation of segmentCitations) {
        const globalCitation = citationsById.get(citation.evidenceId);
        if (
          !segmentEvidenceSet.has(citation.evidenceId) ||
          !globalCitation ||
          !sameCitation(citation, globalCitation)
        ) return false;
        referencedEvidence.add(citation.evidenceId);
      }

      if (segmentEvidenceIds.some(id => !segmentCitations.some(citation => citation.evidenceId === id))) {
        return false;
      }
      compositionSegments.push(Object.freeze({
        claimId: segment.claimId,
        text: segment.text,
        evidenceIds: segmentEvidenceIds,
      }));
    }

    if (
      referencedEvidence.size !== evidenceIds.length ||
      !evidenceIds.every(id => referencedEvidence.has(id)) ||
      typeof layout !== "string" ||
      !(HOID_NARRATIVE_LAYOUTS as readonly string[]).includes(layout)
    ) return false;

    const composition = composeHoidNarrative({ segments: compositionSegments }, layout);
    return composition.status === "ready" && composition.text === expectedText;
  } catch {
    return false;
  }
}

/**
 * Verify that every displayed citation belongs to exactly the selected work
 * set. The caller must first obtain the presentation from the trusted screen
 * presenter, which independently rechecks evidence unlocks against live
 * progress. This function never reads EPUB content or modifies progress.
 */
export function validateHoidPresentedAnswerScope(
  presentationInput: unknown,
  scopeInput?: unknown,
): HoidPresentedAnswerScopeResult {
  const scope: HoidAnswerBookScope | undefined = scopeInput === undefined
    ? undefined
    : canonicalizeHoidAnswerBookScope(scopeInput) ?? undefined;
  if (scopeInput !== undefined && !scope) {
    return Object.freeze({ status: "unavailable", reason: "invalid-scope" });
  }

  const presentation = exactDataRecord(
    presentationInput,
    ["status", "text", "claimIds", "evidenceIds", "citations", "layout", "segments"],
    ["status", "text", "claimIds", "evidenceIds", "citations"],
  );
  if (
    !presentation ||
    presentation.status !== "ready" ||
    typeof presentation.text !== "string" ||
    presentation.text.length < 1 ||
    presentation.text.length > 32_000 ||
    presentation.text !== presentation.text.trim()
  ) return Object.freeze({ status: "unavailable", reason: "invalid-presentation" });

  const hasLayout = Object.prototype.hasOwnProperty.call(presentation, "layout");
  const hasSegments = Object.prototype.hasOwnProperty.call(presentation, "segments");
  if (hasLayout !== hasSegments) {
    return Object.freeze({ status: "unavailable", reason: "invalid-presentation" });
  }

  const claimIds = denseIds(presentation.claimIds, 12);
  const evidenceIds = denseIds(presentation.evidenceIds, 16);
  const citations = denseCitationIdentities(presentation.citations);
  if (
    !claimIds ||
    !evidenceIds ||
    !citations ||
    evidenceIds.length !== citations.length ||
    evidenceIds.some(id => !citations.some(citation => citation.evidenceId === id))
  ) return Object.freeze({ status: "unavailable", reason: "invalid-presentation" });

  if (
    hasLayout &&
    !segmentProvenanceMatches(
      presentation.segments,
      claimIds,
      evidenceIds,
      citations,
      presentation.layout,
      presentation.text,
    )
  ) {
    return Object.freeze({ status: "unavailable", reason: "invalid-presentation" });
  }

  const sourceBookIds = [...new Set(citations.map(citation => citation.sourceBookId))]
    .sort((left, right) => WORK_ORDER.get(left)! - WORK_ORDER.get(right)!);
  if (sourceBookIds.length === 0) {
    return Object.freeze({ status: "unavailable", reason: "invalid-presentation" });
  }

  if (scope && !selectedEvidenceSatisfiesHoidBookScope(sourceBookIds, scope)) {
    return Object.freeze({ status: "unavailable", reason: "scope-mismatch" });
  }

  return Object.freeze({
    status: "ready",
    sourceBookIds: Object.freeze(sourceBookIds),
  });
}
