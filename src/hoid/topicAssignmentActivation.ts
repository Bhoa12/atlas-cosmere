import { HOID_APPROVED_TOPIC_ASSIGNMENTS } from "./topicTaxonomy";
import type { HoidTopicAssignment } from "./topicTaxonomy";
import {
  authorizeHoidTopicAssignmentPromotion,
  fingerprintHoidTopicAssignmentRegistry,
  HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
} from "./topicAssignmentPromotionAuthority";
import type {
  HoidPromotionProgressPort,
  HoidPromotionReviewRequest,
  HoidSourceControlReviewPort,
} from "./promotionReviewAuthority";
import { sha256Hex } from "./sha256";
import { HOID_TOPIC_ASSIGNMENT_ACTIVATION_RECEIPT } from "./topicAssignmentActivationReceipt";
export { HOID_TOPIC_ASSIGNMENT_ACTIVATION_RECEIPT };

export const HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH = "main";
export const HOID_TOPIC_ASSIGNMENT_ACTIVATION_RECEIPT_PATH =
  "src/hoid/topicAssignmentActivationReceipt.ts";

export type HoidTopicAssignmentActivationReceipt = Readonly<{
  schemaVersion: 2;
  repositoryFullName: string;
  pullRequestNumber: number;
  targetBranch: "main";
  promotionManifestPath: typeof HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH;
  reviewedBaseSha: string;
  reviewedHeadSha: string;
  mergeCommitSha: string;
  promotionPlanFingerprint: string;
  assignmentFingerprint: string;
  evidenceFingerprint: string;
  assignmentIds: readonly string[];
  assignmentReviewerIds: readonly string[];
  approvalReviewerIds: readonly string[];
  requiredApprovals: number;
  protectedReviewVerified: true;
  mergedAt: string;
  receiptFingerprint: string;
}>;

export type HoidTopicAssignmentActivationBuildResult =
  | Readonly<{
      status: "ready-for-maintainer-receipt";
      receipt: HoidTopicAssignmentActivationReceipt;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "invalid-authorization"
        | "invalid-merged-snapshot"
        | "registry-mismatch";
      productionWritePerformed: false;
    }>;

export type HoidTopicAssignmentActivationValidation =
  | Readonly<{ status: "valid"; receipt: HoidTopicAssignmentActivationReceipt }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-receipt" | "receipt-fingerprint-mismatch" | "registry-mismatch";
    }>;

export type HoidTopicAssignmentActivationResolution =
  | Readonly<{
      status: "active";
      assignments: readonly HoidTopicAssignment[];
      receipt: HoidTopicAssignmentActivationReceipt;
    }>
  | Readonly<{ status: "inactive"; reason: "no-topic-assignments" | "activation-receipt-missing" }>
  | Readonly<{ status: "invalid"; reason: "invalid-assignments" | "invalid-activation-receipt" | "registry-mismatch" }>;

export type HoidTopicAssignmentMergedSnapshotRequest = Readonly<{
  repositoryFullName: string;
  pullRequestNumber: number;
  expectedBaseRef: "main";
  expectedHeadRef: string;
  expectedHeadSha: string;
  promotionPlanFingerprint: string;
  promotionManifestPath: typeof HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH;
  targetBranch: "main";
}>;

export type HoidTopicAssignmentMergeReviewPort = Readonly<{
  /** Trusted, read-only adapter. It must query GitHub's merged PR and exact head manifest. */
  fetchMergedPromotionSnapshot(request: HoidTopicAssignmentMergedSnapshotRequest): Promise<unknown>;
}>;

const AUTHORIZATION_KEYS = new Set([
  "status",
  "repositoryFullName",
  "pullRequestNumber",
  "baseRef",
  "baseSha",
  "headRef",
  "headSha",
  "promotionPlanFingerprint",
  "assignmentFingerprint",
  "evidenceFingerprint",
  "authenticatedAssignmentReviewerIds",
  "approvalReviewerIds",
  "requiredApprovals",
  "protectedReviewVerified",
  "promotionAllowed",
  "productionWritePerformed",
]);
const MERGED_SNAPSHOT_KEYS = new Set([
  "schemaVersion",
  "repositoryFullName",
  "pullRequestNumber",
  "state",
  "draft",
  "merged",
  "baseRef",
  "headRef",
  "headSha",
  "mergeCommitSha",
  "promotionManifestPath",
  "promotionPlanFingerprint",
  "mergedAt",
]);
const RECEIPT_KEYS = new Set([
  "schemaVersion",
  "repositoryFullName",
  "pullRequestNumber",
  "targetBranch",
  "promotionManifestPath",
  "reviewedBaseSha",
  "reviewedBaseSha",
  "reviewedHeadSha",
  "mergeCommitSha",
  "promotionPlanFingerprint",
  "assignmentFingerprint",
  "evidenceFingerprint",
  "assignmentIds",
  "assignmentReviewerIds",
  "approvalReviewerIds",
  "requiredApprovals",
  "protectedReviewVerified",
  "mergedAt",
  "receiptFingerprint",
]);
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/u;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40,64}$/u;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const REVIEWER_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/u;
const DEFAULT_TIMEOUT_MS = 8_000;

function canonicalRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.size) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      result[key] = descriptor.value;
    }
    for (const key of allowedKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalSortedStrings(value: unknown, pattern: RegExp, maximum: number): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > maximum) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const values: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string" ||
        !pattern.test(descriptor.value) ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      values.push(descriptor.value);
    }
    const sorted = [...values].sort();
    if (sorted.some((item, index) => item !== values[index])) return null;
    return Object.freeze(values);
  } catch {
    return null;
  }
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  try {
    return new Date(parsed).toISOString() === value;
  } catch {
    return false;
  }
}

type CanonicalAuthorization = Readonly<{
  repositoryFullName: string;
  pullRequestNumber: number;
  baseRef: "main";
  baseSha: string;
  headRef: string;
  baseSha: string;
  headSha: string;
  promotionPlanFingerprint: string;
  assignmentFingerprint: string;
  evidenceFingerprint: string;
  assignmentReviewerIds: readonly string[];
  approvalReviewerIds: readonly string[];
  requiredApprovals: number;
}>;

function canonicalAuthorization(value: unknown): CanonicalAuthorization | null {
  const raw = canonicalRecord(value, AUTHORIZATION_KEYS);
  if (
    !raw ||
    raw.status !== "ready-for-maintainer-commit" ||
    typeof raw.repositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(raw.repositoryFullName) ||
    !Number.isSafeInteger(raw.pullRequestNumber) ||
    (raw.pullRequestNumber as number) < 1 ||
    raw.baseRef !== HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH ||
    typeof raw.baseSha !== "string" ||
    !COMMIT_SHA_PATTERN.test(raw.baseSha) ||
    typeof raw.headRef !== "string" ||
    !REF_PATTERN.test(raw.headRef) ||
    raw.headRef === HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH ||
    typeof raw.baseSha !== "string" ||
    !COMMIT_SHA_PATTERN.test(raw.baseSha) ||
    typeof raw.headSha !== "string" ||
    !COMMIT_SHA_PATTERN.test(raw.headSha) ||
    typeof raw.promotionPlanFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(raw.promotionPlanFingerprint) ||
    typeof raw.assignmentFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(raw.assignmentFingerprint) ||
    typeof raw.evidenceFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(raw.evidenceFingerprint) ||
    !Number.isSafeInteger(raw.requiredApprovals) ||
    (raw.requiredApprovals as number) < 1 ||
    (raw.requiredApprovals as number) > 10 ||
    raw.protectedReviewVerified !== true ||
    raw.promotionAllowed !== false ||
    raw.productionWritePerformed !== false
  ) return null;

  const assignmentReviewerIds = canonicalSortedStrings(raw.authenticatedAssignmentReviewerIds, REVIEWER_PATTERN, 512);
  const approvalReviewerIds = canonicalSortedStrings(raw.approvalReviewerIds, REVIEWER_PATTERN, 512);
  if (
    !assignmentReviewerIds ||
    !approvalReviewerIds ||
    (raw.requiredApprovals as number) > approvalReviewerIds.length ||
    assignmentReviewerIds.some(id => !approvalReviewerIds.includes(id))
  ) return null;

  return Object.freeze({
    repositoryFullName: raw.repositoryFullName,
    pullRequestNumber: raw.pullRequestNumber as number,
    baseRef: HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH,
    baseSha: raw.baseSha,
    headRef: raw.headRef,
    headSha: raw.headSha,
    promotionPlanFingerprint: raw.promotionPlanFingerprint,
    assignmentFingerprint: raw.assignmentFingerprint,
    evidenceFingerprint: raw.evidenceFingerprint,
    assignmentReviewerIds,
    approvalReviewerIds,
    requiredApprovals: raw.requiredApprovals as number,
  });
}

type CanonicalMergedSnapshot = Readonly<{
  repositoryFullName: string;
  pullRequestNumber: number;
  baseRef: "main";
  headRef: string;
  headSha: string;
  mergeCommitSha: string;
  promotionPlanFingerprint: string;
  mergedAt: string;
}>;

function canonicalMergedSnapshot(value: unknown): CanonicalMergedSnapshot | null {
  const raw = canonicalRecord(value, MERGED_SNAPSHOT_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    typeof raw.repositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(raw.repositoryFullName) ||
    !Number.isSafeInteger(raw.pullRequestNumber) ||
    (raw.pullRequestNumber as number) < 1 ||
    raw.state !== "closed" ||
    raw.draft !== false ||
    raw.merged !== true ||
    raw.baseRef !== HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH ||
    typeof raw.headRef !== "string" ||
    !REF_PATTERN.test(raw.headRef) ||
    raw.headRef === HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH ||
    typeof raw.headSha !== "string" ||
    !COMMIT_SHA_PATTERN.test(raw.headSha) ||
    typeof raw.mergeCommitSha !== "string" ||
    !COMMIT_SHA_PATTERN.test(raw.mergeCommitSha) ||
    raw.promotionManifestPath !== HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH ||
    typeof raw.promotionPlanFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(raw.promotionPlanFingerprint) ||
    !canonicalTimestamp(raw.mergedAt)
  ) return null;

  return Object.freeze({
    repositoryFullName: raw.repositoryFullName,
    pullRequestNumber: raw.pullRequestNumber as number,
    baseRef: HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH,
    baseSha: raw.baseSha,
    headRef: raw.headRef,
    headSha: raw.headSha,
    mergeCommitSha: raw.mergeCommitSha,
    promotionPlanFingerprint: raw.promotionPlanFingerprint,
    mergedAt: raw.mergedAt,
  });
}

function receiptFingerprint(
  receipt: Omit<HoidTopicAssignmentActivationReceipt, "receiptFingerprint">,
): string {
  return sha256Hex(JSON.stringify([
    "hoid-topic-assignment-activation-v2",
    receipt.schemaVersion,
    receipt.repositoryFullName,
    receipt.pullRequestNumber,
    receipt.targetBranch,
    receipt.promotionManifestPath,
    receipt.reviewedBaseSha,
    receipt.reviewedHeadSha,
    receipt.mergeCommitSha,
    receipt.promotionPlanFingerprint,
    receipt.assignmentFingerprint,
    receipt.evidenceFingerprint,
    receipt.assignmentIds,
    receipt.assignmentReviewerIds,
    receipt.approvalReviewerIds,
    receipt.requiredApprovals,
    receipt.protectedReviewVerified,
    receipt.mergedAt,
  ]));
}

function canonicalReceipt(value: unknown): HoidTopicAssignmentActivationReceipt | null {
  const raw = canonicalRecord(value, RECEIPT_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 2 ||
    typeof raw.repositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(raw.repositoryFullName) ||
    !Number.isSafeInteger(raw.pullRequestNumber) ||
    (raw.pullRequestNumber as number) < 1 ||
    raw.targetBranch !== HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH ||
    raw.promotionManifestPath !== HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH ||
    typeof raw.reviewedBaseSha !== "string" ||
    !COMMIT_SHA_PATTERN.test(raw.reviewedBaseSha) ||
    typeof raw.reviewedHeadSha !== "string" ||
    !COMMIT_SHA_PATTERN.test(raw.reviewedHeadSha) ||
    typeof raw.mergeCommitSha !== "string" ||
    !COMMIT_SHA_PATTERN.test(raw.mergeCommitSha) ||
    typeof raw.promotionPlanFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(raw.promotionPlanFingerprint) ||
    typeof raw.assignmentFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(raw.assignmentFingerprint) ||
    typeof raw.evidenceFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(raw.evidenceFingerprint) ||
    !Number.isSafeInteger(raw.requiredApprovals) ||
    (raw.requiredApprovals as number) < 1 ||
    (raw.requiredApprovals as number) > 10 ||
    raw.protectedReviewVerified !== true ||
    !canonicalTimestamp(raw.mergedAt) ||
    typeof raw.receiptFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(raw.receiptFingerprint)
  ) return null;

  const assignmentIds = canonicalSortedStrings(raw.assignmentIds, ID_PATTERN, 512);
  const assignmentReviewerIds = canonicalSortedStrings(raw.assignmentReviewerIds, REVIEWER_PATTERN, 512);
  const approvalReviewerIds = canonicalSortedStrings(raw.approvalReviewerIds, REVIEWER_PATTERN, 512);
  if (
    !assignmentIds ||
    !assignmentReviewerIds ||
    !approvalReviewerIds ||
    (raw.requiredApprovals as number) > approvalReviewerIds.length ||
    assignmentReviewerIds.some(id => !approvalReviewerIds.includes(id))
  ) return null;

  const base = Object.freeze({
    schemaVersion: 2 as const,
    repositoryFullName: raw.repositoryFullName,
    pullRequestNumber: raw.pullRequestNumber as number,
    targetBranch: HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH,
    promotionManifestPath: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
    reviewedBaseSha: raw.reviewedBaseSha,
    reviewedHeadSha: raw.reviewedHeadSha,
    mergeCommitSha: raw.mergeCommitSha,
    promotionPlanFingerprint: raw.promotionPlanFingerprint,
    assignmentFingerprint: raw.assignmentFingerprint,
    evidenceFingerprint: raw.evidenceFingerprint,
    assignmentIds,
    assignmentReviewerIds,
    approvalReviewerIds,
    requiredApprovals: raw.requiredApprovals as number,
    protectedReviewVerified: true as const,
    mergedAt: raw.mergedAt,
  });
  return Object.freeze({ ...base, receiptFingerprint: raw.receiptFingerprint });
}

export function buildHoidTopicAssignmentActivationReceipt(
  authorizationInput: unknown,
  mergedSnapshotInput: unknown,
  assignmentsInput: unknown = HOID_APPROVED_TOPIC_ASSIGNMENTS,
  approvedClaimsInput?: unknown,
  approvedKnowledgeInput?: unknown,
): HoidTopicAssignmentActivationBuildResult {
  const authorization = canonicalAuthorization(authorizationInput);
  if (!authorization) return Object.freeze({
    status: "blocked",
    reason: "invalid-authorization",
    productionWritePerformed: false,
  });

  const merged = canonicalMergedSnapshot(mergedSnapshotInput);
  if (
    !merged ||
    merged.repositoryFullName !== authorization.repositoryFullName ||
    merged.pullRequestNumber !== authorization.pullRequestNumber ||
    merged.baseRef !== authorization.baseRef ||
    merged.headRef !== authorization.headRef ||
    merged.headSha !== authorization.headSha ||
    merged.promotionPlanFingerprint !== authorization.promotionPlanFingerprint
  ) return Object.freeze({
    status: "blocked",
    reason: "invalid-merged-snapshot",
    productionWritePerformed: false,
  });

  const registry = fingerprintHoidTopicAssignmentRegistry(
    assignmentsInput,
    approvedClaimsInput,
    approvedKnowledgeInput,
  );
  if (
    registry.status !== "valid" ||
    registry.assignmentFingerprint !== authorization.assignmentFingerprint ||
    registry.evidenceFingerprint !== authorization.evidenceFingerprint ||
    registry.assignmentReviewerIds.length !== authorization.assignmentReviewerIds.length ||
    registry.assignmentReviewerIds.some((id, index) => id !== authorization.assignmentReviewerIds[index])
  ) return Object.freeze({
    status: "blocked",
    reason: "registry-mismatch",
    productionWritePerformed: false,
  });

  const base = Object.freeze({
    schemaVersion: 2 as const,
    repositoryFullName: authorization.repositoryFullName,
    pullRequestNumber: authorization.pullRequestNumber,
    targetBranch: HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH,
    promotionManifestPath: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
    reviewedBaseSha: authorization.baseSha,
    reviewedHeadSha: merged.headSha,
    mergeCommitSha: merged.mergeCommitSha,
    promotionPlanFingerprint: authorization.promotionPlanFingerprint,
    assignmentFingerprint: registry.assignmentFingerprint,
    evidenceFingerprint: registry.evidenceFingerprint,
    assignmentIds: registry.assignmentIds,
    assignmentReviewerIds: registry.assignmentReviewerIds,
    approvalReviewerIds: authorization.approvalReviewerIds,
    requiredApprovals: authorization.requiredApprovals,
    protectedReviewVerified: true as const,
    mergedAt: merged.mergedAt,
  });
  return Object.freeze({
    status: "ready-for-maintainer-receipt",
    receipt: Object.freeze({ ...base, receiptFingerprint: receiptFingerprint(base) }),
    productionWritePerformed: false,
  });
}

export function validateHoidTopicAssignmentActivationReceipt(
  receiptInput: unknown,
  assignmentsInput: unknown = HOID_APPROVED_TOPIC_ASSIGNMENTS,
  approvedClaimsInput?: unknown,
  approvedKnowledgeInput?: unknown,
): HoidTopicAssignmentActivationValidation {
  const receipt = canonicalReceipt(receiptInput);
  if (!receipt) return Object.freeze({ status: "invalid", reason: "invalid-receipt" });

  const base = Object.freeze({
    schemaVersion: 2 as const,
    repositoryFullName: receipt.repositoryFullName,
    pullRequestNumber: receipt.pullRequestNumber,
    targetBranch: receipt.targetBranch,
    promotionManifestPath: receipt.promotionManifestPath,
    reviewedBaseSha: receipt.reviewedBaseSha,
    reviewedHeadSha: receipt.reviewedHeadSha,
    mergeCommitSha: receipt.mergeCommitSha,
    promotionPlanFingerprint: receipt.promotionPlanFingerprint,
    assignmentFingerprint: receipt.assignmentFingerprint,
    evidenceFingerprint: receipt.evidenceFingerprint,
    assignmentIds: receipt.assignmentIds,
    assignmentReviewerIds: receipt.assignmentReviewerIds,
    approvalReviewerIds: receipt.approvalReviewerIds,
    requiredApprovals: receipt.requiredApprovals,
    protectedReviewVerified: receipt.protectedReviewVerified,
    mergedAt: receipt.mergedAt,
  });
  if (receiptFingerprint(base) !== receipt.receiptFingerprint) {
    return Object.freeze({ status: "invalid", reason: "receipt-fingerprint-mismatch" });
  }

  const registry = fingerprintHoidTopicAssignmentRegistry(
    assignmentsInput,
    approvedClaimsInput,
    approvedKnowledgeInput,
  );
  if (
    registry.status !== "valid" ||
    registry.assignmentFingerprint !== receipt.assignmentFingerprint ||
    registry.evidenceFingerprint !== receipt.evidenceFingerprint ||
    registry.assignmentIds.length !== receipt.assignmentIds.length ||
    registry.assignmentIds.some((id, index) => id !== receipt.assignmentIds[index]) ||
    registry.assignmentReviewerIds.length !== receipt.assignmentReviewerIds.length ||
    registry.assignmentReviewerIds.some((id, index) => id !== receipt.assignmentReviewerIds[index])
  ) return Object.freeze({ status: "invalid", reason: "registry-mismatch" });

  return Object.freeze({ status: "valid", receipt });
}

export function resolveHoidTopicAssignmentsForActivation(
  assignmentsInput: unknown,
  receiptInput: unknown,
  approvedClaimsInput?: unknown,
  approvedKnowledgeInput?: unknown,
): HoidTopicAssignmentActivationResolution {
  const registry = fingerprintHoidTopicAssignmentRegistry(
    assignmentsInput,
    approvedClaimsInput,
    approvedKnowledgeInput,
  );
  if (registry.status === "empty") return Object.freeze({ status: "inactive", reason: "no-topic-assignments" });
  if (registry.status !== "valid") return Object.freeze({ status: "invalid", reason: "invalid-assignments" });
  if (receiptInput === null || receiptInput === undefined) {
    return Object.freeze({ status: "inactive", reason: "activation-receipt-missing" });
  }

  const validation = validateHoidTopicAssignmentActivationReceipt(
    receiptInput,
    assignmentsInput,
    approvedClaimsInput,
    approvedKnowledgeInput,
  );
  if (validation.status !== "valid") {
    return Object.freeze({ status: "invalid", reason: "invalid-activation-receipt" });
  }
  return Object.freeze({
    status: "active",
    assignments: registry.assignments,
    receipt: validation.receipt,
  });
}

export function resolveProductionHoidTopicAssignments() {
  return resolveHoidTopicAssignmentsForActivation(
    HOID_APPROVED_TOPIC_ASSIGNMENTS,
    HOID_TOPIC_ASSIGNMENT_ACTIVATION_RECEIPT,
  );
}

function methodFromPort(value: unknown): ((request: HoidTopicAssignmentMergedSnapshotRequest) => Promise<unknown>) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 4; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, "fetchMergedPromotionSnapshot");
      if (descriptor) {
        if (!Object.prototype.hasOwnProperty.call(descriptor, "value") || typeof descriptor.value !== "function") return null;
        return (descriptor.value as (request: HoidTopicAssignmentMergedSnapshotRequest) => Promise<unknown>).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

export type HoidTopicAssignmentActivationAuthorizationResult =
  | HoidTopicAssignmentActivationBuildResult
  | Readonly<{
      status: "blocked";
      reason:
        | "pre-merge-review-not-satisfied"
        | "invalid-merge-port"
        | "merge-source-unavailable"
        | "merge-timeout";
      verificationReason?: string;
      productionWritePerformed: false;
    }>;

/**
 * Runs the protected pre-merge review authority first, then verifies the
 * actual merged PR through a separate read-only adapter. It never writes.
 */
export async function authorizeHoidTopicAssignmentActivation(
  planInput: unknown,
  assignmentsInput: unknown,
  requestInput: HoidPromotionReviewRequest,
  sourceControlPortInput: HoidSourceControlReviewPort,
  progressPortInput: HoidPromotionProgressPort,
  mergePortInput: unknown,
  approvedClaimsInput?: unknown,
  approvedKnowledgeInput?: unknown,
): Promise<HoidTopicAssignmentActivationAuthorizationResult> {
  const fetchMerged = methodFromPort(mergePortInput);
  if (!fetchMerged) return Object.freeze({
    status: "blocked",
    reason: "invalid-merge-port",
    productionWritePerformed: false,
  });

  const preMerge = await authorizeHoidTopicAssignmentPromotion(
    planInput,
    assignmentsInput,
    requestInput,
    sourceControlPortInput,
    progressPortInput,
    approvedClaimsInput,
    approvedKnowledgeInput,
  );
  if (preMerge.status !== "ready-for-maintainer-commit") return Object.freeze({
    status: "blocked",
    reason: "pre-merge-review-not-satisfied",
    verificationReason: preMerge.status === "blocked" ? preMerge.reason : "invalid-plan",
    productionWritePerformed: false,
  });

  const authorization = canonicalAuthorization(preMerge);
  if (!authorization) return Object.freeze({
    status: "blocked",
    reason: "pre-merge-review-not-satisfied",
    verificationReason: "invalid-authorization-result",
    productionWritePerformed: false,
  });

  const request: HoidTopicAssignmentMergedSnapshotRequest = Object.freeze({
    repositoryFullName: authorization.repositoryFullName,
    pullRequestNumber: authorization.pullRequestNumber,
    expectedBaseRef: authorization.baseRef,
    expectedHeadRef: authorization.headRef,
    expectedHeadSha: authorization.headSha,
    promotionPlanFingerprint: authorization.promotionPlanFingerprint,
    promotionManifestPath: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
    targetBranch: HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH,
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const fetched = Promise.resolve().then(() => fetchMerged(request)).then(
    value => ({ kind: "value" as const, value }),
    () => ({ kind: "error" as const }),
  );
  const timeout = new Promise<{ kind: "timeout" }>(resolve => {
    timer = setTimeout(() => resolve({ kind: "timeout" }), DEFAULT_TIMEOUT_MS);
  });
  const outcome = await Promise.race([fetched, timeout]);
  if (timer !== undefined) clearTimeout(timer);
  if (outcome.kind === "timeout") return Object.freeze({
    status: "blocked",
    reason: "merge-timeout",
    productionWritePerformed: false,
  });
  if (outcome.kind === "error") return Object.freeze({
    status: "blocked",
    reason: "merge-source-unavailable",
    productionWritePerformed: false,
  });
  return buildHoidTopicAssignmentActivationReceipt(
    preMerge,
    outcome.value,
    assignmentsInput,
    approvedClaimsInput,
    approvedKnowledgeInput,
  );
}

