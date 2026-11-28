import {
  isHoidNarrativeAnswerEnvelope,
  type HoidNarrativeAnswerEnvelope,
} from "./narrativeAnswerEnvelope";
import {
  isHoidInvestigationContextPresentation,
  type HoidInvestigationContextReadyPresentation,
} from "./investigationContextPresentation";
import {
  isHoidConversationProgressScope,
  type HoidConversationProgressScope,
} from "./conversationHistoryPolicy";
import { fingerprintHoidInvestigationScope } from "./investigationIdentity";
import { HOID_SOURCE_BIBLIOGRAPHY, isKnownHoidSource } from "./bibliography";
import { getHoidReadingManifest } from "./readingManifest";
import type { HoidDisplayCitation } from "./answerDisplayProjection";

export type HoidConversationTurnFollowUp = Readonly<{
  dimension: "perspective" | "knowledge" | "capability" | "affiliation" |
    "relationship" | "status" | "motivation" | "cause";
  question: string;
  citations: readonly HoidDisplayCitation[];
}>;

/**
 * One atomic, progress-bound presentation unit for a completed assistant turn.
 * The answer, optional follow-ups and optional investigation links must all
 * describe the same progress snapshot and exact selected-work scope.
 *
 * This is a display contract, not an authorization grant. Narrative claims and
 * relation labels must already have passed their specialized trusted presenters.
 */
export type HoidConversationTurnEnvelope = Readonly<{
  schemaVersion: 1;
  status: "ready";
  progressScope: HoidConversationProgressScope;
  answer: HoidNarrativeAnswerEnvelope;
  followUpQuestions?: readonly HoidConversationTurnFollowUp[];
  investigationContext?: HoidInvestigationContextReadyPresentation;
}>;

const TURN_ENVELOPES = new WeakSet<object>();
const DIMENSIONS = new Set([
  "perspective", "knowledge", "capability", "affiliation",
  "relationship", "status", "motivation", "cause",
]);
const PREDICATES = new Set([
  "related-to", "appears-in", "located-in", "member-of", "uses",
  "participates-in", "created-by", "part-of", "causes", "opposes", "allied-with",
]);
const WORK_TITLES = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title] as const));

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !keys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    return keys.every(key => Object.prototype.hasOwnProperty.call(result, key)) ? result : null;
  } catch {
    return null;
  }
}

function exactRecordWithOptional(
  value: unknown,
  required: readonly string[],
  optional: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const allowed = new Set([...required, ...optional]);
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length < required.length || ownKeys.length > allowed.size) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !allowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    return required.every(key => Object.prototype.hasOwnProperty.call(result, key)) ? result : null;
  } catch {
    return null;
  }
}

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum ||
        Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true) return null;
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) ||
          Number(key) >= value.length) return null;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function safeText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value === value.trim() &&
    value.length > 0 && value.length <= maximum &&
    !/[\u0000-\u001F\u007F\p{Cf}]/u.test(value);
}

function sameProgress(left: unknown, right: unknown): boolean {
  return isHoidConversationProgressScope(left) &&
    isHoidConversationProgressScope(right) &&
    left.revision === right.revision &&
    left.fingerprint === right.fingerprint;
}

function sameCitation(left: HoidDisplayCitation, right: Record<string, unknown>): boolean {
  return left.sourceBookId === right.sourceBookId &&
    left.title === right.title &&
    left.chapter === right.chapter &&
    left.chapterOrdinal === right.chapterOrdinal &&
    left.chapterLabelAmbiguous === right.chapterLabelAmbiguous;
}

function canonicalFollowUps(
  value: unknown,
  answer: HoidNarrativeAnswerEnvelope,
): readonly HoidConversationTurnFollowUp[] | null {
  const entries = denseArray(value, 1, 3);
  if (!entries) return null;
  const seen = new Set<string>();
  const result: HoidConversationTurnFollowUp[] = [];
  for (const raw of entries) {
    const item = exactRecord(raw, ["dimension", "question", "citations"]);
    if (!item || typeof item.dimension !== "string" || !DIMENSIONS.has(item.dimension) ||
        seen.has(item.dimension) || !safeText(item.question, 4_000)) return null;
    const rawCitations = denseArray(item.citations, 1, 16);
    if (!rawCitations) return null;
    const citations: HoidDisplayCitation[] = [];
    for (const rawCitation of rawCitations) {
      const citation = exactRecord(rawCitation, [
        "sourceBookId", "title", "chapter", "chapterOrdinal", "chapterLabelAmbiguous",
      ]);
      if (!citation || !answer.citations.some(approved => sameCitation(approved, citation))) return null;
      const approved = answer.citations.find(candidate => sameCitation(candidate, citation));
      if (!approved) return null;
      if (!citations.includes(approved)) citations.push(approved);
    }
    seen.add(item.dimension);
    result.push(Object.freeze({
      dimension: item.dimension as HoidConversationTurnFollowUp["dimension"],
      question: item.question,
      citations: Object.freeze(citations),
    }));
  }
  return Object.freeze(result);
}

function contextMatchesAnswer(
  context: HoidInvestigationContextReadyPresentation,
  answer: HoidNarrativeAnswerEnvelope,
): boolean {
  if (!answer.bookScope) return false;
  const expectedScope = fingerprintHoidInvestigationScope(
    answer.progressScope.revision,
    answer.progressScope.fingerprint,
    answer.bookScope,
  );
  if (!expectedScope || context.scopeFingerprint !== expectedScope ||
      context.links.length > 8) return false;

  for (const link of context.links) {
    if (!PREDICATES.has(link.predicate) || !safeText(link.leftLabel, 256) ||
        !safeText(link.rightLabel, 256) || !safeText(link.explanation, 2_000) ||
        !safeText(link.followUpQuestion, 4_000) ||
        !Array.isArray(link.sources) || link.sources.length < 1 || link.sources.length > 64) return false;
    for (const source of link.sources) {
      if (!answer.bookScope.bookIds.includes(source.bookId) ||
          !isKnownHoidSource(source.bookId) ||
          WORK_TITLES.get(source.bookId) !== source.bookTitle ||
          !Number.isSafeInteger(source.chapter) || source.chapter < 1 ||
          (source.role !== "relationship" && source.role !== "entity-label")) return false;
      const manifest = getHoidReadingManifest(source.bookId);
      if (manifest.status !== "ready" ||
          !manifest.manifest.units.some(unit => unit.chapterNumber === source.chapter)) return false;
    }
  }
  return true;
}

/**
 * Compose only locally branded answer/context projections. Follow-up questions
 * are copied only when every cited chapter is already cited by the same answer.
 */
export function createHoidConversationTurnEnvelope(input: unknown): HoidConversationTurnEnvelope | null {
  const record = exactRecordWithOptional(
    input,
    ["answer"],
    ["followUpQuestions", "investigationContext"],
  );
  if (!record || !isHoidNarrativeAnswerEnvelope(record.answer)) return null;
  const answer = record.answer;
  const progressScope = Object.freeze({
    revision: answer.progressScope.revision,
    fingerprint: answer.progressScope.fingerprint,
  });

  let followUpQuestions: readonly HoidConversationTurnFollowUp[] | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "followUpQuestions")) {
    followUpQuestions = canonicalFollowUps(record.followUpQuestions, answer) ?? undefined;
    if (!followUpQuestions) return null;
  }

  let investigationContext: HoidInvestigationContextReadyPresentation | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "investigationContext")) {
    if (!isHoidInvestigationContextPresentation(record.investigationContext) ||
        !sameProgress(progressScope, {
          revision: record.investigationContext.progressRevision,
          fingerprint: record.investigationContext.progressFingerprint,
        }) ||
        !contextMatchesAnswer(record.investigationContext, answer)) return null;
    investigationContext = record.investigationContext;
  }

  const envelope: HoidConversationTurnEnvelope = Object.freeze({
    schemaVersion: 1,
    status: "ready",
    progressScope,
    answer,
    ...(followUpQuestions ? { followUpQuestions } : {}),
    ...(investigationContext ? { investigationContext } : {}),
  });
  TURN_ENVELOPES.add(envelope);
  return envelope;
}

/** Runtime brand used by message restoration and UI boundaries. */
export function isHoidConversationTurnEnvelope(value: unknown): value is HoidConversationTurnEnvelope {
  return value !== null && typeof value === "object" && TURN_ENVELOPES.has(value as object);
}
