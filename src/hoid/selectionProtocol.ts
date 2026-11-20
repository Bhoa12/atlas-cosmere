import type { HoidApprovedClaimIntent } from "./approvedClaimIntegrity";
import { sha256Hex } from "./sha256";
import type { HoidAnswerSelectionBudget, ReadingPosition } from "./types";

export type HoidClaimSelectionCandidate = Readonly<{
  id: string;
  text: string;
  evidenceIds: readonly string[];
}>;

export type HoidClaimSelectionRequest = Readonly<{
  schemaVersion: 1;
  requestFingerprint: string;
  question: string;
  intent: HoidApprovedClaimIntent;
  candidates: readonly HoidClaimSelectionCandidate[];
  selectionBudget: HoidAnswerSelectionBudget;
}>;

export type HoidClaimSelectionResponse = Readonly<{
  schemaVersion: 1;
  requestFingerprint: string;
  claimIds: readonly string[];
}>;

const CLAIM_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const MAX_CLAIM_ID_LENGTH = 128;

type CreateRequestInput = Readonly<{
  question: string;
  intent: HoidApprovedClaimIntent;
  candidates: readonly HoidClaimSelectionCandidate[];
  selectionBudget: HoidAnswerSelectionBudget;
  reading: readonly ReadingPosition[];
}>;

/**
 * The fingerprint binds question, intent, authorized candidates, budget and
 * normalized progress. Raw reading positions are deliberately not sent to
 * the selector. This is a freshness binding, not provider authentication.
 */
export function createHoidClaimSelectionRequest(
  input: CreateRequestInput,
): HoidClaimSelectionRequest {
  const candidates = Object.freeze(input.candidates.map(candidate => Object.freeze({
    id: candidate.id,
    text: candidate.text,
    evidenceIds: Object.freeze([...candidate.evidenceIds]),
  })));
  const selectionBudget = Object.freeze({
    maxClaims: input.selectionBudget.maxClaims,
    maxEvidence: input.selectionBudget.maxEvidence,
    maxWorks: input.selectionBudget.maxWorks,
    maxCharacters: input.selectionBudget.maxCharacters,
    minimumWorks: input.selectionBudget.minimumWorks,
    requireSegmentProvenance: input.selectionBudget.requireSegmentProvenance,
    requireCrossWorkSegment: input.selectionBudget.requireCrossWorkSegment,
  });
  const readingSnapshot = input.reading.map(position => ({
    bookId: position.bookId,
    chapter: typeof position.chapter === "number" ? position.chapter : null,
    completed: position.completed === true,
    order: typeof position.order === "number" ? position.order : null,
  })).sort((left, right) =>
    left.bookId < right.bookId ? -1 : left.bookId > right.bookId ? 1 : 0
  );
  const requestFingerprint = sha256Hex(JSON.stringify({
    protocol: "hoid.claim-selection",
    schemaVersion: 1,
    question: input.question,
    intent: input.intent,
    reading: readingSnapshot,
    selectionBudget,
    candidates: candidates.map(candidate => ({
      id: candidate.id,
      text: candidate.text,
      evidenceIds: [...candidate.evidenceIds],
    })),
  }));

  return Object.freeze({
    schemaVersion: 1,
    requestFingerprint,
    question: input.question,
    intent: input.intent,
    candidates,
    selectionBudget,
  });
}

export function createHoidClaimSelectionResponse(
  request: HoidClaimSelectionRequest,
  claimIds: readonly string[],
): HoidClaimSelectionResponse {
  return Object.freeze({
    schemaVersion: 1,
    requestFingerprint: request.requestFingerprint,
    claimIds: Object.freeze([...claimIds]),
  });
}

function exactResponseRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 3) return null;
    const record = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (
        typeof key !== "string" ||
        !["schemaVersion", "requestFingerprint", "claimIds"].includes(key)
      ) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }
    if (
      !Object.prototype.hasOwnProperty.call(record, "schemaVersion") ||
      !Object.prototype.hasOwnProperty.call(record, "requestFingerprint") ||
      !Object.prototype.hasOwnProperty.call(record, "claimIds")
    ) return null;
    return record;
  } catch {
    return null;
  }
}

export function parseHoidClaimSelectionResponse(
  value: unknown,
  request: HoidClaimSelectionRequest,
  maximumClaims: number,
): readonly string[] | null {
  const record = exactResponseRecord(value);
  if (!record) return null;
  if (
    record.schemaVersion !== 1 ||
    typeof record.requestFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(record.requestFingerprint) ||
    record.requestFingerprint !== request.requestFingerprint
  ) return null;

  const rawIds = record.claimIds;
  if (
    !Array.isArray(rawIds) ||
    rawIds.length < 1 ||
    rawIds.length > maximumClaims ||
    !Number.isSafeInteger(maximumClaims) ||
    maximumClaims < 1
  ) return null;

  try {
    if (Object.getPrototypeOf(rawIds) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(rawIds);
    if (keys.length !== rawIds.length + 1 || !keys.includes("length")) return null;
    const ids: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < rawIds.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(rawIds, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string"
      ) return null;
      const id = descriptor.value;
      if (
        id !== id.trim() ||
        id.length < 1 ||
        id.length > MAX_CLAIM_ID_LENGTH ||
        !CLAIM_ID_PATTERN.test(id) ||
        seen.has(id)
      ) return null;
      seen.add(id);
      ids.push(id);
    }
    return Object.freeze(ids);
  } catch {
    return null;
  }
}
