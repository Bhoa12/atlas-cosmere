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
 * Version 2 policy. The three exact references may belong to different works.
 * Every referenced unit is a prerequisite; no cross-book chronology is inferred.
 */
export type HoidExactUnitEvidencePolicy = Readonly<{
  schemaVersion: 2;
  evidenceId: string;
  source: HoidChapterReference;
  firstSafeAppearance: HoidChapterReference;
  unlock: HoidChapterReference;
}>;

export type HoidExactUnitEvidenceRole = "source" | "firstSafeAppearance" | "unlock";

export type HoidExactUnitEvidenceAuthorization =
  | Readonly<{
      status: "authorized";
      evidenceId: string;
      progressRevision: number;
      completedRequirements: readonly Readonly<{
        role: HoidExactUnitEvidenceRole;
        bookId: string;
        ordinal: number;
        completion: "ordinal-prefix" | "explicit-work-completion";
      }>[];
    }>
  | Readonly<{
      status: "locked";
      reason: "work-not-started" | "required-unit-not-completed" | "unlock-not-reached";
      evidenceId: string;
      progressRevision: number;
      lockedRole: HoidExactUnitEvidenceRole;
      bookId: string;
      requiredOrdinal: number;
      completedThroughOrdinal: number | null;
    }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-policy" | "invalid-snapshot";
    }>;

export type HoidExactUnitEvidenceAuthorizerResult =
  | HoidExactUnitEvidenceAuthorization
  | Readonly<{ status: "unavailable"; reason: "progress-unavailable" }>;

const POLICY_KEYS = new Set([
  "schemaVersion",
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

/** Return a detached, edition-revalidated policy or null. */
export function canonicalizeHoidExactUnitEvidencePolicy(
  value: unknown,
): HoidExactUnitEvidencePolicy | null {
  const record = exactDataRecord(value, POLICY_KEYS);
  if (
    !record ||
    record.schemaVersion !== 2 ||
    typeof record.evidenceId !== "string" ||
    record.evidenceId.length < 1 ||
    record.evidenceId.length > MAX_EVIDENCE_ID_LENGTH ||
    record.evidenceId !== record.evidenceId.trim() ||
    !EVIDENCE_ID_PATTERN.test(record.evidenceId)
  ) return null;

  const source = validateHoidChapterReference(record.source);
  const firstSafeAppearance = validateHoidChapterReference(record.firstSafeAppearance);
  const unlock = validateHoidChapterReference(record.unlock);
  if (
    source.status !== "valid" ||
    firstSafeAppearance.status !== "valid" ||
    unlock.status !== "valid"
  ) return null;

  // Ordinals are comparable only within the same work. If unlock shares a
  // work with a prerequisite, it must not precede that prerequisite.
  if (
    (unlock.reference.bookId === source.reference.bookId &&
      unlock.reference.ordinal < source.reference.ordinal) ||
    (unlock.reference.bookId === firstSafeAppearance.reference.bookId &&
      unlock.reference.ordinal < firstSafeAppearance.reference.ordinal)
  ) return null;

  return Object.freeze({
    schemaVersion: 2,
    evidenceId: record.evidenceId,
    source: source.reference,
    firstSafeAppearance: firstSafeAppearance.reference,
    unlock: unlock.reference,
  });
}

type Completion =
  | Readonly<{
      status: "complete";
      completion: "ordinal-prefix" | "explicit-work-completion";
      completedThroughOrdinal: number | null;
    }>
  | Readonly<{
      status: "incomplete";
      reason: "work-not-started" | "not-yet-completed";
      completedThroughOrdinal: number | null;
    }>
  | Readonly<{ status: "invalid" }>;

function completionFor(
  snapshot: HoidUnitProgressSnapshot,
  reference: HoidChapterReference,
): Completion {
  const position = snapshot.positions.find(item => item.bookId === reference.bookId);
  if (!position) {
    return Object.freeze({
      status: "incomplete",
      reason: "work-not-started",
      completedThroughOrdinal: null,
    });
  }

  if ("completed" in position && position.completed === true) {
    return Object.freeze({
      status: "complete",
      completion: "explicit-work-completion",
      completedThroughOrdinal: null,
    });
  }

  if (!("cursor" in position)) return Object.freeze({ status: "invalid" });
  const cursor = validateHoidUnitProgressCursor(position.cursor);
  if (cursor.status !== "valid" || cursor.cursor.reference.bookId !== reference.bookId) {
    return Object.freeze({ status: "invalid" });
  }

  const completedThroughOrdinal = cursor.boundary.completedThroughOrdinal ?? 0;
  if (completedThroughOrdinal < reference.ordinal) {
    return Object.freeze({
      status: "incomplete",
      reason: "not-yet-completed",
      completedThroughOrdinal: completedThroughOrdinal > 0 ? completedThroughOrdinal : null,
    });
  }

  return Object.freeze({
    status: "complete",
    completion: "ordinal-prefix",
    completedThroughOrdinal,
  });
}

/**
 * Authorize only when the evidence source, first safe appearance and unlock
 * units have all been completed. An open cursor at ordinal N proves only N-1.
 */
export function authorizeHoidExactUnitEvidence(
  snapshotInput: unknown,
  policyInput: unknown,
): HoidExactUnitEvidenceAuthorization {
  const policy = canonicalizeHoidExactUnitEvidencePolicy(policyInput);
  if (!policy) return Object.freeze({ status: "invalid", reason: "invalid-policy" });

  const validation = validateHoidUnitProgressSnapshot(snapshotInput);
  if (validation.status !== "valid") {
    return Object.freeze({ status: "invalid", reason: "invalid-snapshot" });
  }

  const requirements = [
    { role: "source" as const, reference: policy.source },
    { role: "firstSafeAppearance" as const, reference: policy.firstSafeAppearance },
    { role: "unlock" as const, reference: policy.unlock },
  ];
  const completedRequirements: Array<{
    role: HoidExactUnitEvidenceRole;
    bookId: string;
    ordinal: number;
    completion: "ordinal-prefix" | "explicit-work-completion";
  }> = [];

  for (const requirement of requirements) {
    const completion = completionFor(validation.snapshot, requirement.reference);
    if (completion.status === "invalid") {
      return Object.freeze({ status: "invalid", reason: "invalid-snapshot" });
    }
    if (completion.status === "incomplete") {
      return Object.freeze({
        status: "locked",
        reason: completion.reason === "work-not-started"
          ? "work-not-started"
          : requirement.role === "unlock"
            ? "unlock-not-reached"
            : "required-unit-not-completed",
        evidenceId: policy.evidenceId,
        progressRevision: validation.snapshot.revision,
        lockedRole: requirement.role,
        bookId: requirement.reference.bookId,
        requiredOrdinal: requirement.reference.ordinal,
        completedThroughOrdinal: completion.completedThroughOrdinal,
      });
    }
    completedRequirements.push(Object.freeze({
      role: requirement.role,
      bookId: requirement.reference.bookId,
      ordinal: requirement.reference.ordinal,
      completion: completion.completion,
    }));
  }

  return Object.freeze({
    status: "authorized",
    evidenceId: policy.evidenceId,
    progressRevision: validation.snapshot.revision,
    completedRequirements: Object.freeze(completedRequirements),
  });
}

/** Fresh provider-neutral facade over the durable v3 progress coordinator. */
export class HoidExactUnitEvidenceAuthorizer {
  constructor(private readonly coordinator: HoidUnitProgressCoordinator) {}

  subscribe(listener: () => void): () => void {
    return this.coordinator.subscribe(listener);
  }

  async authorize(policy: unknown): Promise<HoidExactUnitEvidenceAuthorizerResult> {
    const refreshed = await this.coordinator.refresh();
    if (refreshed.status !== "ready") {
      return Object.freeze({ status: "unavailable", reason: "progress-unavailable" });
    }
    return authorizeHoidExactUnitEvidence(refreshed.snapshot, policy);
  }
}

export function createHoidExactUnitEvidenceAuthorizer(
  coordinator: HoidUnitProgressCoordinator,
): HoidExactUnitEvidenceAuthorizer {
  return new HoidExactUnitEvidenceAuthorizer(coordinator);
}
