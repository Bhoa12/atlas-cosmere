import {
  canonicalizeHoidExactUnitEvidencePolicy,
  type HoidExactUnitEvidencePolicy,
  type HoidExactUnitEvidenceRole,
} from "./unitEvidenceAuthorizationV2";
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
import { sha256Hex } from "./sha256";

export type HoidExactUnitSpoilerDependencyRequirement = Readonly<{
  evidenceId: string;
  role: HoidExactUnitEvidenceRole;
  reference: HoidChapterReference;
}>;

export type HoidExactUnitSpoilerDependencySet = Readonly<{
  schemaVersion: 1;
  kind: "exact-unit-claim-spoiler-dependencies";
  claimId: string;
  workCount: number;
  requirements: readonly HoidExactUnitSpoilerDependencyRequirement[];
  fingerprint: string;
}>;

export type HoidExactUnitSpoilerDependencyBuildResult =
  | Readonly<{ status: "ready"; dependencySet: HoidExactUnitSpoilerDependencySet }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-shape"
        | "invalid-claim-id"
        | "invalid-policies"
        | "invalid-policy"
        | "duplicate-evidence";
    }>;

export type HoidExactUnitSpoilerDependencyValidation =
  | Readonly<{ status: "valid"; dependencySet: HoidExactUnitSpoilerDependencySet }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-shape" | "invalid-requirements" | "stale-reference" | "fingerprint-mismatch";
    }>;

export type HoidExactUnitSpoilerDependencyEvaluation =
  | Readonly<{
      status: "ready";
      claimId: string;
      dependencyFingerprint: string;
      workCount: number;
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "withheld";
      reason: "prerequisite-not-completed";
      claimId: string;
      dependencyFingerprint: string;
      workCount: number;
      missingRequirementCount: number;
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-dependency-set" | "invalid-progress";
    }>;

const MAX_POLICIES = 16;
const MAX_REQUIREMENTS = MAX_POLICIES * 3;
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const ROLE_ORDER: Readonly<Record<HoidExactUnitEvidenceRole, number>> = Object.freeze({
  source: 0,
  firstSafeAppearance: 1,
  unlock: 2,
});
const ROLES: readonly HoidExactUnitEvidenceRole[] = Object.freeze([
  "source",
  "firstSafeAppearance",
  "unlock",
]);

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
    for (const key of keys) if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    return result;
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
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128 &&
    value === value.trim() && ID_PATTERN.test(value);
}

function compareRequirements(
  left: HoidExactUnitSpoilerDependencyRequirement,
  right: HoidExactUnitSpoilerDependencyRequirement,
): number {
  return left.evidenceId < right.evidenceId ? -1 :
    left.evidenceId > right.evidenceId ? 1 :
    ROLE_ORDER[left.role] - ROLE_ORDER[right.role];
}

function sameReference(left: HoidChapterReference, right: HoidChapterReference): boolean {
  return left.schemaVersion === right.schemaVersion &&
    left.kind === right.kind &&
    left.authority === right.authority &&
    left.bookId === right.bookId &&
    left.chapterNumber === right.chapterNumber &&
    left.ordinal === right.ordinal &&
    left.unitId === right.unitId &&
    left.labelAmbiguous === right.labelAmbiguous &&
    left.identityFingerprint === right.identityFingerprint;
}

function workCountOf(requirements: readonly HoidExactUnitSpoilerDependencyRequirement[]): number {
  return new Set(requirements.map(item => item.reference.bookId)).size;
}

function fingerprintFor(
  claimId: string,
  requirements: readonly HoidExactUnitSpoilerDependencyRequirement[],
): string {
  const payload = JSON.stringify([
    "hoid-exact-unit-spoiler-dependencies-v1",
    claimId,
    requirements.map(item => [
      item.evidenceId,
      item.role,
      item.reference.bookId,
      item.reference.chapterNumber,
      item.reference.ordinal,
      item.reference.unitId,
      item.reference.identityFingerprint,
    ]),
  ]);
  return sha256Hex(typeof payload === "string" ? payload : "[]");
}

function canonicalRequirement(value: unknown): HoidExactUnitSpoilerDependencyRequirement | null {
  const record = exactRecord(value, ["evidenceId", "role", "reference"]);
  if (!record || !validId(record.evidenceId) ||
    (record.role !== "source" && record.role !== "firstSafeAppearance" && record.role !== "unlock")) {
    return null;
  }
  const reference = validateHoidChapterReference(record.reference);
  if (reference.status !== "valid") return null;
  return Object.freeze({
    evidenceId: record.evidenceId,
    role: record.role,
    reference: reference.reference,
  });
}

/**
 * Aggregate every source, first-safe-appearance and unlock prerequisite in a
 * signed exact-unit claim. Multiple prerequisites in the same work are kept;
 * no chapter-number collapsing or cross-work chronology is inferred.
 */
export function buildHoidExactUnitSpoilerDependencySet(
  input: unknown,
): HoidExactUnitSpoilerDependencyBuildResult {
  const record = exactRecord(input, ["claimId", "policies"]);
  if (!record) return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  if (!validId(record.claimId)) return Object.freeze({ status: "invalid", reason: "invalid-claim-id" });
  const rawPolicies = denseArray(record.policies, 1, MAX_POLICIES);
  if (!rawPolicies) return Object.freeze({ status: "invalid", reason: "invalid-policies" });

  const seenEvidence = new Set<string>();
  const requirements: HoidExactUnitSpoilerDependencyRequirement[] = [];
  for (const rawPolicy of rawPolicies) {
    const policy = canonicalizeHoidExactUnitEvidencePolicy(rawPolicy);
    if (!policy) return Object.freeze({ status: "invalid", reason: "invalid-policy" });
    if (seenEvidence.has(policy.evidenceId)) {
      return Object.freeze({ status: "invalid", reason: "duplicate-evidence" });
    }
    seenEvidence.add(policy.evidenceId);
    for (const role of ROLES) {
      requirements.push(Object.freeze({
        evidenceId: policy.evidenceId,
        role,
        reference: policy[role],
      }));
    }
  }

  requirements.sort(compareRequirements);
  const frozenRequirements = Object.freeze(requirements);
  const dependencySet: HoidExactUnitSpoilerDependencySet = Object.freeze({
    schemaVersion: 1,
    kind: "exact-unit-claim-spoiler-dependencies",
    claimId: record.claimId,
    workCount: workCountOf(frozenRequirements),
    requirements: frozenRequirements,
    fingerprint: fingerprintFor(record.claimId, frozenRequirements),
  });
  return Object.freeze({ status: "ready", dependencySet });
}

/** Revalidate exact chapter identities, role coverage, canonical order and digest. */
export function validateHoidExactUnitSpoilerDependencySet(
  input: unknown,
): HoidExactUnitSpoilerDependencyValidation {
  const record = exactRecord(input, [
    "schemaVersion", "kind", "claimId", "workCount", "requirements", "fingerprint",
  ]);
  if (!record || record.schemaVersion !== 1 ||
    record.kind !== "exact-unit-claim-spoiler-dependencies" ||
    !validId(record.claimId) ||
    typeof record.workCount !== "number" || !Number.isSafeInteger(record.workCount) ||
    record.workCount < 1 || record.workCount > 24 ||
    typeof record.fingerprint !== "string" || !SHA_PATTERN.test(record.fingerprint)) {
    return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  }

  const rawRequirements = denseArray(record.requirements, 3, MAX_REQUIREMENTS);
  if (!rawRequirements || rawRequirements.length % 3 !== 0) {
    return Object.freeze({ status: "invalid", reason: "invalid-requirements" });
  }

  const requirements: HoidExactUnitSpoilerDependencyRequirement[] = [];
  const rolesByEvidence = new Map<string, Set<HoidExactUnitEvidenceRole>>();
  for (const raw of rawRequirements) {
    const requirement = canonicalRequirement(raw);
    if (!requirement) return Object.freeze({ status: "invalid", reason: "stale-reference" });
    let roles = rolesByEvidence.get(requirement.evidenceId);
    if (!roles) {
      roles = new Set<HoidExactUnitEvidenceRole>();
      rolesByEvidence.set(requirement.evidenceId, roles);
    }
    if (roles.has(requirement.role)) {
      return Object.freeze({ status: "invalid", reason: "invalid-requirements" });
    }
    roles.add(requirement.role);
    requirements.push(requirement);
  }

  if ([...rolesByEvidence.values()].some(roles =>
    roles.size !== 3 || ROLES.some(role => !roles.has(role))
  )) return Object.freeze({ status: "invalid", reason: "invalid-requirements" });

  const canonical = [...requirements].sort(compareRequirements);
  if (canonical.some((item, index) => {
    const actual = requirements[index];
    return !actual || item.evidenceId !== actual.evidenceId || item.role !== actual.role ||
      !sameReference(item.reference, actual.reference);
  })) return Object.freeze({ status: "invalid", reason: "invalid-requirements" });

  const frozenRequirements = Object.freeze(canonical);
  const workCount = workCountOf(frozenRequirements);
  if (workCount !== record.workCount) {
    return Object.freeze({ status: "invalid", reason: "invalid-requirements" });
  }
  const fingerprint = fingerprintFor(record.claimId, frozenRequirements);
  if (fingerprint !== record.fingerprint) {
    return Object.freeze({ status: "invalid", reason: "fingerprint-mismatch" });
  }

  return Object.freeze({
    status: "valid",
    dependencySet: Object.freeze({
      schemaVersion: 1,
      kind: "exact-unit-claim-spoiler-dependencies",
      claimId: record.claimId,
      workCount,
      requirements: frozenRequirements,
      fingerprint,
    }),
  });
}

/**
 * Evaluate exact edition-bound prerequisites against a v3 cursor ledger.
 * An open cursor at ordinal N proves only the prefix through N-1.
 */
export function evaluateHoidExactUnitSpoilerDependencies(
  dependencySetInput: unknown,
  progressInput: unknown,
): HoidExactUnitSpoilerDependencyEvaluation {
  const validation = validateHoidExactUnitSpoilerDependencySet(dependencySetInput);
  if (validation.status !== "valid") {
    return Object.freeze({ status: "invalid", reason: "invalid-dependency-set" });
  }
  const progress = validateHoidUnitProgressSnapshot(progressInput);
  if (progress.status !== "valid") {
    return Object.freeze({ status: "invalid", reason: "invalid-progress" });
  }

  const progressFingerprint = sha256Hex(JSON.stringify(progress.snapshot));
  let missingRequirementCount = 0;
  for (const requirement of validation.dependencySet.requirements) {
    const position = progress.snapshot.positions.find(item =>
      item.bookId === requirement.reference.bookId
    );
    if (!position) {
      missingRequirementCount += 1;
      continue;
    }
    if ("completed" in position && position.completed === true) continue;
    if (!("cursor" in position)) {
      return Object.freeze({ status: "invalid", reason: "invalid-progress" });
    }
    const cursor = validateHoidUnitProgressCursor(position.cursor);
    if (cursor.status !== "valid" || cursor.cursor.reference.bookId !== position.bookId) {
      return Object.freeze({ status: "invalid", reason: "invalid-progress" });
    }
    const completedThroughOrdinal = cursor.boundary.completedThroughOrdinal ?? 0;
    if (completedThroughOrdinal < requirement.reference.ordinal) missingRequirementCount += 1;
  }

  const common = {
    claimId: validation.dependencySet.claimId,
    dependencyFingerprint: validation.dependencySet.fingerprint,
    workCount: validation.dependencySet.workCount,
    progressRevision: progress.snapshot.revision,
    progressFingerprint,
  };
  if (missingRequirementCount > 0) {
    return Object.freeze({
      status: "withheld",
      reason: "prerequisite-not-completed",
      ...common,
      missingRequirementCount,
    });
  }
  return Object.freeze({ status: "ready", ...common });
}
