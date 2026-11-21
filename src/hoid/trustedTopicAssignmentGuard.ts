import { isKnownHoidSource } from "./bibliography";
import type { HoidTopicRecommendation } from "./topicRecommendations";
import {
  getHoidTopicDefinition,
  getHoidTopicDimensionDefinition,
  type HoidTopicAssignment,
} from "./topicTaxonomy";
import { sha256Hex } from "./sha256";

const ASSIGNMENT_KEYS = [
  "schemaVersion", "id", "subjectKind", "subjectId", "worldId", "worldLabel",
  "topicId", "dimensionId", "claimId", "claimTextSha256", "evidenceIds", "review",
] as const;
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const WORLD_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const REVIEWER_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/u;
const MAX_ASSIGNMENTS = 512;

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
      if (!descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalSortedIds(value: unknown): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > 16 ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const ids: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string" ||
        !ID_PATTERN.test(descriptor.value) ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      ids.push(descriptor.value);
    }
    const sorted = [...ids].sort();
    if (sorted.some((id, index) => id !== ids[index])) return null;
    return Object.freeze(ids);
  } catch {
    return null;
  }
}

function canonicalAssignment(value: unknown): HoidTopicAssignment | null {
  const raw = exactRecord(value, ASSIGNMENT_KEYS);
  if (!raw || raw.schemaVersion !== 1) return null;

  const id = raw.id;
  const subjectKind = raw.subjectKind;
  const subjectId = raw.subjectId;
  const worldId = raw.worldId;
  const worldLabel = raw.worldLabel;
  const topicId = raw.topicId;
  const dimensionId = raw.dimensionId;
  const claimId = raw.claimId;
  const claimTextSha256 = raw.claimTextSha256;
  const evidenceIds = canonicalSortedIds(raw.evidenceIds);
  const review = exactRecord(raw.review, ["status", "reviewerId", "reviewedAt"]);

  if (
    typeof id !== "string" || !ID_PATTERN.test(id) ||
    (subjectKind !== "entity" && subjectKind !== "work") ||
    typeof subjectId !== "string" || !ID_PATTERN.test(subjectId) ||
    (subjectKind === "work" && !isKnownHoidSource(subjectId)) ||
    typeof worldId !== "string" || !WORLD_ID_PATTERN.test(worldId) ||
    typeof worldLabel !== "string" || worldLabel.length < 1 || worldLabel.length > 80 ||
    worldLabel !== worldLabel.trim() || worldLabel !== worldLabel.normalize("NFC") ||
    /[\u0000-\u001F\u007F]/u.test(worldLabel) ||
    typeof topicId !== "string" || !getHoidTopicDefinition(topicId) ||
    typeof dimensionId !== "string" || !getHoidTopicDimensionDefinition(topicId, dimensionId) ||
    typeof claimId !== "string" || !ID_PATTERN.test(claimId) ||
    typeof claimTextSha256 !== "string" || !SHA_PATTERN.test(claimTextSha256) ||
    !evidenceIds || !review ||
    review.status !== "approved" ||
    typeof review.reviewerId !== "string" || !REVIEWER_PATTERN.test(review.reviewerId) ||
    typeof review.reviewedAt !== "string" ||
    !Number.isFinite(Date.parse(review.reviewedAt))
  ) return null;

  try {
    if (new Date(review.reviewedAt).toISOString() !== review.reviewedAt) return null;
  } catch {
    return null;
  }

  return Object.freeze({
    schemaVersion: 1,
    id,
    subjectKind,
    subjectId,
    worldId,
    worldLabel,
    topicId: topicId as HoidTopicAssignment["topicId"],
    dimensionId: dimensionId as HoidTopicAssignment["dimensionId"],
    claimId,
    claimTextSha256,
    evidenceIds,
    review: Object.freeze({
      status: "approved",
      reviewerId: review.reviewerId,
      reviewedAt: review.reviewedAt,
    }),
  });
}

function canonicalAssignments(value: unknown): readonly HoidTopicAssignment[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ASSIGNMENTS ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const assignments: HoidTopicAssignment[] = [];
    const ids = new Set<string>();
    const subjects = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      const assignment = canonicalAssignment(descriptor.value);
      if (!assignment || ids.has(assignment.id)) return null;
      const subjectKey = [
        assignment.subjectKind, assignment.subjectId,
        assignment.topicId, assignment.dimensionId,
      ].join("\u0000");
      if (subjects.has(subjectKey)) return null;
      ids.add(assignment.id);
      subjects.add(subjectKey);
      assignments.push(assignment);
    }
    return Object.freeze(assignments);
  } catch {
    return null;
  }
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length &&
    left.every((id, index) => id === right[index]);
}

/**
 * Rebinds each candidate work/topic/dimension/claim tuple to the active,
 * locally validated assignment registry. The caller must supply assignments
 * returned by resolveProductionHoidTopicAssignments(); candidate metadata
 * alone is never authority. Claim text and evidence IDs are bound again to
 * the assignment's canonical digest and evidence set.
 */
export function validateHoidTopicRecommendationAssignments(
  recommendations: readonly HoidTopicRecommendation[],
  assignmentsInput: unknown,
): boolean {
  const assignments = canonicalAssignments(assignmentsInput);
  if (!assignments || !Array.isArray(recommendations) ||
    recommendations.length < 1 || recommendations.length > 10
  ) return false;

  for (const recommendation of recommendations) {
    if (!recommendation || !Array.isArray(recommendation.matches) ||
      recommendation.matches.length < 1 || recommendation.matches.length > 16
    ) return false;
    for (const match of recommendation.matches) {
      const matches = assignments.filter(assignment =>
        assignment.subjectKind === "work" &&
        assignment.subjectId === recommendation.sourceId &&
        assignment.topicId === match.topicId &&
        assignment.dimensionId === match.dimensionId &&
        assignment.claimId === match.claimId
      );
      if (matches.length !== 1) return false;
      const assignment = matches[0];
      const citationIds = match.citations.map(citation => citation.evidenceId).sort();
      if (
        assignment.claimTextSha256 !== sha256Hex(match.reasonText) ||
        !sameIds(assignment.evidenceIds, citationIds)
      ) return false;
    }
  }
  return true;
}
