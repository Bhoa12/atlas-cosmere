import type {
  HoidAnswerPresentation,
  HoidPresentedCitation,
} from "./answerPresentation";
import type {
  HoidCrossBookEvidenceSummary,
  HoidCrossBookSegmentWorkEvidence,
  HoidCrossBookWorkEvidence,
} from "./crossBookEvidence";
import type { HoidNarrativeLayout } from "./narrativeComposition";
import { resolveHoidChapterIdentity } from "./chapterIdentity";
import { validateHoidChapterReference, type HoidChapterReference } from "./chapterReference";
import type { HoidExactEvidenceAnswer } from "./exactUnitEvidenceRuntime";
import { composeHoidNarrative } from "./narrativeComposition";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";

/**
 * Minimal citation metadata retained by the chat UI after the trusted
 * presenter has validated the complete evidence record against live progress.
 * Internal EPUB locators, unlock thresholds and evidence IDs stay in the
 * trusted pipeline and are not copied into React message state.
 */
export type HoidDisplayCitation = Readonly<{
  sourceBookId: string;
  title: string;
  chapter: number;
  /** Stable numbered-unit ordinal; distinguishes repeated visible chapter labels. */
  chapterOrdinal: number;
  chapterLabelAmbiguous: boolean;
}>;

export type HoidDisplaySegment = Readonly<{
  claimId: string;
  text: string;
  citations: readonly HoidDisplayCitation[];
}>;

export type HoidDisplayCrossBookWorkEvidence = Readonly<{
  sourceBookId: string;
  title: string;
  chapters: readonly number[];
}>;

export type HoidDisplayCrossBookSegmentEvidence = Readonly<{
  claimId: string;
  works: readonly HoidDisplayCrossBookWorkEvidence[];
}>;

export type HoidDisplayCrossBookEvidenceSummary = Readonly<{
  workCount: number;
  works: readonly HoidDisplayCrossBookWorkEvidence[];
  segments: readonly HoidDisplayCrossBookSegmentEvidence[];
}>;

export type HoidAnswerDisplayProjection = Readonly<{
  text: string;
  citations: readonly HoidDisplayCitation[];
  layout?: HoidNarrativeLayout;
  segments?: readonly HoidDisplaySegment[];
}>;

function projectCitation(citation: HoidPresentedCitation): HoidDisplayCitation | null {
  const identity = resolveHoidChapterIdentity(citation.sourceBookId, {
    chapterNumber: citation.chapter,
    locatorId: citation.locatorId,
  });
  if (identity.status !== "resolved") return null;
  const labelResolution = resolveHoidChapterIdentity(citation.sourceBookId, {
    chapterNumber: citation.chapter,
  });
  if (labelResolution.status === "unavailable") return null;
  return Object.freeze({
    sourceBookId: citation.sourceBookId,
    title: citation.title,
    chapter: citation.chapter,
    chapterOrdinal: identity.identity.ordinal,
    chapterLabelAmbiguous: labelResolution.status === "ambiguous",
  });
}

function projectCitationList(
  citations: readonly HoidPresentedCitation[],
): readonly HoidDisplayCitation[] | null {
  const projected: HoidDisplayCitation[] = [];
  for (const citation of citations) {
    const item = projectCitation(citation);
    if (!item) return null;
    projected.push(item);
  }
  return Object.freeze(projected);
}

function projectCrossBookWork(
  work: HoidCrossBookWorkEvidence | HoidCrossBookSegmentWorkEvidence,
): HoidDisplayCrossBookWorkEvidence | null {
  for (const chapter of work.chapters) {
    if (resolveHoidChapterIdentity(work.sourceBookId, { chapterNumber: chapter }).status !== "resolved") {
      return null;
    }
  }
  return Object.freeze({
    sourceBookId: work.sourceBookId,
    title: work.title,
    chapters: Object.freeze([...work.chapters]),
  });
}

/**
 * Remove evidence IDs and internal provenance arrays from the cross-work
 * summary. The UI only needs canonical work titles and chapter numbers.
 */
export function projectHoidCrossBookEvidenceForDisplay(
  summary: HoidCrossBookEvidenceSummary,
): HoidDisplayCrossBookEvidenceSummary | null {
  if (
    !Number.isSafeInteger(summary.workCount) ||
    summary.workCount < 2 ||
    summary.works.length !== summary.workCount ||
    summary.segments.length < 1
  ) return null;

  const works = summary.works.map(projectCrossBookWork);
  if (works.some(work => work === null)) return null;
  const segments = summary.segments.map(segment => {
    const segmentWorks = segment.works.map(projectCrossBookWork);
    if (segmentWorks.some(work => work === null)) return null;
    return Object.freeze({
      claimId: segment.claimId,
      works: Object.freeze(segmentWorks as HoidDisplayCrossBookWorkEvidence[]),
    });
  });
  if (segments.some(segment => segment === null)) return null;

  return Object.freeze({
    workCount: summary.workCount,
    works: Object.freeze(works as HoidDisplayCrossBookWorkEvidence[]),
    segments: Object.freeze(segments as HoidDisplayCrossBookSegmentEvidence[]),
  });
}

/**
 * Reduce a trusted, progress-checked presentation to the exact metadata the
 * UI renders. This is intentionally a one-way projection: locator IDs,
 * unlock thresholds, raw evidence IDs and provider claim envelopes are not
 * retained in React message state.
 *
 * A mismatched segment/layout pair is rejected rather than partially shown.
 */
export function projectHoidAnswerForDisplay(
  presentation: Extract<HoidAnswerPresentation, { status: "ready" }>,
): HoidAnswerDisplayProjection | null {
  const hasSegments = presentation.segments !== undefined;
  const hasLayout = presentation.layout !== undefined;
  if (hasSegments !== hasLayout) return null;
  if (presentation.segments && presentation.segments.length === 0) return null;

  const citations = projectCitationList(presentation.citations);
  if (!citations) return null;
  let segments: readonly HoidDisplaySegment[] | undefined;
  if (presentation.segments) {
    const projectedSegments: HoidDisplaySegment[] = [];
    for (const segment of presentation.segments) {
      const segmentCitations = projectCitationList(segment.citations);
      if (!segmentCitations) return null;
      projectedSegments.push(Object.freeze({
        claimId: segment.claimId,
        text: segment.text,
        citations: segmentCitations,
      }));
    }
    segments = Object.freeze(projectedSegments);
  }

  return Object.freeze({
    text: presentation.text,
    citations,
    ...(segments && presentation.layout
      ? { segments, layout: presentation.layout }
      : {}),
  });
}


const EXACT_WORK_ORDER = new Map(HOID_SOURCE_BIBLIOGRAPHY.map((work, index) => [work.id, index] as const));
const EXACT_WORK_TITLES = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title] as const));
const EXACT_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const EXACT_SHA_PATTERN = /^[a-f0-9]{64}$/u;

type CanonicalExactCitation = Readonly<{
  evidenceId: string;
  source: HoidChapterReference;
  firstSafeAppearance: HoidChapterReference;
  unlock: HoidChapterReference;
}>;

function exactDataRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some(key => typeof key !== "string" || !keys.includes(key))
    ) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function exactDenseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
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

function exactIds(value: unknown, minimum: number, maximum: number): readonly string[] | null {
  const entries = exactDenseArray(value, minimum, maximum);
  if (!entries) return null;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (
      typeof entry !== "string" ||
      entry !== entry.trim() ||
      entry.length < 1 ||
      entry.length > 128 ||
      !EXACT_ID_PATTERN.test(entry) ||
      seen.has(entry)
    ) return null;
    seen.add(entry);
    result.push(entry);
  }
  return Object.freeze(result);
}

function exactReference(value: unknown): HoidChapterReference | null {
  const validation = validateHoidChapterReference(value);
  if (
    validation.status !== "valid" ||
    !EXACT_WORK_TITLES.has(validation.reference.bookId) ||
    !Number.isSafeInteger(validation.reference.ordinal) ||
    validation.reference.ordinal < 1 ||
    !EXACT_SHA_PATTERN.test(validation.reference.identityFingerprint)
  ) return null;
  return validation.reference;
}

function sameExactReference(left: HoidChapterReference, right: HoidChapterReference): boolean {
  return left.bookId === right.bookId &&
    left.chapterNumber === right.chapterNumber &&
    left.ordinal === right.ordinal &&
    left.unitId === right.unitId &&
    left.labelAmbiguous === right.labelAmbiguous &&
    left.identityFingerprint === right.identityFingerprint;
}

function exactCitation(value: unknown): CanonicalExactCitation | null {
  const record = exactDataRecord(value, [
    "evidenceId",
    "source",
    "firstSafeAppearance",
    "unlock",
  ]);
  if (
    !record ||
    typeof record.evidenceId !== "string" ||
    !EXACT_ID_PATTERN.test(record.evidenceId)
  ) return null;
  const source = exactReference(record.source);
  const firstSafeAppearance = exactReference(record.firstSafeAppearance);
  const unlock = exactReference(record.unlock);
  if (!source || !firstSafeAppearance || !unlock) return null;
  return Object.freeze({
    evidenceId: record.evidenceId,
    source,
    firstSafeAppearance,
    unlock,
  });
}

function sameExactCitation(left: CanonicalExactCitation, right: CanonicalExactCitation): boolean {
  return left.evidenceId === right.evidenceId &&
    sameExactReference(left.source, right.source) &&
    sameExactReference(left.firstSafeAppearance, right.firstSafeAppearance) &&
    sameExactReference(left.unlock, right.unlock);
}

function projectExactCitation(citation: CanonicalExactCitation): HoidDisplayCitation | null {
  const title = EXACT_WORK_TITLES.get(citation.source.bookId);
  if (!title) return null;
  return Object.freeze({
    sourceBookId: citation.source.bookId,
    title,
    chapter: citation.source.chapterNumber,
    chapterOrdinal: citation.source.ordinal,
    chapterLabelAmbiguous: citation.source.labelAmbiguous,
  });
}

/**
 * Projects a host-presented exact-unit answer directly from opaque chapter
 * references. Unlike the legacy citation path, this never needs to recreate
 * an EPUB locator: the exact-unit host has already verified the edition-bound
 * unit identity and its unlock policy.
 */
export function projectHoidExactUnitAnswerForDisplay(
  answerInput: HoidExactEvidenceAnswer | unknown,
): HoidAnswerDisplayProjection | null {
  const answer = exactDataRecord(answerInput, [
    "text",
    "claimIds",
    "evidenceIds",
    "entityIds",
    "sources",
    "segments",
    "layout",
  ]);
  if (
    !answer ||
    typeof answer.text !== "string" ||
    answer.text.length < 1 ||
    answer.text.length > 32_000 ||
    answer.text !== answer.text.trim() ||
    /[\u0000-\u0008\u000B-\u001F\u007F]/u.test(answer.text) ||
    (answer.layout !== "plain" && answer.layout !== "grouped")
  ) return null;

  const claimIds = exactIds(answer.claimIds, 1, 12);
  const evidenceIds = exactIds(answer.evidenceIds, 1, 16);
  const entityIds = exactIds(answer.entityIds, 0, 8);
  const rawSources = exactDenseArray(answer.sources, 1, 16);
  const rawSegments = exactDenseArray(answer.segments, 1, 12);
  if (
    !claimIds ||
    !evidenceIds ||
    !entityIds ||
    !rawSources ||
    !rawSegments ||
    rawSegments.length !== claimIds.length ||
    rawSources.length !== evidenceIds.length
  ) return null;

  const citationsById = new Map<string, CanonicalExactCitation>();
  for (const raw of rawSources) {
    const citation = exactCitation(raw);
    if (!citation || citationsById.has(citation.evidenceId)) return null;
    citationsById.set(citation.evidenceId, citation);
  }
  if (
    evidenceIds.some(id => !citationsById.has(id)) ||
    [...citationsById.keys()].some(id => !evidenceIds.includes(id))
  ) return null;

  const citations: HoidDisplayCitation[] = [];
  for (const evidenceId of evidenceIds) {
    const citation = citationsById.get(evidenceId);
    if (!citation) return null;
    const projected = projectExactCitation(citation);
    if (!projected) return null;
    citations.push(projected);
  }

  const segments: HoidDisplaySegment[] = [];
  const narrativeSegments: { claimId: string; text: string; evidenceIds: readonly string[] }[] = [];
  const referencedEvidenceIds = new Set<string>();
  for (let index = 0; index < rawSegments.length; index += 1) {
    const segment = exactDataRecord(rawSegments[index], [
      "claimId",
      "text",
      "evidenceIds",
      "sources",
    ]);
    if (
      !segment ||
      segment.claimId !== claimIds[index] ||
      typeof segment.text !== "string" ||
      segment.text.length < 1 ||
      segment.text.length > 4_000 ||
      segment.text !== segment.text.trim() ||
      /[\u0000-\u0008\u000B-\u001F\u007F]/u.test(segment.text)
    ) return null;

    const segmentEvidenceIds = exactIds(segment.evidenceIds, 1, 16);
    const rawSegmentSources = exactDenseArray(segment.sources, 1, 16);
    if (
      !segmentEvidenceIds ||
      !rawSegmentSources ||
      segmentEvidenceIds.length !== rawSegmentSources.length
    ) return null;

    const segmentCitations: HoidDisplayCitation[] = [];
    for (const rawSource of rawSegmentSources) {
      const source = exactCitation(rawSource);
      if (!source) return null;
      const global = citationsById.get(source.evidenceId);
      if (!global || !sameExactCitation(source, global) || !segmentEvidenceIds.includes(source.evidenceId)) {
        return null;
      }
      const projected = projectExactCitation(source);
      if (!projected) return null;
      segmentCitations.push(projected);
    }
    if (segmentEvidenceIds.some(id => !rawSegmentSources.some(raw => {
      const source = exactCitation(raw);
      return source?.evidenceId === id;
    }))) return null;

    for (const evidenceId of segmentEvidenceIds) referencedEvidenceIds.add(evidenceId);
    segments.push(Object.freeze({
      claimId: segment.claimId as string,
      text: segment.text,
      citations: Object.freeze(segmentCitations),
    }));
    narrativeSegments.push(Object.freeze({
      claimId: segment.claimId as string,
      text: segment.text,
      evidenceIds: segmentEvidenceIds,
    }));
  }

  if (
    referencedEvidenceIds.size !== evidenceIds.length ||
    evidenceIds.some(id => !referencedEvidenceIds.has(id))
  ) return null;

  const composition = composeHoidNarrative(
    { segments: narrativeSegments },
    answer.layout,
  );
  if (composition.status !== "ready" || composition.text !== answer.text) return null;

  return Object.freeze({
    text: answer.text,
    citations: Object.freeze(citations),
    layout: answer.layout,
    segments: Object.freeze(segments),
  });
}

/** Build a UI-only cross-work matrix from an already validated exact-unit projection. */
export function summarizeHoidExactUnitCrossBookDisplay(
  projection: HoidAnswerDisplayProjection,
): HoidDisplayCrossBookEvidenceSummary | null {
  const collectWorks = (citations: readonly HoidDisplayCitation[]): readonly HoidDisplayCrossBookWorkEvidence[] => {
    const grouped = new Map<string, { title: string; chapters: Set<number> }>();
    for (const citation of citations) {
      const existing = grouped.get(citation.sourceBookId) ?? {
        title: citation.title,
        chapters: new Set<number>(),
      };
      existing.chapters.add(citation.chapter);
      grouped.set(citation.sourceBookId, existing);
    }
    return Object.freeze([...grouped.entries()]
      .sort(([left], [right]) =>
        (EXACT_WORK_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (EXACT_WORK_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER))
      .map(([sourceBookId, value]) => Object.freeze({
        sourceBookId,
        title: value.title,
        chapters: Object.freeze([...value.chapters].sort((left, right) => left - right)),
      })));
  };

  const works = collectWorks(projection.citations);
  if (works.length < 2) return null;
  const segments = (projection.segments ?? []).map(segment => Object.freeze({
    claimId: segment.claimId,
    works: collectWorks(segment.citations),
  }));
  return Object.freeze({
    workCount: works.length,
    works,
    segments: Object.freeze(segments),
  });
}
