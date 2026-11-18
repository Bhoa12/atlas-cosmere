import { presentHoidEvidenceAnswer, type HoidPresentedCitation } from "./answerPresentation";
import { buildHoidCursorReadingContext } from "./cursorReadingContext";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";
import { sha256Hex } from "./sha256";
import {
  getHoidTopicDefinition,
  getHoidTopicDimensionDefinition,
  validateHoidTopicAssignments,
  HOID_APPROVED_TOPIC_ASSIGNMENTS,
  type HoidTopicAssignment,
  type HoidTopicSubjectKind,
} from "./topicTaxonomy";

export type HoidCrossWorldComparisonEntry = Readonly<{
  subjectKind: HoidTopicSubjectKind;
  subjectId: string;
  worldId: string;
  worldLabel: string;
  claimId: string;
  text: string;
  citations: readonly HoidPresentedCitation[];
}>;

export type HoidCrossWorldComparison = Readonly<{
  comparisonId: string;
  topicId: string;
  topicLabel: string;
  dimensionId: string;
  dimensionLabel: string;
  mode: "side-by-side";
  inference: "none";
  entries: readonly HoidCrossWorldComparisonEntry[];
}>;

export type HoidCrossWorldComparisonResult =
  | Readonly<{ status: "ready"; comparison: HoidCrossWorldComparison }>
  | Readonly<{ status: "not-cross-world" }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-input" | "no-authorized-comparison";
    }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const MAX_ENTRIES = 4;

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.length) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
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

function canonicalDenseEntries(value: unknown): readonly Record<string, unknown>[] | null {
  try {
    if (!Array.isArray(value) || value.length < 2 || value.length > MAX_ENTRIES) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const entries: Record<string, unknown>[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      const entry = canonicalRecord(descriptor.value, ["subjectKind", "subjectId", "answer"]);
      if (!entry) return null;
      if (
        (entry.subjectKind !== "entity" && entry.subjectKind !== "work") ||
        typeof entry.subjectId !== "string" ||
        !ID_PATTERN.test(entry.subjectId)
      ) return null;
      entries.push(entry);
    }
    return Object.freeze(entries);
  } catch {
    return null;
  }
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length &&
    [...left].sort().join("\n") === [...right].sort().join("\n");
}

function citationsMatch(
  actual: readonly HoidPresentedCitation[],
  evidenceIds: readonly string[],
  expected: readonly HoidPresentedCitation[],
): boolean {
  if (actual.length !== evidenceIds.length) return false;
  for (const evidenceId of evidenceIds) {
    const actualCitation = actual.find(item => item.evidenceId === evidenceId);
    const expectedCitation = expected.find(item => item.evidenceId === evidenceId);
    if (
      !actualCitation || !expectedCitation ||
      actualCitation.sourceBookId !== expectedCitation.sourceBookId ||
      actualCitation.sourceChapter !== expectedCitation.sourceChapter ||
      actualCitation.locatorId !== expectedCitation.locatorId ||
      actualCitation.unlockBookId !== expectedCitation.unlockBookId ||
      actualCitation.unlockChapter !== expectedCitation.unlockChapter
    ) return false;
  }
  return true;
}

function findAssignment(
  assignments: readonly HoidTopicAssignment[],
  subjectKind: HoidTopicSubjectKind,
  subjectId: string,
  topicId: string,
  dimensionId: string,
): HoidTopicAssignment | null {
  const matches = assignments.filter(assignment =>
    assignment.subjectKind === subjectKind &&
    assignment.subjectId === subjectId &&
    assignment.topicId === topicId &&
    assignment.dimensionId === dimensionId
  );
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Compares only reviewed, source-backed assignments for the same explicit
 * topic dimension. It presents facts side by side and never infers similarity,
 * equivalence, causality, chronology or a cross-world relationship.
 */
export function compareHoidTopicsAcrossWorlds(
  input: unknown,
  progress: unknown,
  assignmentsInput: unknown = HOID_APPROVED_TOPIC_ASSIGNMENTS,
  approvedClaimsInput?: unknown,
  approvedKnowledgeInput?: unknown,
): HoidCrossWorldComparisonResult {
  const request = canonicalRecord(input, ["topicId", "dimensionId", "entries"]);
  if (!request) return Object.freeze({ status: "unavailable", reason: "invalid-input" });

  const topic = getHoidTopicDefinition(request.topicId);
  const dimension = getHoidTopicDimensionDefinition(request.topicId, request.dimensionId);
  const entries = canonicalDenseEntries(request.entries);
  if (!topic || !dimension || !entries) {
    return Object.freeze({ status: "unavailable", reason: "invalid-input" });
  }

  const subjectKind = entries[0].subjectKind as HoidTopicSubjectKind;
  const seenSubjects = new Set<string>();
  for (const entry of entries) {
    if (entry.subjectKind !== subjectKind) {
      return Object.freeze({ status: "unavailable", reason: "invalid-input" });
    }
    const key = subjectKind + ":" + String(entry.subjectId);
    if (seenSubjects.has(key)) return Object.freeze({ status: "unavailable", reason: "invalid-input" });
    seenSubjects.add(key);
  }

  const validatedAssignments = validateHoidTopicAssignments(assignmentsInput, approvedClaimsInput, approvedKnowledgeInput);
  if (validatedAssignments.status !== "valid") {
    return Object.freeze({ status: "unavailable", reason: "no-authorized-comparison" });
  }
  const reading = buildHoidCursorReadingContext(progress);
  if (reading.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: "no-authorized-comparison" });
  }

  const evidenceById = new Map(validatedAssignments.evidenceCitations.map(citation => [citation.evidenceId, citation]));
  const firstAppearanceByEntity = new Map(validatedAssignments.entityFirstAppearances.map(item => [item.entityId, item]));
  const presentedEntries: HoidCrossWorldComparisonEntry[] = [];
  for (const entry of entries) {
    const assignment = findAssignment(
      validatedAssignments.assignments,
      subjectKind,
      entry.subjectId as string,
      topic.id,
      dimension.id,
    );
    if (!assignment) {
      return Object.freeze({ status: "unavailable", reason: "no-authorized-comparison" });
    }
    if (subjectKind === "entity") {
      const firstAppearance = firstAppearanceByEntity.get(assignment.subjectId);
      const position = firstAppearance
        ? reading.context.positions.find(item => item.bookId === firstAppearance.bookId)
        : undefined;
      const disclosed = Boolean(
        position &&
        (position.status === "completed" ||
          (position.status === "in-progress" && position.currentChapter >= firstAppearance!.chapter)),
      );
      if (!disclosed) {
        return Object.freeze({ status: "unavailable", reason: "no-authorized-comparison" });
      }
    }

    let presentation;
    try {
      presentation = presentHoidEvidenceAnswer(entry.answer as HoidEvidenceAnswer, progress);
    } catch {
      return Object.freeze({ status: "unavailable", reason: "no-authorized-comparison" });
    }
    if (
      presentation.status !== "ready" ||
      !presentation.segments ||
      presentation.segments.length !== 1 ||
      presentation.claimIds.length !== 1 ||
      presentation.claimIds[0] !== assignment.claimId
    ) return Object.freeze({ status: "unavailable", reason: "no-authorized-comparison" });

    const segment = presentation.segments[0];
    if (
      segment.claimId !== assignment.claimId ||
      sha256Hex(segment.text) !== assignment.claimTextSha256 ||
      !sameIds(segment.evidenceIds, assignment.evidenceIds) ||
      !citationsMatch(
        segment.citations,
        assignment.evidenceIds,
        validatedAssignments.evidenceCitations,
      )
    ) return Object.freeze({ status: "unavailable", reason: "no-authorized-comparison" });

    presentedEntries.push(Object.freeze({
      subjectKind,
      subjectId: assignment.subjectId,
      worldId: assignment.worldId,
      worldLabel: assignment.worldLabel,
      claimId: assignment.claimId,
      text: segment.text,
      citations: Object.freeze([...segment.citations]),
    }));
  }

  if (new Set(presentedEntries.map(entry => entry.worldId)).size < 2) {
    return Object.freeze({ status: "not-cross-world" });
  }

  const comparisonId = sha256Hex(JSON.stringify([
    "hoid-cross-world-comparison-v1",
    topic.id,
    dimension.id,
    presentedEntries.map(entry => [
      entry.subjectKind,
      entry.subjectId,
      entry.worldId,
      entry.claimId,
      entry.citations.map(citation => [
        citation.evidenceId,
        citation.sourceBookId,
        citation.sourceChapter,
        citation.locatorId,
        citation.unlockBookId,
        citation.unlockChapter,
      ]),
    ]),
  ]));

  return Object.freeze({
    status: "ready",
    comparison: Object.freeze({
      comparisonId,
      topicId: topic.id,
      topicLabel: topic.label,
      dimensionId: dimension.id,
      dimensionLabel: dimension.label,
      mode: "side-by-side",
      inference: "none",
      entries: Object.freeze(presentedEntries),
    }),
  });
}

/** Production entry point is bound to the reviewed source-controlled registry. */
export function compareProductionHoidTopicsAcrossWorlds(
  input: unknown,
  progress: unknown,
): HoidCrossWorldComparisonResult {
  return compareHoidTopicsAcrossWorlds(input, progress, HOID_APPROVED_TOPIC_ASSIGNMENTS);
}
