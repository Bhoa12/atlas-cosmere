import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { canonicalEvidenceScope, type HoidEvidenceCitation } from "./evidenceScope";
import { composeHoidNarrative, type HoidNarrativeLayout } from "./narrativeComposition";

export type HoidPresentedCitation = Readonly<{
  evidenceId: string;
  sourceBookId: string;
  title: string;
  chapter: number;
  locatorId: string;
}>;

export type HoidPresentedSegment = Readonly<{
  claimId: string;
  text: string;
  evidenceIds: readonly string[];
  citations: readonly HoidPresentedCitation[];
}>;

export type HoidAnswerPresentation =
  | Readonly<{
      status: "ready";
      text: string;
      claimIds: readonly string[];
      evidenceIds: readonly string[];
      citations: readonly HoidPresentedCitation[];
      layout?: HoidNarrativeLayout;
      segments?: readonly HoidPresentedSegment[];
    }>
  | Readonly<{
      status: "withheld";
      reason: "not-authorized" | "invalid-answer" | "invalid-progress" | "locked-evidence";
      text: string;
    }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const MAX_TEXT_LENGTH = 32_000;
const MAX_CLAIMS = 12;
const MAX_EVIDENCE = 16;
const SOURCE_KEYS = [
  "evidenceId",
  "sourceBookId",
  "sourceChapter",
  "locatorId",
  "unlockBookId",
  "unlockChapter",
] as const;

const TITLES = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title]));

const WITHHELD_TEXT =
  "No hay afirmaciones editoriales verificadas y autorizadas para esta pregunta y tu progreso. Hoid no inventará una explicación.";

function withheld(
  reason: Extract<HoidAnswerPresentation, { status: "withheld" }>["reason"],
): HoidAnswerPresentation {
  return Object.freeze({ status: "withheld", reason, text: WITHHELD_TEXT });
}

function canonicalRecord(
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

function canonicalIds(value: unknown, maximum: number): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > maximum) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const ids: string[] = [];
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
      ids.push(descriptor.value);
    }
    return Object.freeze(ids);
  } catch {
    return null;
  }
}

function canonicalSources(value: unknown): readonly HoidEvidenceCitation[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_EVIDENCE) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const sources: HoidEvidenceCitation[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;

      const source = canonicalRecord(descriptor.value, SOURCE_KEYS, SOURCE_KEYS);
      if (!source) return null;
      const evidenceId = source.evidenceId;
      const sourceBookId = source.sourceBookId;
      const sourceChapter = source.sourceChapter;
      const locatorId = source.locatorId;
      const unlockBookId = source.unlockBookId;
      const unlockChapter = source.unlockChapter;

      if (
        typeof evidenceId !== "string" ||
        !ID_PATTERN.test(evidenceId) ||
        seen.has(evidenceId) ||
        typeof sourceBookId !== "string" ||
        !TITLES.has(sourceBookId) ||
        typeof sourceChapter !== "number" ||
        !Number.isSafeInteger(sourceChapter) ||
        sourceChapter < 1 ||
        typeof locatorId !== "string" ||
        locatorId.length < 1 ||
        locatorId.length > 256 ||
        /[\u0000-\u001F\u007F]/u.test(locatorId) ||
        typeof unlockBookId !== "string" ||
        unlockBookId !== sourceBookId ||
        typeof unlockChapter !== "number" ||
        !Number.isSafeInteger(unlockChapter) ||
        unlockChapter < sourceChapter
      ) return null;

      if (!canonicalEvidenceScope(
        { bookId: sourceBookId, chapter: sourceChapter, locatorId },
        { bookId: unlockBookId, chapter: unlockChapter },
      )) return null;

      seen.add(evidenceId);
      sources.push(Object.freeze({
        evidenceId,
        sourceBookId,
        sourceChapter,
        locatorId,
        unlockBookId,
        unlockChapter,
      }));
    }
    return Object.freeze(sources);
  } catch {
    return null;
  }
}


function canonicalPresentationSegments(
  value: unknown,
  claimIds: readonly string[],
  evidenceIds: readonly string[],
  citationsById: ReadonlyMap<string, HoidPresentedCitation>,
  layout: unknown,
  expectedText: string,
): readonly HoidPresentedSegment[] | null {
  try {
    if (!Array.isArray(value) || value.length !== claimIds.length || value.length > MAX_CLAIMS) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const segments: HoidPresentedSegment[] = [];
    const referencedEvidence = new Set<string>();
    const narrativeSegments: { claimId: string; text: string; evidenceIds: readonly string[] }[] = [];

    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      const segment = canonicalRecord(descriptor.value, ["claimId", "text", "evidenceIds"], ["claimId", "text", "evidenceIds"]);
      if (!segment || Object.keys(segment).length !== 3) return null;

      const claimId = segment.claimId;
      const text = segment.text;
      const segmentEvidenceIds = canonicalIds(segment.evidenceIds, MAX_EVIDENCE);
      if (
        typeof claimId !== "string" || claimId !== claimIds[index] ||
        typeof text !== "string" || text.length < 1 || text.length > 4_000 ||
        text !== text.trim() || !segmentEvidenceIds
      ) return null;

      const segmentCitations: HoidPresentedCitation[] = [];
      for (const evidenceId of segmentEvidenceIds) {
        const citation = citationsById.get(evidenceId);
        if (!citation) return null;
        referencedEvidence.add(evidenceId);
        segmentCitations.push(citation);
      }
      segmentCitations.sort((left, right) =>
        left.sourceBookId < right.sourceBookId ? -1 :
        left.sourceBookId > right.sourceBookId ? 1 :
        left.chapter - right.chapter ||
        (left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0)
      );

      const frozenEvidenceIds = Object.freeze([...segmentEvidenceIds]);
      segments.push(Object.freeze({
        claimId,
        text,
        evidenceIds: frozenEvidenceIds,
        citations: Object.freeze(segmentCitations),
      }));
      narrativeSegments.push(Object.freeze({ claimId, text, evidenceIds: frozenEvidenceIds }));
    }

    if (
      referencedEvidence.size !== evidenceIds.length ||
      [...referencedEvidence].sort().join("\n") !== [...evidenceIds].sort().join("\n")
    ) return null;

    const composition = composeHoidNarrative({ segments: narrativeSegments }, layout);
    if (composition.status !== "ready" || composition.text !== expectedText) return null;
    return Object.freeze(segments);
  } catch {
    return null;
  }
}

function sourceIsUnlocked(
  source: HoidEvidenceCitation,
  reading: readonly Readonly<{ bookId: string; chapter?: number; completed?: boolean }>[],
): boolean {
  const position = reading.find(item => item.bookId === source.unlockBookId);
  return Boolean(
    position &&
    (position.completed === true ||
      (typeof position.chapter === "number" && position.chapter >= source.unlockChapter)),
  );
}

/**
 * Converts an evidence-runtime result into a UI-safe answer with visible
 * source citations. It never forwards provider prose or blocked/abstained text.
 * Citation metadata is displayed only after every source unlock is rechecked
 * against the same authoritative cursor snapshot.
 */
export function presentHoidEvidenceAnswer(
  input: unknown,
  progressInput: unknown,
): HoidAnswerPresentation {
  const answer = canonicalRecord(
    input,
    ["status", "reason", "text", "claimIds", "evidenceIds", "sources", "segments", "layout"],
    ["status"],
  );
  if (!answer) return withheld("invalid-answer");

  if (answer.status === "blocked" || answer.status === "abstain") {
    return withheld("not-authorized");
  }
  if (answer.status !== "authorized") return withheld("invalid-answer");

  const authorized = canonicalRecord(
    input,
    ["status", "text", "claimIds", "evidenceIds", "sources", "segments", "layout"],
    ["status", "text", "claimIds", "evidenceIds", "sources"],
  );
  const hasSegments = Boolean(authorized && Object.prototype.hasOwnProperty.call(authorized, "segments"));
  const hasLayout = Boolean(authorized && Object.prototype.hasOwnProperty.call(authorized, "layout"));
  if (
    !authorized ||
    hasSegments !== hasLayout ||
    Object.keys(authorized).length !== (hasSegments ? 7 : 5)
  ) return withheld("invalid-answer");

  const text = authorized.text;
  if (
    typeof text !== "string" ||
    text.length < 1 ||
    text.length > MAX_TEXT_LENGTH ||
    text !== text.trim() ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)
  ) return withheld("invalid-answer");

  const claimIds = canonicalIds(authorized.claimIds, MAX_CLAIMS);
  const evidenceIds = canonicalIds(authorized.evidenceIds, MAX_EVIDENCE);
  const sources = canonicalSources(authorized.sources);
  if (!claimIds || !evidenceIds || !sources) return withheld("invalid-answer");

  const sourceIds = sources.map(source => source.evidenceId);
  if (
    sourceIds.length !== evidenceIds.length ||
    new Set(sourceIds).size !== sourceIds.length ||
    JSON.stringify([...sourceIds].sort()) !== JSON.stringify([...evidenceIds].sort())
  ) return withheld("invalid-answer");

  const projection = projectHoidCursorProgressSnapshot(progressInput);
  if (projection.status !== "ready") return withheld("invalid-progress");
  if (!sources.every(source => sourceIsUnlocked(source, projection.reading))) {
    return withheld("locked-evidence");
  }

  const citations = sources
    .map(source => Object.freeze({
      evidenceId: source.evidenceId,
      sourceBookId: source.sourceBookId,
      title: TITLES.get(source.sourceBookId)!,
      chapter: source.sourceChapter,
      locatorId: source.locatorId,
    }))
    .sort((left, right) =>
      left.sourceBookId < right.sourceBookId ? -1 :
      left.sourceBookId > right.sourceBookId ? 1 :
      left.chapter - right.chapter ||
      (left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0)
    );

  const frozenCitations = Object.freeze(citations);
  let segments: readonly HoidPresentedSegment[] | undefined;
  let layout: HoidNarrativeLayout | undefined;
  if (hasSegments) {
    const citationsById = new Map(frozenCitations.map(citation => [citation.evidenceId, citation]));
    segments = canonicalPresentationSegments(
      authorized.segments,
      claimIds,
      evidenceIds,
      citationsById,
      authorized.layout,
      text,
    ) ?? undefined;
    if (!segments) return withheld("invalid-answer");
    layout = authorized.layout as HoidNarrativeLayout;
  }

  return Object.freeze({
    status: "ready",
    text,
    claimIds,
    evidenceIds,
    citations: frozenCitations,
    ...(segments && layout ? { segments, layout } : {}),
  });
}
