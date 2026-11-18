import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { canonicalEvidenceScope, type HoidEvidenceCitation } from "./evidenceScope";
import { presentHoidEvidenceAnswer } from "./answerPresentation";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";
import { getHoidReadingManifest } from "./readingManifest";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import {
  composeHoidNarrative,
  defaultHoidNarrativeLayout,
  type HoidNarrativeSegment,
} from "./narrativeComposition";

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MAX_TEXT_LENGTH = 32_000;
const MAX_SEGMENTS = 12;
const MAX_EVIDENCE = 16;
const GRAPH_SOURCE_KEYS = [
  "evidenceId", "sourceBookId", "sourceChapter", "locatorId", "unlockBookId",
  "unlockChapter", "editionId", "navigationSha256", "documentSha256",
] as const;
const TITLES = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title]));

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = allowedKeys,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
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

function canonicalDenseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) return null;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

type CanonicalGraphSource = HoidEvidenceCitation & Readonly<{
  editionId: string;
  navigationSha256: string;
  documentSha256: string;
}>;

function canonicalGraphSource(value: unknown): CanonicalGraphSource | null {
  const source = canonicalRecord(value, GRAPH_SOURCE_KEYS);
  if (!source) return null;
  const {
    evidenceId, sourceBookId, sourceChapter, locatorId,
    unlockBookId, unlockChapter, editionId, navigationSha256, documentSha256,
  } = source;

  if (
    typeof evidenceId !== "string" || !ID_PATTERN.test(evidenceId) ||
    typeof sourceBookId !== "string" || !TITLES.has(sourceBookId) ||
    typeof sourceChapter !== "number" || !Number.isSafeInteger(sourceChapter) || sourceChapter < 1 ||
    typeof locatorId !== "string" || locatorId.length < 1 || locatorId.length > 256 ||
    typeof unlockBookId !== "string" || unlockBookId !== sourceBookId ||
    typeof unlockChapter !== "number" || !Number.isSafeInteger(unlockChapter) || unlockChapter < sourceChapter ||
    typeof editionId !== "string" || editionId.length < 1 || editionId.length > 128 ||
    typeof navigationSha256 !== "string" || !HASH_PATTERN.test(navigationSha256) ||
    typeof documentSha256 !== "string" || !HASH_PATTERN.test(documentSha256)
  ) return null;

  const scope = canonicalEvidenceScope(
    { bookId: sourceBookId, chapter: sourceChapter, locatorId },
    { bookId: unlockBookId, chapter: unlockChapter },
  );
  if (!scope) return null;

  const manifestResult = getHoidReadingManifest(sourceBookId);
  if (
    manifestResult.status !== "ready" ||
    manifestResult.manifest.editionId !== editionId ||
    manifestResult.manifest.navigationSha256 !== navigationSha256
  ) return null;
  const verifiedDocumentSha256 = getVerifiedChapterDocumentSha256(
    sourceBookId,
    editionId,
    navigationSha256,
    sourceChapter,
  );
  if (verifiedDocumentSha256 !== documentSha256) return null;

  return Object.freeze({
    evidenceId,
    sourceBookId,
    sourceChapter,
    locatorId,
    unlockBookId,
    unlockChapter,
    editionId,
    navigationSha256,
    documentSha256,
  });
}

function sourceFingerprint(source: CanonicalGraphSource): string {
  return JSON.stringify(GRAPH_SOURCE_KEYS.map(key => source[key]));
}

/**
 * Converts a trusted graph-renderer result into the existing evidence answer
 * contract. It rechecks segment/source identity, exact edition hashes and the
 * reader's current unlock thresholds before the conversation layer can return it.
 */
export function createHoidEvidenceAnswerFromRelationshipResult(
  input: unknown,
  progress: unknown,
): HoidEvidenceAnswer | null {
  try {
    const wrapper = canonicalRecord(input, ["status", "explanation", "progressRevision", "progressFingerprint"]);
    const projection = projectHoidCursorProgressSnapshot(progress);
    if (
      !wrapper ||
      wrapper.status !== "ready" ||
      typeof wrapper.progressRevision !== "number" ||
      !Number.isSafeInteger(wrapper.progressRevision) ||
      wrapper.progressRevision < 0 ||
      typeof wrapper.progressFingerprint !== "string" ||
      !HASH_PATTERN.test(wrapper.progressFingerprint) ||
      projection.status !== "ready" ||
      projection.revision !== wrapper.progressRevision ||
      fingerprintHoidCursorProgressProjection(projection) !== wrapper.progressFingerprint
    ) return null;

    const explanation = canonicalRecord(
      wrapper.explanation,
      ["status", "planId", "progressRevision", "text", "segments", "sources", "truncated"],
    );
    if (
      !explanation ||
      explanation.status !== "ready" ||
      explanation.progressRevision !== wrapper.progressRevision ||
      typeof explanation.planId !== "string" || !HASH_PATTERN.test(explanation.planId) ||
      typeof explanation.progressRevision !== "number" ||
      !Number.isSafeInteger(explanation.progressRevision) || explanation.progressRevision < 0 ||
      typeof explanation.text !== "string" ||
      explanation.text.length < 1 || explanation.text.length > MAX_TEXT_LENGTH ||
      explanation.text !== explanation.text.trim() ||
      explanation.truncated !== false
    ) return null;

    const rawSources = canonicalDenseArray(explanation.sources, 1, MAX_EVIDENCE);
    const rawSegments = canonicalDenseArray(explanation.segments, 1, MAX_SEGMENTS);
    if (!rawSources || !rawSegments) return null;

    const sourcesById = new Map<string, CanonicalGraphSource>();
    for (const rawSource of rawSources) {
      const source = canonicalGraphSource(rawSource);
      if (!source || sourcesById.has(source.evidenceId)) return null;
      sourcesById.set(source.evidenceId, source);
    }

    const claimIds: string[] = [];
    const evidenceIds = new Set<string>();
    const referencedSources = new Set<string>();
    const segmentTexts: string[] = [];
    const narrativeSegments: HoidNarrativeSegment[] = [];

    for (const rawSegment of rawSegments) {
      const segment = canonicalRecord(rawSegment, ["claimId", "text", "evidenceIds", "sources"]);
      if (
        !segment ||
        typeof segment.claimId !== "string" || !ID_PATTERN.test(segment.claimId) ||
        claimIds.includes(segment.claimId) ||
        typeof segment.text !== "string" ||
        segment.text.length < 1 || segment.text.length > 4_000 ||
        segment.text !== segment.text.trim()
      ) return null;

      const rawEvidenceIds = canonicalDenseArray(segment.evidenceIds, 1, MAX_EVIDENCE);
      const rawSegmentSources = canonicalDenseArray(segment.sources, 1, MAX_EVIDENCE);
      if (!rawEvidenceIds || !rawSegmentSources || rawEvidenceIds.length !== rawSegmentSources.length) return null;

      const segmentEvidenceIds: string[] = [];
      for (const rawEvidenceId of rawEvidenceIds) {
        if (typeof rawEvidenceId !== "string" || !ID_PATTERN.test(rawEvidenceId) || segmentEvidenceIds.includes(rawEvidenceId)) {
          return null;
        }
        segmentEvidenceIds.push(rawEvidenceId);
      }

      const segmentSources: CanonicalGraphSource[] = [];
      for (const rawSource of rawSegmentSources) {
        const source = canonicalGraphSource(rawSource);
        if (!source) return null;
        const topLevel = sourcesById.get(source.evidenceId);
        if (!topLevel || sourceFingerprint(source) !== sourceFingerprint(topLevel)) return null;
        segmentSources.push(source);
        referencedSources.add(source.evidenceId);
        evidenceIds.add(source.evidenceId);
      }

      const segmentSourceIds = segmentSources.map(source => source.evidenceId);
      if (
        segmentSourceIds.length !== segmentEvidenceIds.length ||
        new Set(segmentSourceIds).size !== segmentSourceIds.length ||
        JSON.stringify([...segmentSourceIds].sort()) !== JSON.stringify([...segmentEvidenceIds].sort())
      ) return null;

      claimIds.push(segment.claimId);
      segmentTexts.push(segment.text);
      narrativeSegments.push(Object.freeze({
        claimId: segment.claimId,
        text: segment.text,
        evidenceIds: Object.freeze([...segmentEvidenceIds]),
      }));
    }

    if (
      referencedSources.size !== sourcesById.size ||
      [...sourcesById.keys()].some(id => !referencedSources.has(id)) ||
      explanation.text !== segmentTexts.join("\n\n") ||
      evidenceIds.size !== sourcesById.size ||
      evidenceIds.size > MAX_EVIDENCE
    ) return null;
    // The original graph text must match the exact approved segments before
    // local formatting is applied. The composer cannot rewrite claim text.
    const composition = composeHoidNarrative(
      { segments: narrativeSegments },
      defaultHoidNarrativeLayout(narrativeSegments.length),
    );
    if (composition.status !== "ready") return null;

    const citations: HoidEvidenceCitation[] = [...sourcesById.values()].map(source => Object.freeze({
      evidenceId: source.evidenceId,
      sourceBookId: source.sourceBookId,
      sourceChapter: source.sourceChapter,
      locatorId: source.locatorId,
      unlockBookId: source.unlockBookId,
      unlockChapter: source.unlockChapter,
    }));
    const answer: HoidEvidenceAnswer = Object.freeze({
      status: "authorized",
      text: composition.text,
      claimIds: Object.freeze(claimIds),
      evidenceIds: Object.freeze([...evidenceIds].sort()),
      sources: Object.freeze(citations),
    });

    return presentHoidEvidenceAnswer(answer, progress).status === "ready" ? answer : null;
  } catch {
    return null;
  }
}
