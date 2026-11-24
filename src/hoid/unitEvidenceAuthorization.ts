import {
  validateHoidChapterReference,
  type HoidChapterReference,
} from "./chapterReference";
import {
  validateHoidUnitProgressCursor,
} from "./unitProgressCursor";
import {
  validateHoidUnitProgressSnapshot,
  type HoidUnitProgressSnapshot,
} from "./unitProgressLedger";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";

/**
 * Exact, edition-bound editorial policy for one evidence item.
 *
 * All three references identify numbered units in the same work. The unlock
 * reference is the first completed unit at which the entire evidence summary
 * may be used. No numeric chapter projection is accepted at this boundary.
 */
export type HoidUnitEvidencePolicy = Readonly<{
  evidenceId: string;
  source: HoidChapterReference;
  firstSafeAppearance: HoidChapterReference;
  unlock: HoidChapterReference;
}>;

export type HoidUnitEvidenceAuthorization =
  | Readonly<{
      status: "authorized";
      evidenceId: string;
      bookId: string;
      progressRevision: number;
      completedThroughOrdinal: number | null;
      explicitlyCompleted: boolean;
    }>
  | Readonly<{
      status: "locked";
      reason: "work-not-started" | "unlock-not-reached";
      evidenceId: string;
      bookId: string;
      progressRevision: number;
      completedThroughOrdinal: number | null;
    }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-policy" | "invalid-snapshot";
    }>;

export type HoidUnitEvidenceAuthorizerResult =
  | HoidUnitEvidenceAuthorization
  | Readonly<{ status: "unavailable"; reason: "progress-unavailable" }>;

const POLICY_KEYS = new Set([
  "evidenceId",
  "source",
  "firstSafeAppearance",
  "unlock",
]);
const EVIDENCE_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const MAX_EVIDENCE_ID_LENGTH = 128;

function exactDataRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.size) return null;

    const record = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }
    for (const key of allowedKeys) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) return null;
    }
    return record;
  } catch {
    return null;
  }
}

function canonicalPolicy(value: unknown): HoidUnitEvidencePolicy | null {
  const record = exactDataRecord(value, POLICY_KEYS);
  if (!record) return null;

  const evidenceId = record.evidenceId;
  if (
    typeof evidenceId !== "string" ||
    evidenceId.length < 1 ||
    evidenceId.length > MAX_EVIDENCE_ID_LENGTH ||
    evidenceId !== evidenceId.trim() ||
    !EVIDENCE_ID_PATTERN.test(evidenceId)
  ) return null;

  const source = validateHoidChapterReference(record.source);
  const firstSafeAppearance = validateHoidChapterReference(record.firstSafeAppearance);
  const unlock = validateHoidChapterReference(record.unlock);
  if (
    source.status !== "valid" ||
    firstSafeAppearance.status !== "valid" ||
    unlock.status !== "valid"
  ) return null;

  const bookId = source.reference.bookId;
  if (
    firstSafeAppearance.reference.bookId !== bookId ||
    unlock.reference.bookId !== bookId ||
    unlock.reference.ordinal < source.reference.ordinal ||
    unlock.reference.ordinal < firstSafeAppearance.reference.ordinal
  ) return null;

  return Object.freeze({
    evidenceId,
    source: source.reference,
    firstSafeAppearance: firstSafeAppearance.reference,
    unlock: unlock.reference,
  });
}

/**
 * Authorize one evidence item against a validated v3 exact-unit snapshot.
 *
 * The open cursor is never counted as completed: a cursor at ordinal N grants
 * only the verified prefix through N-1. Whole-work completion is accepted only
 * as the explicit attestation stored by the v3 ledger.
 */
export function authorizeHoidUnitEvidence(
  snapshotInput: unknown,
  policyInput: unknown,
): HoidUnitEvidenceAuthorization {
  const policy = canonicalPolicy(policyInput);
  if (!policy) return Object.freeze({ status: "invalid", reason: "invalid-policy" });

  const validation = validateHoidUnitProgressSnapshot(snapshotInput);
  if (validation.status !== "valid") {
    return Object.freeze({ status: "invalid", reason: "invalid-snapshot" });
  }
  const snapshot: HoidUnitProgressSnapshot = validation.snapshot;
  const bookId = policy.source.bookId;
  const position = snapshot.positions.find(item => item.bookId === bookId);

  if (!position) {
    return Object.freeze({
      status: "locked",
      reason: "work-not-started",
      evidenceId: policy.evidenceId,
      bookId,
      progressRevision: snapshot.revision,
      completedThroughOrdinal: null,
    });
  }

  if ("completed" in position && position.completed === true) {
    return Object.freeze({
      status: "authorized",
      evidenceId: policy.evidenceId,
      bookId,
      progressRevision: snapshot.revision,
      completedThroughOrdinal: null,
      explicitlyCompleted: true,
    });
  }

  if (!("cursor" in position)) {
    return Object.freeze({ status: "invalid", reason: "invalid-snapshot" });
  }
  const cursor = validateHoidUnitProgressCursor(position.cursor);
  if (
    cursor.status !== "valid" ||
    cursor.cursor.reference.bookId !== bookId
  ) return Object.freeze({ status: "invalid", reason: "invalid-snapshot" });

  const completedThroughOrdinal = cursor.boundary.completedThroughOrdinal ?? 0;
  if (completedThroughOrdinal < policy.unlock.ordinal) {
    return Object.freeze({
      status: "locked",
      reason: "unlock-not-reached",
      evidenceId: policy.evidenceId,
      bookId,
      progressRevision: snapshot.revision,
      completedThroughOrdinal: completedThroughOrdinal > 0 ? completedThroughOrdinal : null,
    });
  }

  return Object.freeze({
    status: "authorized",
    evidenceId: policy.evidenceId,
    bookId,
    progressRevision: snapshot.revision,
    completedThroughOrdinal,
    explicitlyCompleted: false,
  });
}

/**
 * Fresh, provider-neutral authorization facade over the v3 coordinator.
 *
 * It always refreshes durable progress before authorizing. Consumers must
 * subscribe to invalidation and reauthorize again immediately before
 * presentation after any asynchronous provider/selector work.
 */
export class HoidUnitEvidenceAuthorizer {
  constructor(private readonly coordinator: HoidUnitProgressCoordinator) {}

  subscribe(listener: () => void): () => void {
    return this.coordinator.subscribe(listener);
  }

  async authorize(policy: unknown): Promise<HoidUnitEvidenceAuthorizerResult> {
    const refreshed = await this.coordinator.refresh();
    if (refreshed.status !== "ready") {
      return Object.freeze({ status: "unavailable", reason: "progress-unavailable" });
    }
    return authorizeHoidUnitEvidence(refreshed.snapshot, policy);
  }
}

export function createHoidUnitEvidenceAuthorizer(
  coordinator: HoidUnitProgressCoordinator,
): HoidUnitEvidenceAuthorizer {
  return new HoidUnitEvidenceAuthorizer(coordinator);
}
