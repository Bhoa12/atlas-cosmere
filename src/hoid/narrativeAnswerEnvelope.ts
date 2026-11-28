import {
  HOID_SOURCE_BIBLIOGRAPHY,
  isKnownHoidSource,
} from "./bibliography";
import {
  canonicalizeHoidAnswerBookScope,
  type HoidAnswerBookScope,
} from "./answerScope";
import {
  getHoidReadingManifest,
} from "./readingManifest";
import {
  isHoidConversationProgressScope,
  type HoidConversationProgressScope,
} from "./conversationHistoryPolicy";
import {
  labelHoidClaimEpistemicKind,
  type HoidClaimEpistemicKind,
} from "./claimEpistemicKind";
import type {
  HoidDisplayCitation,
  HoidDisplaySegment,
  HoidDisplayCrossBookEvidenceSummary,
  HoidDisplayCrossBookWorkEvidence,
} from "./answerDisplayProjection";
import type { HoidNarrativeLayout } from "./narrativeComposition";

export type HoidNarrativeDomain =
  | "conversation"
  | "entity-dossier"
  | "entity-relationship"
  | "entity-timeline"
  | "character-evolution"
  | "magic-system";

export type HoidNarrativeEpistemicSummary = Readonly<{
  segmentCount: number;
  byKind: Readonly<Record<HoidClaimEpistemicKind, number>>;
}>;

/**
 * UI-safe, progress-bound answer contract.
 *
 * It contains only original presentation text and canonical book/chapter
 * metadata. Evidence IDs, EPUB locators, unlock thresholds, provider payloads,
 * credentials and raw source passages are deliberately excluded.
 */
export type HoidNarrativeAnswerEnvelope = Readonly<{
  schemaVersion: 1;
  status: "ready";
  domain: HoidNarrativeDomain;
  progressScope: HoidConversationProgressScope;
  bookScope: HoidAnswerBookScope | null;
  displayText: string;
  citations: readonly HoidDisplayCitation[];
  segments?: readonly HoidDisplaySegment[];
  layout?: HoidNarrativeLayout;
  crossBookEvidence?: HoidDisplayCrossBookEvidenceSummary;
  epistemicSummary: HoidNarrativeEpistemicSummary;
}>;

export type HoidNarrativeAbstentionReason =
  | "no-reviewed-evidence"
  | "spoiler-locked"
  | "outside-reading-scope"
  | "ambiguous-request"
  | "progress-changed"
  | "cancelled"
  | "validation-failed"
  | "unavailable";

/** Abstentions have fixed copy; callers cannot attach model/provider prose. */
export type HoidNarrativeAbstentionEnvelope = Readonly<{
  schemaVersion: 1;
  status: "abstained";
  domain: HoidNarrativeDomain;
  progressScope: HoidConversationProgressScope;
  reason: HoidNarrativeAbstentionReason;
  text: string;
}>;

export type HoidNarrativeResponseEnvelope =
  | HoidNarrativeAnswerEnvelope
  | HoidNarrativeAbstentionEnvelope;

const NARRATIVE_ANSWER_ENVELOPES = new WeakSet<object>();

const WORKS = new Map(HOID_SOURCE_BIBLIOGRAPHY.map((work, index) => [
  work.id,
  Object.freeze({ title: work.title, order: index }),
] as const));
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const EPISTEMIC_KINDS = new Set<HoidClaimEpistemicKind>([
  "evidence-backed-assertion",
  "editorial-interpretation",
  "reader-recommendation",
  "unclassified",
]);
const DOMAINS = new Set<HoidNarrativeDomain>([
  "conversation",
  "entity-dossier",
  "entity-relationship",
  "entity-timeline",
  "character-evolution",
  "magic-system",
]);
const ABSTENTION_TEXT: Readonly<Record<HoidNarrativeAbstentionReason, string>> = Object.freeze({
  "no-reviewed-evidence":
    "No hay afirmaciones editoriales verificadas y autorizadas para esta pregunta y tu progreso. Hoid no inventará una explicación.",
  "spoiler-locked":
    "La evidencia necesaria todavía no está desbloqueada en tu progreso de lectura. No mostraré su contenido.",
  "outside-reading-scope":
    "La evidencia disponible queda fuera del ámbito de obras seleccionado. No ampliaré el alcance.",
  "ambiguous-request":
    "No puedo identificar con seguridad el referente o la intención. Necesito una formulación inequívoca.",
  "progress-changed":
    "Tu progreso de lectura cambió durante la consulta. He descartado el resultado completo.",
  cancelled:
    "Consulta cancelada. Hoid ha descartado cualquier resultado parcial o tardío.",
  "validation-failed":
    "La respuesta no superó la validación de procedencia. No mostraré contenido narrativo.",
  unavailable:
    "No puedo verificar el progreso o las fuentes necesarias. No completaré la respuesta mediante suposiciones.",
});

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
    if (
      keys.length < requiredKeys.length ||
      keys.length > allowed.size ||
      keys.some(key => typeof key !== "string" || !allowed.has(key))
    ) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    if (requiredKeys.some(key => !Object.prototype.hasOwnProperty.call(result, key))) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

function denseArray(
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

function safeText(value: unknown, maximum: number): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim() &&
    !/[\u0000-\u0008\u000B-\u001F\u007F\p{Cf}]/u.test(value);
}

function canonicalDomain(value: unknown): HoidNarrativeDomain | null {
  return typeof value === "string" && DOMAINS.has(value as HoidNarrativeDomain)
    ? value as HoidNarrativeDomain
    : null;
}

function canonicalProgressScope(value: unknown): HoidConversationProgressScope | null {
  if (!isHoidConversationProgressScope(value)) return null;
  return Object.freeze({
    revision: value.revision,
    fingerprint: value.fingerprint,
  });
}

function canonicalBookScope(value: unknown): HoidAnswerBookScope | null | undefined {
  if (value === null) return null;
  return canonicalizeHoidAnswerBookScope(value) ?? undefined;
}

function citationKey(citation: HoidDisplayCitation): string {
  return citation.sourceBookId + ":" + String(citation.chapterOrdinal);
}

function sameCitation(left: HoidDisplayCitation, right: HoidDisplayCitation): boolean {
  return left.sourceBookId === right.sourceBookId &&
    left.title === right.title &&
    left.chapter === right.chapter &&
    left.chapterOrdinal === right.chapterOrdinal &&
    left.chapterLabelAmbiguous === right.chapterLabelAmbiguous;
}

function canonicalCitation(value: unknown): HoidDisplayCitation | null {
  const record = exactRecord(value, [
    "sourceBookId",
    "title",
    "chapter",
    "chapterOrdinal",
    "chapterLabelAmbiguous",
  ]);
  if (
    !record ||
    typeof record.sourceBookId !== "string" ||
    !isKnownHoidSource(record.sourceBookId) ||
    typeof record.title !== "string" ||
    WORKS.get(record.sourceBookId)?.title !== record.title ||
    typeof record.chapter !== "number" ||
    !Number.isSafeInteger(record.chapter) ||
    record.chapter < 1 ||
    typeof record.chapterOrdinal !== "number" ||
    !Number.isSafeInteger(record.chapterOrdinal) ||
    record.chapterOrdinal < 1 ||
    typeof record.chapterLabelAmbiguous !== "boolean"
  ) return null;

  const manifestResult = getHoidReadingManifest(record.sourceBookId);
  if (manifestResult.status !== "ready") return null;
  const matchingUnits = manifestResult.manifest.units.filter(
    unit => unit.chapterNumber === record.chapter,
  );
  const exactUnit = matchingUnits.find(unit => unit.ordinal === record.chapterOrdinal);
  if (!exactUnit) return null;
  const isAmbiguous = matchingUnits.length > 1 ||
    manifestResult.manifest.ambiguousChapterNumbers.includes(record.chapter);
  if (record.chapterLabelAmbiguous !== isAmbiguous) return null;

  return Object.freeze({
    sourceBookId: record.sourceBookId,
    title: record.title,
    chapter: record.chapter,
    chapterOrdinal: record.chapterOrdinal,
    chapterLabelAmbiguous: record.chapterLabelAmbiguous,
  });
}

function canonicalCitations(
  value: unknown,
  minimum: number,
): readonly HoidDisplayCitation[] | null {
  const entries = denseArray(value, minimum, 16);
  if (!entries) return null;
  const citations: HoidDisplayCitation[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const citation = canonicalCitation(entry);
    if (!citation) return null;
    const key = citationKey(citation);
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push(citation);
  }
  return Object.freeze(citations);
}

function canonicalSegments(
  value: unknown,
  globalCitations: readonly HoidDisplayCitation[],
): Readonly<{
  segments: readonly HoidDisplaySegment[];
  byKind: Readonly<Record<HoidClaimEpistemicKind, number>>;
}> | null {
  const entries = denseArray(value, 1, 12);
  if (!entries) return null;
  const globalByKey = new Map(globalCitations.map(citation => [
    citationKey(citation),
    citation,
  ]));
  const referenced = new Set<string>();
  const counts: Record<HoidClaimEpistemicKind, number> = {
    "evidence-backed-assertion": 0,
    "editorial-interpretation": 0,
    "reader-recommendation": 0,
    unclassified: 0,
  };
  const segments: HoidDisplaySegment[] = [];
  const seenClaimIds = new Set<string>();

  for (const entry of entries) {
    const record = exactRecord(
      entry,
      ["claimId", "text", "citations"],
      ["epistemicKind", "epistemicLabel"],
    );
    if (
      !record ||
      typeof record.claimId !== "string" ||
      !ID_PATTERN.test(record.claimId) ||
      seenClaimIds.has(record.claimId) ||
      !safeText(record.text, 4_000)
    ) return null;
    seenClaimIds.add(record.claimId);

    const citations = canonicalCitations(record.citations, 1);
    if (!citations) return null;
    for (const citation of citations) {
      const key = citationKey(citation);
      const global = globalByKey.get(key);
      if (!global || !sameCitation(global, citation)) return null;
      referenced.add(key);
    }

    const rawKind = record.epistemicKind;
    const kind = rawKind === undefined
      ? "unclassified"
      : rawKind;
    if (typeof kind !== "string" || !EPISTEMIC_KINDS.has(kind as HoidClaimEpistemicKind)) {
      return null;
    }
    const epistemicKind = kind as HoidClaimEpistemicKind;
    const expectedLabel = labelHoidClaimEpistemicKind(epistemicKind);
    const rawLabel = record.epistemicLabel;
    if (rawLabel !== undefined && rawLabel !== expectedLabel) return null;

    counts[epistemicKind] += 1;
    segments.push(Object.freeze({
      claimId: record.claimId,
      text: record.text,
      citations,
      epistemicKind,
      ...(rawLabel !== undefined
        ? { epistemicLabel: expectedLabel }
        : epistemicKind === "unclassified"
          ? {}
          : { epistemicLabel: expectedLabel }),
    }));
  }

  if (
    referenced.size !== globalCitations.length ||
    globalCitations.some(citation => !referenced.has(citationKey(citation)))
  ) return null;

  return Object.freeze({
    segments: Object.freeze(segments),
    byKind: Object.freeze(counts),
  });
}

function groupWorks(
  citations: readonly HoidDisplayCitation[],
): readonly HoidDisplayCrossBookWorkEvidence[] {
  const grouped = new Map<string, { title: string; chapters: Set<number> }>();
  for (const citation of citations) {
    const current = grouped.get(citation.sourceBookId) ?? {
      title: citation.title,
      chapters: new Set<number>(),
    };
    current.chapters.add(citation.chapter);
    grouped.set(citation.sourceBookId, current);
  }
  return Object.freeze([...grouped.entries()]
    .sort(([left], [right]) =>
      (WORKS.get(left)?.order ?? Number.MAX_SAFE_INTEGER) -
      (WORKS.get(right)?.order ?? Number.MAX_SAFE_INTEGER))
    .map(([sourceBookId, value]) => Object.freeze({
      sourceBookId,
      title: value.title,
      chapters: Object.freeze([...value.chapters].sort((left, right) => left - right)),
    })));
}

function sameWorkLists(
  left: readonly HoidDisplayCrossBookWorkEvidence[],
  right: readonly HoidDisplayCrossBookWorkEvidence[],
): boolean {
  return left.length === right.length && left.every((work, index) => {
    const expected = right[index];
    return Boolean(
      expected &&
      work.sourceBookId === expected.sourceBookId &&
      work.title === expected.title &&
      work.chapters.length === expected.chapters.length &&
      work.chapters.every((chapter, chapterIndex) => chapter === expected.chapters[chapterIndex]),
    );
  });
}

function canonicalCrossBookEvidence(
  value: unknown,
  citations: readonly HoidDisplayCitation[],
  segments: readonly HoidDisplaySegment[],
): HoidDisplayCrossBookEvidenceSummary | null {
  const record = exactRecord(value, ["workCount", "works", "segments"]);
  if (
    !record ||
    typeof record.workCount !== "number" ||
    !Number.isSafeInteger(record.workCount) ||
    record.workCount < 2 ||
    record.workCount > 4
  ) return null;

  const expectedWorks = groupWorks(citations);
  if (expectedWorks.length < 2 || expectedWorks.length > 4) return null;
  const rawWorks = denseArray(record.works, 2, 4);
  const rawSegments = denseArray(record.segments, 1, 12);
  if (
    !rawWorks ||
    !rawSegments ||
    record.workCount !== expectedWorks.length ||
    rawWorks.length !== expectedWorks.length ||
    rawSegments.length !== segments.length
  ) return null;

  const canonicalWorks: HoidDisplayCrossBookWorkEvidence[] = [];
  for (const rawWork of rawWorks) {
    const work = exactRecord(rawWork, ["sourceBookId", "title", "chapters"]);
    if (
      !work ||
      typeof work.sourceBookId !== "string" ||
      !isKnownHoidSource(work.sourceBookId) ||
      typeof work.title !== "string" ||
      WORKS.get(work.sourceBookId)?.title !== work.title
    ) return null;
    const chapters = denseArray(work.chapters, 1, 10_000);
    if (!chapters) return null;
    const chapterNumbers: number[] = [];
    let previous = 0;
    const manifestResult = getHoidReadingManifest(work.sourceBookId);
    if (manifestResult.status !== "ready") return null;
    for (const chapter of chapters) {
      if (
        typeof chapter !== "number" ||
        !Number.isSafeInteger(chapter) ||
        chapter < 1 ||
        chapter <= previous ||
        !manifestResult.manifest.units.some(unit => unit.chapterNumber === chapter)
      ) return null;
      previous = chapter;
      chapterNumbers.push(chapter);
    }
    canonicalWorks.push(Object.freeze({
      sourceBookId: work.sourceBookId,
      title: work.title,
      chapters: Object.freeze(chapterNumbers),
    }));
  }
  if (!sameWorkLists(canonicalWorks, expectedWorks)) return null;

  const canonicalSegments: Array<Readonly<{
    claimId: string;
    works: readonly HoidDisplayCrossBookWorkEvidence[];
  }>> = [];
  for (let index = 0; index < rawSegments.length; index += 1) {
    const segment = exactRecord(rawSegments[index], ["claimId", "works"]);
    const expectedSegment = segments[index];
    if (!segment || segment.claimId !== expectedSegment.claimId) return null;
    const rawSegmentWorks = denseArray(segment.works, 1, 4);
    if (!rawSegmentWorks) return null;
    const segmentWorks: HoidDisplayCrossBookWorkEvidence[] = [];
    for (const rawWork of rawSegmentWorks) {
      const work = exactRecord(rawWork, ["sourceBookId", "title", "chapters"]);
      if (
        !work ||
        typeof work.sourceBookId !== "string" ||
        !isKnownHoidSource(work.sourceBookId) ||
        typeof work.title !== "string" ||
        WORKS.get(work.sourceBookId)?.title !== work.title
      ) return null;
      const chapters = denseArray(work.chapters, 1, 10_000);
      if (!chapters) return null;
      const chapterNumbers: number[] = [];
      let previous = 0;
      const manifestResult = getHoidReadingManifest(work.sourceBookId);
      if (manifestResult.status !== "ready") return null;
      for (const chapter of chapters) {
        if (
          typeof chapter !== "number" ||
          !Number.isSafeInteger(chapter) ||
          chapter < 1 ||
          chapter <= previous ||
          !manifestResult.manifest.units.some(unit => unit.chapterNumber === chapter)
        ) return null;
        previous = chapter;
        chapterNumbers.push(chapter);
      }
      segmentWorks.push(Object.freeze({
        sourceBookId: work.sourceBookId,
        title: work.title,
        chapters: Object.freeze(chapterNumbers),
      }));
    }
    if (!sameWorkLists(segmentWorks, groupWorks(expectedSegment.citations))) return null;
    canonicalSegments.push(Object.freeze({
      claimId: expectedSegment.claimId,
      works: Object.freeze(segmentWorks),
    }));
  }

  return Object.freeze({
    workCount: expectedWorks.length,
    works: Object.freeze(canonicalWorks),
    segments: Object.freeze(canonicalSegments),
  });
}

/** Map a typed route to its stable presentation domain; unknown routes fail closed. */
export function resolveHoidNarrativeDomain(route: unknown): HoidNarrativeDomain | null {
  switch (route) {
    case "conversation": return "conversation";
    case "dossier": return "entity-dossier";
    case "relationship": return "entity-relationship";
    case "timeline": return "entity-timeline";
    case "character-evolution": return "character-evolution";
    case "magic-system": return "magic-system";
    default: return null;
  }
}

/**
 * Canonicalize a ready narrative response at the UI boundary. This does not
 * authorize claims: callers must pass only a projection already returned by
 * the trusted presenter or a specialized evidence-backed adapter.
 */
export function createHoidNarrativeAnswerEnvelope(
  input: unknown,
): HoidNarrativeAnswerEnvelope | null {
  const record = exactRecord(
    input,
    ["domain", "progressScope", "bookScope", "displayText", "citations"],
    ["segments", "layout", "crossBookEvidence"],
  );
  if (!record) return null;

  const domain = canonicalDomain(record.domain);
  const progressScope = canonicalProgressScope(record.progressScope);
  const bookScope = canonicalBookScope(record.bookScope);
  if (
    !domain ||
    !progressScope ||
    bookScope === undefined ||
    !safeText(record.displayText, 32_000)
  ) return null;

  const citations = canonicalCitations(record.citations, 1);
  if (!citations) return null;
  if (bookScope && citations.some(citation => !bookScope.bookIds.includes(citation.sourceBookId))) {
    return null;
  }

  const hasSegments = Object.prototype.hasOwnProperty.call(record, "segments");
  const hasLayout = Object.prototype.hasOwnProperty.call(record, "layout");
  if (hasSegments !== hasLayout) return null;

  let segments: readonly HoidDisplaySegment[] | undefined;
  let layout: HoidNarrativeLayout | undefined;
  let epistemicCounts: Readonly<Record<HoidClaimEpistemicKind, number>> = Object.freeze({
    "evidence-backed-assertion": 0,
    "editorial-interpretation": 0,
    "reader-recommendation": 0,
    unclassified: 0,
  });
  if (hasSegments) {
    if (
      record.layout !== "plain" &&
      record.layout !== "numbered" &&
      record.layout !== "grouped"
    ) return null;
    const canonical = canonicalSegments(record.segments, citations);
    if (!canonical) return null;
    segments = canonical.segments;
    layout = record.layout;
    epistemicCounts = canonical.byKind;
  }

  let crossBookEvidence: HoidDisplayCrossBookEvidenceSummary | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "crossBookEvidence")) {
    if (!segments) return null;
    const canonical = canonicalCrossBookEvidence(record.crossBookEvidence, citations, segments);
    if (!canonical) return null;
    crossBookEvidence = canonical;
  }

  const envelope: HoidNarrativeAnswerEnvelope = Object.freeze({
    schemaVersion: 1,
    status: "ready",
    domain,
    progressScope,
    bookScope,
    displayText: record.displayText,
    citations,
    ...(segments && layout ? { segments, layout } : {}),
    ...(crossBookEvidence ? { crossBookEvidence } : {}),
    epistemicSummary: Object.freeze({
      segmentCount: segments?.length ?? 0,
      byKind: epistemicCounts,
    }),
  });
  NARRATIVE_ANSWER_ENVELOPES.add(envelope);
  return envelope;
}

/** A runtime brand for envelopes produced by the canonical local projector. */
export function isHoidNarrativeAnswerEnvelope(value: unknown): value is HoidNarrativeAnswerEnvelope {
  return value !== null && typeof value === "object" && NARRATIVE_ANSWER_ENVELOPES.has(value as object);
}

/**
 * Create a bounded abstention without accepting arbitrary text from a model,
 * provider, adapter or caller. It is intentionally not an answer projection.
 */
export function createHoidNarrativeAbstentionEnvelope(
  input: unknown,
): HoidNarrativeAbstentionEnvelope | null {
  const record = exactRecord(input, ["domain", "progressScope", "reason"]);
  if (!record) return null;
  const domain = canonicalDomain(record.domain);
  const progressScope = canonicalProgressScope(record.progressScope);
  if (
    !domain ||
    !progressScope ||
    typeof record.reason !== "string" ||
    !Object.prototype.hasOwnProperty.call(ABSTENTION_TEXT, record.reason)
  ) return null;

  const reason = record.reason as HoidNarrativeAbstentionReason;
  return Object.freeze({
    schemaVersion: 1,
    status: "abstained",
    domain,
    progressScope,
    reason,
    text: ABSTENTION_TEXT[reason],
  });
}
