import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { resolveProductionHoidTopicAssignments } from "./topicAssignmentActivation";
import { presentHoidEvidenceAnswer, type HoidPresentedCitation } from "./answerPresentation";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";
import { buildHoidCursorReadingContext } from "./cursorReadingContext";
import { sha256Hex } from "./sha256";
import { canonicalEvidenceScope, type HoidEvidenceCitation } from "./evidenceScope";
import {
  getHoidTopicDefinition,
  getHoidTopicDimensionDefinition,
  validateHoidTopicAssignments,
  type HoidTopicAssignment,
} from "./topicTaxonomy";

export type HoidTopicRecommendationMatch = Readonly<{
  topicId: string;
  topicLabel: string;
  dimensionId: string;
  dimensionLabel: string;
  claimId: string;
  reasonText: string;
  citations: readonly HoidPresentedCitation[];
}>;

export type HoidTopicRecommendation = Readonly<{
  sourceId: string;
  title: string;
  reason: "reviewed-topic-match";
  matches: readonly HoidTopicRecommendationMatch[];
}>;

export type HoidTopicRecommendationResult =
  | Readonly<{ status: "ready"; items: readonly HoidTopicRecommendation[] }>
  | Readonly<{
      status: "none";
      reason: "no-selected-topics" | "no-safe-reviewed-matches";
    }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-input" | "invalid-progress" | "invalid-assignments" | "invalid-answers";
    }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const MAX_SELECTED_TOPICS = 8;
const MAX_ANSWERS = 512;
const MAX_RECOMMENDATIONS = 10;

function canonicalDenseStrings(value: unknown, maximum: number): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length > maximum || Object.getPrototypeOf(value) !== Array.prototype) return null;
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

function canonicalRecord(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> | null {
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
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalAnswers(value: unknown): ReadonlyMap<string, unknown> | null {
  try {
    if (!Array.isArray(value) || value.length > MAX_ANSWERS || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const answers = new Map<string, unknown>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      const record = canonicalRecord(descriptor.value, ["claimId", "answer"]);
      if (!record || typeof record.claimId !== "string" || !ID_PATTERN.test(record.claimId) || answers.has(record.claimId)) {
        return null;
      }
      answers.set(record.claimId, record.answer);
    }
    return answers;
  } catch {
    return null;
  }
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length &&
    [...left].sort().join("\n") === [...right].sort().join("\n");
}

function readDataProperty(value: unknown, key: string): unknown {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      descriptor.enumerable !== true
    ) return undefined;
    return descriptor.value;
  } catch {
    return undefined;
  }
}

function canonicalSourceRecords(answer: unknown): readonly Record<string, unknown>[] | null {
  try {
    const sources = readDataProperty(answer, "sources");
    if (!Array.isArray(sources) || sources.length < 1 || sources.length > 16) return null;
    if (Object.getPrototypeOf(sources) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(sources);
    if (keys.length !== sources.length + 1 || !keys.includes("length")) return null;
    const records: Record<string, unknown>[] = [];
    for (let index = 0; index < sources.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(sources, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      const record = canonicalRecord(descriptor.value, [
        "evidenceId", "sourceBookId", "sourceChapter", "locatorId", "unlockBookId", "unlockChapter",
      ]);
      if (!record) return null;
      records.push(record);
    }
    return records;
  } catch {
    return null;
  }
}

function sourceScopesMatch(
  answer: unknown,
  evidenceIds: readonly string[],
  expected: readonly HoidEvidenceCitation[],
): boolean {
  const records = canonicalSourceRecords(answer);
  if (!records || records.length !== evidenceIds.length) return false;
  for (const evidenceId of evidenceIds) {
    const record = records.find(item => item.evidenceId === evidenceId);
    const citation = expected.find(item => item.evidenceId === evidenceId);
    if (!record || !citation) return false;
    const scope = canonicalEvidenceScope(
      { bookId: record.sourceBookId, chapter: record.sourceChapter, locatorId: record.locatorId },
      { bookId: record.unlockBookId, chapter: record.unlockChapter },
    );
    if (
      !scope ||
      scope.sourceBookId !== citation.sourceBookId ||
      scope.sourceChapter !== citation.sourceChapter ||
      scope.locatorId !== citation.locatorId ||
      scope.unlockBookId !== citation.unlockBookId ||
      scope.unlockChapter !== citation.unlockChapter
    ) return false;
  }
  return true;
}

function presentationCitationsMatch(
  actual: readonly HoidPresentedCitation[],
  evidenceIds: readonly string[],
  expected: readonly HoidEvidenceCitation[],
): boolean {
  if (actual.length !== evidenceIds.length) return false;
  for (const evidenceId of evidenceIds) {
    const actualCitation = actual.find(item => item.evidenceId === evidenceId);
    const expectedCitation = expected.find(item => item.evidenceId === evidenceId);
    const expectedTitle = expectedCitation
      ? HOID_SOURCE_BIBLIOGRAPHY.find(work => work.id === expectedCitation.sourceBookId)?.title
      : undefined;
    if (
      !actualCitation || !expectedCitation ||
      actualCitation.sourceBookId !== expectedCitation.sourceBookId ||
      actualCitation.chapter !== expectedCitation.sourceChapter ||
      actualCitation.locatorId !== expectedCitation.locatorId ||
      actualCitation.title !== expectedTitle
    ) return false;
  }
  return true;
}

function assignmentMatchesAnswer(
  assignment: HoidTopicAssignment,
  answer: unknown,
  progress: unknown,
  approvedEvidence: readonly HoidEvidenceCitation[],
): HoidTopicRecommendationMatch | null | "invalid" {
  let presentation: ReturnType<typeof presentHoidEvidenceAnswer>;
  try {
    presentation = presentHoidEvidenceAnswer(answer as HoidEvidenceAnswer, progress);
  } catch {
    return "invalid";
  }
  if (presentation.status !== "ready") {
    // Treat every withheld answer as unavailable. Do not inspect raw fields
    // after the presentation boundary, because they may contain accessors.
    return null;
  }
  if (
    !presentation.segments ||
    presentation.segments.length !== 1 ||
    presentation.claimIds.length !== 1 ||
    presentation.claimIds[0] !== assignment.claimId
  ) return "invalid";

  const segment = presentation.segments[0];
  if (
    segment.claimId !== assignment.claimId ||
    sha256Hex(segment.text) !== assignment.claimTextSha256 ||
    !sameIds(segment.evidenceIds, assignment.evidenceIds) ||
    !sourceScopesMatch(answer, assignment.evidenceIds, approvedEvidence) ||
    !presentationCitationsMatch(segment.citations, assignment.evidenceIds, approvedEvidence)
  ) return "invalid";

  return Object.freeze({
    topicId: assignment.topicId,
    topicLabel: getHoidTopicDefinition(assignment.topicId)!.label,
    dimensionId: assignment.dimensionId,
    dimensionLabel: getHoidTopicDimensionDefinition(assignment.topicId, assignment.dimensionId)!.label,
    claimId: assignment.claimId,
    reasonText: segment.text,
    citations: Object.freeze([...segment.citations]),
  });
}

/**
 * Recommends only unstarted catalogue works whose exact topic association is
 * backed by an approved assignment and evidence already unlocked elsewhere.
 * Topic interests must be explicit input; they are never inferred from reading
 * history, embeddings or provider output.
 */
export function composeHoidTopicRecommendations(
  selectedTopicIdsInput: unknown,
  progress: unknown,
  answersInput: unknown,
  limit = 5,
  assignmentsInput: unknown = HOID_APPROVED_TOPIC_ASSIGNMENTS,
  approvedClaimsInput?: unknown,
  approvedKnowledgeInput?: unknown,
): HoidTopicRecommendationResult {
  const selectedTopicIds = canonicalDenseStrings(selectedTopicIdsInput, MAX_SELECTED_TOPICS);
  if (!selectedTopicIds || selectedTopicIds.some(id => !getHoidTopicDefinition(id))) {
    return Object.freeze({ status: "invalid", reason: "invalid-input" });
  }
  if (selectedTopicIds.length === 0) {
    return Object.freeze({ status: "none", reason: "no-selected-topics" });
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_RECOMMENDATIONS) {
    return Object.freeze({ status: "invalid", reason: "invalid-input" });
  }

  const reading = buildHoidCursorReadingContext(progress);
  if (reading.status !== "ready") return Object.freeze({ status: "invalid", reason: "invalid-progress" });

  const assignments = validateHoidTopicAssignments(assignmentsInput, approvedClaimsInput, approvedKnowledgeInput);
  if (assignments.status !== "valid") return Object.freeze({ status: "invalid", reason: "invalid-assignments" });

  const answers = canonicalAnswers(answersInput);
  if (!answers) return Object.freeze({ status: "invalid", reason: "invalid-answers" });

  const started = new Set(reading.context.positions.map(position => position.bookId));
  const topicOrder = new Map(selectedTopicIds.map((id, index) => [id, index]));
  const workOrder = new Map(HOID_SOURCE_BIBLIOGRAPHY.map((work, index) => [work.id, index]));
  const grouped = new Map<string, {
    title: string;
    priority: number;
    matches: HoidTopicRecommendationMatch[];
  }>();

  const candidates = [...assignments.assignments]
    .filter(assignment =>
      assignment.subjectKind === "work" &&
      topicOrder.has(assignment.topicId) &&
      !started.has(assignment.subjectId)
    )
    .sort((left, right) =>
      topicOrder.get(left.topicId)! - topicOrder.get(right.topicId)! ||
      workOrder.get(left.subjectId)! - workOrder.get(right.subjectId)! ||
      left.dimensionId.localeCompare(right.dimensionId)
    );

  for (const assignment of candidates) {
    const answer = answers.get(assignment.claimId);
    if (answer === undefined) continue;
    const match = assignmentMatchesAnswer(assignment, answer, progress, assignments.evidenceCitations);
    if (match === "invalid") {
      return Object.freeze({ status: "invalid", reason: "invalid-answers" });
    }
    if (!match) continue;

    // An unstarted target work cannot authorize its own chapter evidence.
    if (match.citations.some(citation => citation.sourceBookId === assignment.subjectId)) continue;

    let group = grouped.get(assignment.subjectId);
    if (!group) {
      group = {
        title: HOID_SOURCE_BIBLIOGRAPHY[workOrder.get(assignment.subjectId)!].title,
        priority: topicOrder.get(assignment.topicId)!,
        matches: [],
      };
      grouped.set(assignment.subjectId, group);
    }
    group.priority = Math.min(group.priority, topicOrder.get(assignment.topicId)!);
    group.matches.push(match);
  }

  const items = [...grouped.entries()]
    .sort(([leftId, left], [rightId, right]) =>
      left.priority - right.priority ||
      workOrder.get(leftId)! - workOrder.get(rightId)!
    )
    .slice(0, limit)
    .map(([sourceId, group]) => Object.freeze({
      sourceId,
      title: group.title,
      reason: "reviewed-topic-match" as const,
      matches: Object.freeze(group.matches),
    }));

  return items.length > 0
    ? Object.freeze({ status: "ready", items: Object.freeze(items) })
    : Object.freeze({ status: "none", reason: "no-safe-reviewed-matches" });
}

/**
 * Production entry point requires a registry fingerprinted by a post-merge
 * activation receipt. An unactivated registry never reaches the composer.
 */
export function composeProductionHoidTopicRecommendations(
  selectedTopicIds: unknown,
  progress: unknown,
  answers: unknown,
  limit = 5,
): HoidTopicRecommendationResult {
  const activation = resolveProductionHoidTopicAssignments();
  if (activation.status !== "active") {
    return Object.freeze({ status: "none", reason: "no-safe-reviewed-matches" });
  }
  return composeHoidTopicRecommendations(
    selectedTopicIds,
    progress,
    answers,
    limit,
    activation.assignments,
  );
}
