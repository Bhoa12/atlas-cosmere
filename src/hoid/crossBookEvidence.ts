import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  presentHoidEvidenceAnswer,
  type HoidPresentedCitation,
  type HoidPresentedSegment,
} from "./answerPresentation";
import { canonicalEvidenceScope } from "./evidenceScope";
import {
  composeHoidNarrative,
  HOID_NARRATIVE_LAYOUTS,
  type HoidNarrativeLayout,
} from "./narrativeComposition";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";

export type HoidCrossBookWorkEvidence = Readonly<{
  sourceBookId: string;
  title: string;
  chapters: readonly number[];
  evidenceIds: readonly string[];
}>;

/** Exact work/chapter trace for one claim segment. */
export type HoidCrossBookSegmentWorkEvidence = Readonly<{
  sourceBookId: string;
  title: string;
  chapters: readonly number[];
  evidenceIds: readonly string[];
}>;

export type HoidCrossBookSegmentEvidence = Readonly<{
  claimId: string;
  /** Bibliography-ordered IDs retained for existing consumers. */
  sourceBookIds: readonly string[];
  /** Exact chapter/evidence grouping for this claim, not the whole answer. */
  works: readonly HoidCrossBookSegmentWorkEvidence[];
}>;

export type HoidCrossBookEvidenceSummary = Readonly<{
  workCount: number;
  works: readonly HoidCrossBookWorkEvidence[];
  segments: readonly HoidCrossBookSegmentEvidence[];
}>;

export type HoidCrossBookEvidenceResult =
  | Readonly<{ status: "ready"; summary: HoidCrossBookEvidenceSummary }>
  | Readonly<{ status: "not-cross-book" }>
  | Readonly<{
      status: "unavailable";
      reason: "answer-not-authorized" | "segment-provenance-required" | "invalid-provenance";
    }>;

const WORK_ORDER = new Map(HOID_SOURCE_BIBLIOGRAPHY.map((work, index) => [work.id, index]));
const WORK_TITLES = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title]));
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const PRESENTATION_KEYS = ["status", "text", "claimIds", "evidenceIds", "citations", "layout", "segments"] as const;
const CITATION_KEYS = ["evidenceId", "sourceBookId", "title", "chapter", "locatorId"] as const;
const SEGMENT_KEYS = ["claimId", "text", "evidenceIds", "citations"] as const;
const MAX_CLAIMS = 12;
const MAX_EVIDENCE = 16;
const MAX_CLAIM_TEXT = 4_000;
const MAX_TOTAL_TEXT = 32_000;

type CanonicalCrossBookPresentation = Readonly<{
  text: string;
  claimIds: readonly string[];
  evidenceIds: readonly string[];
  citations: readonly HoidPresentedCitation[];
  layout: HoidNarrativeLayout;
  segments: readonly HoidPresentedSegment[];
}>;

type CanonicalizationResult =
  | Readonly<{ status: "ready"; presentation: CanonicalCrossBookPresentation }>
  | Readonly<{ status: "missing-segments" }>
  | Readonly<{ status: "invalid" }>;

function dataRecord(
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

function exactDataRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  const record = dataRecord(value, keys, keys);
  return record && Object.keys(record).length === keys.length ? record : null;
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
    for (const key of keys) {
      if (key === "length") continue;
      if (
        typeof key !== "string" ||
        !/^(0|[1-9][0-9]*)$/u.test(key) ||
        Number(key) >= value.length
      ) return null;
    }

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
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function canonicalIds(value: unknown, minimum: number, maximum: number): readonly string[] | null {
  const raw = denseArray(value, minimum, maximum);
  if (!raw) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (
      typeof item !== "string" ||
      item !== item.trim() ||
      item.length < 1 ||
      item.length > 128 ||
      !ID_PATTERN.test(item) ||
      seen.has(item)
    ) return null;
    seen.add(item);
    ids.push(item);
  }
  return Object.freeze(ids);
}

function canonicalCitation(value: unknown): HoidPresentedCitation | null {
  const record = exactDataRecord(value, CITATION_KEYS);
  if (!record) return null;

  const evidenceId = record.evidenceId;
  const sourceBookId = record.sourceBookId;
  const title = record.title;
  const chapter = record.chapter;
  const locatorId = record.locatorId;
  if (
    typeof evidenceId !== "string" ||
    evidenceId.length > 128 ||
    !ID_PATTERN.test(evidenceId) ||
    typeof sourceBookId !== "string" ||
    !WORK_TITLES.has(sourceBookId) ||
    typeof title !== "string" ||
    title !== WORK_TITLES.get(sourceBookId) ||
    typeof chapter !== "number" ||
    !Number.isSafeInteger(chapter) ||
    chapter < 1 ||
    typeof locatorId !== "string" ||
    locatorId.length < 1 ||
    locatorId.length > 256
  ) return null;

  // A chapter number alone is not a locator. Rebind it to the exact inspected
  // unit in the current edition manifest before using it in a visible matrix.
  const scope = canonicalEvidenceScope(
    { bookId: sourceBookId, chapter, locatorId },
    { bookId: sourceBookId, chapter },
  );
  if (!scope || scope.locatorId !== locatorId) return null;

  return Object.freeze({ evidenceId, sourceBookId, title, chapter, locatorId });
}

function canonicalCitations(value: unknown, minimum: number, maximum: number): readonly HoidPresentedCitation[] | null {
  const raw = denseArray(value, minimum, maximum);
  if (!raw) return null;
  const citations: HoidPresentedCitation[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const citation = canonicalCitation(item);
    if (!citation || seen.has(citation.evidenceId)) return null;
    seen.add(citation.evidenceId);
    citations.push(citation);
  }
  return Object.freeze(citations);
}

function sameCitation(left: HoidPresentedCitation, right: HoidPresentedCitation): boolean {
  return left.evidenceId === right.evidenceId &&
    left.sourceBookId === right.sourceBookId &&
    left.title === right.title &&
    left.chapter === right.chapter &&
    left.locatorId === right.locatorId;
}

function canonicalSegment(
  value: unknown,
  expectedClaimId: string,
  globalById: ReadonlyMap<string, HoidPresentedCitation>,
): HoidPresentedSegment | null {
  const record = exactDataRecord(value, SEGMENT_KEYS);
  if (!record) return null;

  const claimId = record.claimId;
  const text = record.text;
  const evidenceIds = canonicalIds(record.evidenceIds, 1, MAX_EVIDENCE);
  const citations = canonicalCitations(record.citations, 1, MAX_EVIDENCE);
  if (
    typeof claimId !== "string" ||
    claimId !== expectedClaimId ||
    typeof text !== "string" ||
    text.length < 1 ||
    text.length > MAX_CLAIM_TEXT ||
    text !== text.trim() ||
    !evidenceIds ||
    !citations ||
    evidenceIds.length !== citations.length
  ) return null;

  const evidenceSet = new Set(evidenceIds);
  for (const citation of citations) {
    const global = globalById.get(citation.evidenceId);
    if (!evidenceSet.has(citation.evidenceId) || !global || !sameCitation(citation, global)) {
      return null;
    }
  }
  if (evidenceIds.some(id => !citations.some(citation => citation.evidenceId === id))) return null;

  return Object.freeze({
    claimId,
    text,
    evidenceIds,
    citations,
  });
}

/**
 * Canonicalize the already-presented value exactly once before deriving any
 * cross-book summary. This protects this exported boundary from mutable,
 * accessor-backed, sparse, proxied or structurally forged presentation data.
 *
 * The trusted presenter remains the authority for evidence-ID-to-editorial-
 * record identity and live progress authorization. This function additionally
 * checks the immutable display shape and that every visible chapter/locator
 * resolves to the current inspected edition manifest.
 */
function canonicalizeCrossBookPresentation(value: unknown): CanonicalizationResult {
  const record = dataRecord(value, PRESENTATION_KEYS, ["status", "text", "claimIds", "evidenceIds", "citations"]);
  if (!record || record.status !== "ready") return Object.freeze({ status: "invalid" });

  const hasSegments = Object.prototype.hasOwnProperty.call(record, "segments");
  const hasLayout = Object.prototype.hasOwnProperty.call(record, "layout");
  if (!hasSegments && !hasLayout) return Object.freeze({ status: "missing-segments" });
  if (!hasSegments || !hasLayout || Object.keys(record).length !== PRESENTATION_KEYS.length) {
    return Object.freeze({ status: "invalid" });
  }

  const text = record.text;
  const claimIds = canonicalIds(record.claimIds, 1, MAX_CLAIMS);
  const evidenceIds = canonicalIds(record.evidenceIds, 1, MAX_EVIDENCE);
  const citations = canonicalCitations(record.citations, 1, MAX_EVIDENCE);
  const layout = record.layout;
  if (
    typeof text !== "string" ||
    text.length < 1 ||
    text.length > MAX_TOTAL_TEXT ||
    text !== text.trim() ||
    !claimIds ||
    !evidenceIds ||
    !citations ||
    citations.length !== evidenceIds.length ||
    typeof layout !== "string" ||
    !(HOID_NARRATIVE_LAYOUTS as readonly string[]).includes(layout)
  ) return Object.freeze({ status: "invalid" });

  const globalById = new Map(citations.map(citation => [citation.evidenceId, citation]));
  if (evidenceIds.some(id => !globalById.has(id))) return Object.freeze({ status: "invalid" });

  const rawSegments = denseArray(record.segments, claimIds.length, MAX_CLAIMS);
  if (!rawSegments || rawSegments.length !== claimIds.length) return Object.freeze({ status: "invalid" });

  const segments: HoidPresentedSegment[] = [];
  const referenced = new Set<string>();
  let totalSegmentText = 0;
  for (let index = 0; index < rawSegments.length; index += 1) {
    const segment = canonicalSegment(rawSegments[index], claimIds[index], globalById);
    if (!segment) return Object.freeze({ status: "invalid" });
    totalSegmentText += segment.text.length;
    if (totalSegmentText > MAX_TOTAL_TEXT) return Object.freeze({ status: "invalid" });
    for (const id of segment.evidenceIds) referenced.add(id);
    segments.push(segment);
  }

  if (
    referenced.size !== evidenceIds.length ||
    evidenceIds.some(id => !referenced.has(id))
  ) return Object.freeze({ status: "invalid" });

  const canonicalSegments = Object.freeze(segments);
  const composition = composeHoidNarrative({
    segments: canonicalSegments.map(segment => Object.freeze({
      claimId: segment.claimId,
      text: segment.text,
      evidenceIds: segment.evidenceIds,
    })),
  }, layout as HoidNarrativeLayout);
  if (composition.status !== "ready" || composition.text !== text) {
    return Object.freeze({ status: "invalid" });
  }

  return Object.freeze({
    status: "ready",
    presentation: Object.freeze({
      text,
      claimIds,
      evidenceIds,
      citations,
      layout: layout as HoidNarrativeLayout,
      segments: canonicalSegments,
    }),
  });
}

/**
 * Build a metadata-only chapter matrix from a value produced by the trusted
 * screen presenter. The value is canonicalized once before any grouping; no
 * progress snapshot or raw answer object is re-read here.
 */
export function summarizeHoidPresentedCrossBookEvidence(
  presentationInput: unknown,
): HoidCrossBookEvidenceResult {
  const canonical = canonicalizeCrossBookPresentation(presentationInput);
  if (canonical.status === "missing-segments") {
    return Object.freeze({ status: "unavailable", reason: "segment-provenance-required" });
  }
  if (canonical.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: "invalid-provenance" });
  }
  const presentation = canonical.presentation;

  const referenced = new Set<string>();
  const workEvidence = new Map<string, { title: string; chapters: Set<number>; evidenceIds: Set<string> }>();
  const segmentEvidence: HoidCrossBookSegmentEvidence[] = [];

  for (const segment of presentation.segments) {
    const segmentWorkEvidence = new Map<string, {
      title: string;
      chapters: Set<number>;
      evidenceIds: Set<string>;
    }>();
    for (const citation of segment.citations) {
      referenced.add(citation.evidenceId);

      let group = workEvidence.get(citation.sourceBookId);
      if (!group) {
        group = { title: citation.title, chapters: new Set<number>(), evidenceIds: new Set<string>() };
        workEvidence.set(citation.sourceBookId, group);
      }
      group.chapters.add(citation.chapter);
      group.evidenceIds.add(citation.evidenceId);

      let segmentGroup = segmentWorkEvidence.get(citation.sourceBookId);
      if (!segmentGroup) {
        segmentGroup = {
          title: citation.title,
          chapters: new Set<number>(),
          evidenceIds: new Set<string>(),
        };
        segmentWorkEvidence.set(citation.sourceBookId, segmentGroup);
      }
      segmentGroup.chapters.add(citation.chapter);
      segmentGroup.evidenceIds.add(citation.evidenceId);
    }

    const works = [...segmentWorkEvidence.entries()]
      .sort(([left], [right]) => WORK_ORDER.get(left)! - WORK_ORDER.get(right)!)
      .map(([sourceBookId, group]) => Object.freeze({
        sourceBookId,
        title: group.title,
        chapters: Object.freeze([...group.chapters].sort((left, right) => left - right)),
        evidenceIds: Object.freeze([...group.evidenceIds].sort()),
      }));
    segmentEvidence.push(Object.freeze({
      claimId: segment.claimId,
      sourceBookIds: Object.freeze(works.map(work => work.sourceBookId)),
      works: Object.freeze(works),
    }));
  }

  if (
    referenced.size !== presentation.evidenceIds.length ||
    presentation.evidenceIds.some(id => !referenced.has(id))
  ) return Object.freeze({ status: "unavailable", reason: "invalid-provenance" });

  if (workEvidence.size < 2) return Object.freeze({ status: "not-cross-book" });

  const works = [...workEvidence.entries()]
    .sort(([left], [right]) => WORK_ORDER.get(left)! - WORK_ORDER.get(right)!)
    .map(([sourceBookId, group]) => Object.freeze({
      sourceBookId,
      title: group.title,
      chapters: Object.freeze([...group.chapters].sort((left, right) => left - right)),
      evidenceIds: Object.freeze([...group.evidenceIds].sort()),
    }));

  return Object.freeze({
    status: "ready",
    summary: Object.freeze({
      workCount: works.length,
      works: Object.freeze(works),
      segments: Object.freeze(segmentEvidence),
    }),
  });
}

/**
 * Convenience boundary for non-screen callers: authorize the raw answer
 * against the supplied progress snapshot, then summarize that exact canonical
 * result. Prefer this over passing a hand-built presentation.
 */
export function buildHoidCrossBookEvidenceSummary(
  answer: HoidEvidenceAnswer | unknown,
  progress: unknown,
): HoidCrossBookEvidenceResult {
  const presentation = presentHoidEvidenceAnswer(answer, progress);
  if (presentation.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: "answer-not-authorized" });
  }
  return summarizeHoidPresentedCrossBookEvidence(presentation);
}
