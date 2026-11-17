import { sha256Hex } from "./sha256";

export type HoidEditorialPromotionPlanInput = Readonly<{
  status: "ready-for-maintainer-commit";
  entityIds: readonly string[];
  relationshipIds: readonly string[];
  progressRevision: number;
  progressFingerprint: string;
  requiresProtectedReview: true;
  promotionAllowed: false;
  productionWritePerformed: false;
}>;

export type HoidPromotionReviewRequest = Readonly<{
  schemaVersion: 1;
  repositoryFullName: string;
  pullRequestNumber: number;
  expectedBaseRef: string;
  expectedHeadRef: string;
  expectedHeadSha: string;
  promotionManifestPath: string;
  minimumApprovals: number;
  requireCodeOwnerReview: boolean;
  requireDismissStaleReviews: boolean;
  requireEnforcedAdmins: boolean;
}>;

export type HoidProtectedReviewFetchRequest = HoidPromotionReviewRequest & Readonly<{
  promotionPlanFingerprint: string;
}>;

export type HoidSourceControlReviewPort = Readonly<{
  /**
   * Trusted source-control adapter. It must fetch the PR, effective reviews,
   * branch/ruleset protection and the promotion manifest at expectedHeadSha.
   * It returns untrusted data; the Hoid core validates every field again.
   */
  fetchProtectedReviewSnapshot(request: HoidProtectedReviewFetchRequest): Promise<unknown>;
}>;

export type HoidProtectedReviewSnapshot = Readonly<{
  schemaVersion: 1;
  repositoryFullName: string;
  pullRequestNumber: number;
  state: "open";
  draft: false;
  baseRef: string;
  headRef: string;
  headSha: string;
  authorId: string;
  promotionPlanFingerprint: string;
  verifiedAt: string;
  branchProtection: Readonly<{
    status: "verified";
    requiredApprovingReviewCount: number;
    requireCodeOwnerReview: boolean;
    dismissStaleReviews: boolean;
    enforceAdmins: boolean;
  }>;
  /** One effective (latest) review per reviewer, normalized by the adapter. */
  reviews: readonly Readonly<{
    reviewId: string;
    reviewerId: string;
    state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";
    commitSha: string;
    submittedAt: string;
    dismissed: boolean;
    isCodeOwner: boolean;
  }>[];
}>;

export type HoidProtectedReviewVerification =
  | Readonly<{
      status: "verified";
      approvalReviewerIds: readonly string[];
      requiredApprovals: number;
      verifiedAt: string;
      headSha: string;
      promotionPlanFingerprint: string;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-request"
        | "invalid-snapshot"
        | "repository-mismatch"
        | "pull-request-mismatch"
        | "pull-request-not-open"
        | "draft-pull-request"
        | "branch-mismatch"
        | "head-mismatch"
        | "promotion-plan-mismatch"
        | "branch-protection-unverified"
        | "branch-protection-insufficient"
        | "approval-quorum-not-met"
        | "code-owner-approval-missing";
    }>;

type HoidProtectedReviewFailureReason = Extract<HoidProtectedReviewVerification, { status: "invalid" }>["reason"];

export type HoidPromotionCommitAuthorization =
  | Readonly<{
      status: "ready-for-maintainer-commit";
      repositoryFullName: string;
      pullRequestNumber: number;
      headSha: string;
      promotionPlanFingerprint: string;
      approvalReviewerIds: readonly string[];
      requiredApprovals: number;
      protectedReviewVerified: true;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "promotion-plan-blocked"
        | "invalid-plan"
        | "invalid-request"
        | "invalid-source-control-port"
        | "review-source-unavailable"
        | "review-timeout"
        | "review-not-satisfied";
      verificationReason?: HoidProtectedReviewFailureReason;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

const REQUEST_KEYS = new Set([
  "schemaVersion",
  "repositoryFullName",
  "pullRequestNumber",
  "expectedBaseRef",
  "expectedHeadRef",
  "expectedHeadSha",
  "promotionManifestPath",
  "minimumApprovals",
  "requireCodeOwnerReview",
  "requireDismissStaleReviews",
  "requireEnforcedAdmins",
]);
const PLAN_KEYS = new Set([
  "status",
  "entityIds",
  "relationshipIds",
  "progressRevision",
  "progressFingerprint",
  "requiresProtectedReview",
  "promotionAllowed",
  "productionWritePerformed",
]);
const SNAPSHOT_KEYS = new Set([
  "schemaVersion",
  "repositoryFullName",
  "pullRequestNumber",
  "state",
  "draft",
  "baseRef",
  "headRef",
  "headSha",
  "authorId",
  "promotionPlanFingerprint",
  "verifiedAt",
  "branchProtection",
  "reviews",
]);
const PROTECTION_KEYS = new Set([
  "status",
  "requiredApprovingReviewCount",
  "requireCodeOwnerReview",
  "dismissStaleReviews",
  "enforceAdmins",
]);
const REVIEW_KEYS = new Set([
  "reviewId",
  "reviewerId",
  "state",
  "commitSha",
  "submittedAt",
  "dismissed",
  "isCodeOwner",
]);
const MAX_REVIEWS = 50;
const DEFAULT_TIMEOUT_MS = 8_000;
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SHA_PATTERN = /^[a-f0-9]{40,64}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/;
const PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]{1,240}$/;

type CanonicalRequest = HoidPromotionReviewRequest;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function canonicalRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Record<string, unknown> | null {
  try {
    if (!isPlainRecord(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.size) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
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

function canonicalDenseArray(value: unknown, max: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length > max) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
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
    return Object.freeze(result);
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

function canonicalRequest(value: unknown): CanonicalRequest | null {
  const raw = canonicalRecord(value, REQUEST_KEYS);
  if (!raw || raw.schemaVersion !== 1) return null;
  if (
    typeof raw.repositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(raw.repositoryFullName) ||
    !Number.isSafeInteger(raw.pullRequestNumber) ||
    (raw.pullRequestNumber as number) < 1 ||
    typeof raw.expectedBaseRef !== "string" ||
    !REF_PATTERN.test(raw.expectedBaseRef) ||
    typeof raw.expectedHeadRef !== "string" ||
    !REF_PATTERN.test(raw.expectedHeadRef) ||
    raw.expectedBaseRef === raw.expectedHeadRef ||
    typeof raw.expectedHeadSha !== "string" ||
    !SHA_PATTERN.test(raw.expectedHeadSha) ||
    typeof raw.promotionManifestPath !== "string" ||
    !PATH_PATTERN.test(raw.promotionManifestPath) ||
    !Number.isSafeInteger(raw.minimumApprovals) ||
    (raw.minimumApprovals as number) < 1 ||
    (raw.minimumApprovals as number) > 5 ||
    typeof raw.requireCodeOwnerReview !== "boolean" ||
    typeof raw.requireDismissStaleReviews !== "boolean" ||
    typeof raw.requireEnforcedAdmins !== "boolean"
  ) return null;

  return Object.freeze({
    schemaVersion: 1,
    repositoryFullName: raw.repositoryFullName,
    pullRequestNumber: raw.pullRequestNumber as number,
    expectedBaseRef: raw.expectedBaseRef,
    expectedHeadRef: raw.expectedHeadRef,
    expectedHeadSha: raw.expectedHeadSha,
    promotionManifestPath: raw.promotionManifestPath,
    minimumApprovals: raw.minimumApprovals as number,
    requireCodeOwnerReview: raw.requireCodeOwnerReview,
    requireDismissStaleReviews: raw.requireDismissStaleReviews,
    requireEnforcedAdmins: raw.requireEnforcedAdmins,
  });
}

function canonicalPromotionPlan(value: unknown): HoidEditorialPromotionPlanInput | null {
  const raw = canonicalRecord(value, PLAN_KEYS);
  if (
    !raw ||
    raw.status !== "ready-for-maintainer-commit" ||
    raw.requiresProtectedReview !== true ||
    raw.promotionAllowed !== false ||
    raw.productionWritePerformed !== false ||
    !Number.isSafeInteger(raw.progressRevision) ||
    (raw.progressRevision as number) < 0 ||
    typeof raw.progressFingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.progressFingerprint)
  ) return null;

  const entityIds = canonicalDenseArray(raw.entityIds, 512);
  const relationshipIds = canonicalDenseArray(raw.relationshipIds, 512);
  if (!entityIds || entityIds.length === 0 || !relationshipIds) return null;

  const canonicalIds = (values: readonly unknown[]): readonly string[] | null => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const value of values) {
      if (typeof value !== "string" || !ID_PATTERN.test(value) || seen.has(value)) return null;
      seen.add(value);
      ids.push(value);
    }
    const sorted = [...ids].sort();
    if (sorted.some((id, index) => id !== ids[index])) return null;
    return Object.freeze(ids);
  };
  const entities = canonicalIds(entityIds);
  const relationships = canonicalIds(relationshipIds);
  if (!entities || !relationships) return null;

  return Object.freeze({
    status: "ready-for-maintainer-commit",
    entityIds: entities,
    relationshipIds: relationships,
    progressRevision: raw.progressRevision as number,
    progressFingerprint: raw.progressFingerprint,
    requiresProtectedReview: true,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

function promotionPlanFingerprint(plan: HoidEditorialPromotionPlanInput): string {
  return sha256Hex(JSON.stringify([
    "hoid-editorial-promotion-plan-v1",
    plan.entityIds,
    plan.relationshipIds,
    plan.progressRevision,
    plan.progressFingerprint,
  ]));
}

function invalidVerification(
  reason: Extract<HoidProtectedReviewVerification, { status: "invalid" }>["reason"],
): HoidProtectedReviewVerification {
  return Object.freeze({ status: "invalid", reason });
}

export function verifyHoidProtectedReviewSnapshot(
  requestInput: unknown,
  snapshotInput: unknown,
  expectedPlanFingerprintInput: unknown,
): HoidProtectedReviewVerification {
  const request = canonicalRequest(requestInput);
  if (!request || typeof expectedPlanFingerprintInput !== "string" || !/^[a-f0-9]{64}$/.test(expectedPlanFingerprintInput)) {
    return invalidVerification("invalid-request");
  }

  const raw = canonicalRecord(snapshotInput, SNAPSHOT_KEYS);
  if (!raw || raw.schemaVersion !== 1) return invalidVerification("invalid-snapshot");
  if (raw.repositoryFullName !== request.repositoryFullName) return invalidVerification("repository-mismatch");
  if (raw.pullRequestNumber !== request.pullRequestNumber) return invalidVerification("pull-request-mismatch");
  if (raw.state !== "open") return invalidVerification("pull-request-not-open");
  if (raw.draft !== false) return invalidVerification("draft-pull-request");
  if (raw.baseRef !== request.expectedBaseRef || raw.headRef !== request.expectedHeadRef) {
    return invalidVerification("branch-mismatch");
  }
  if (raw.headSha !== request.expectedHeadSha || typeof raw.headSha !== "string" || !SHA_PATTERN.test(raw.headSha)) {
    return invalidVerification("head-mismatch");
  }
  if (raw.promotionPlanFingerprint !== expectedPlanFingerprintInput) {
    return invalidVerification("promotion-plan-mismatch");
  }
  if (typeof raw.authorId !== "string" || !raw.authorId.trim() || raw.authorId.length > 128 || !canonicalTimestamp(raw.verifiedAt)) {
    return invalidVerification("invalid-snapshot");
  }

  const protection = canonicalRecord(raw.branchProtection, PROTECTION_KEYS);
  if (
    !protection ||
    protection.status !== "verified" ||
    !Number.isSafeInteger(protection.requiredApprovingReviewCount) ||
    (protection.requiredApprovingReviewCount as number) < 0 ||
    (protection.requiredApprovingReviewCount as number) > 10 ||
    typeof protection.requireCodeOwnerReview !== "boolean" ||
    typeof protection.dismissStaleReviews !== "boolean" ||
    typeof protection.enforceAdmins !== "boolean"
  ) return invalidVerification("branch-protection-unverified");

  if (
    (request.requireCodeOwnerReview && protection.requireCodeOwnerReview !== true) ||
    (request.requireDismissStaleReviews && protection.dismissStaleReviews !== true) ||
    (request.requireEnforcedAdmins && protection.enforceAdmins !== true)
  ) return invalidVerification("branch-protection-insufficient");

  const rawReviews = canonicalDenseArray(raw.reviews, MAX_REVIEWS);
  if (!rawReviews) return invalidVerification("invalid-snapshot");
  const reviewIds = new Set<string>();
  const reviewerIds = new Set<string>();
  const approvals: string[] = [];
  let codeOwnerApproval = false;

  for (const item of rawReviews) {
    const review = canonicalRecord(item, REVIEW_KEYS);
    if (
      !review ||
      typeof review.reviewId !== "string" ||
      !review.reviewId.trim() ||
      review.reviewId.length > 128 ||
      typeof review.reviewerId !== "string" ||
      !review.reviewerId.trim() ||
      review.reviewerId.length > 128 ||
      !["APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED"].includes(String(review.state)) ||
      typeof review.commitSha !== "string" ||
      !SHA_PATTERN.test(review.commitSha) ||
      !canonicalTimestamp(review.submittedAt) ||
      typeof review.dismissed !== "boolean" ||
      typeof review.isCodeOwner !== "boolean"
    ) return invalidVerification("invalid-snapshot");

    const reviewId = review.reviewId;
    const reviewerId = review.reviewerId;
    if (reviewIds.has(reviewId) || reviewerIds.has(reviewerId)) {
      return invalidVerification("invalid-snapshot");
    }
    reviewIds.add(reviewId);
    reviewerIds.add(reviewerId);

    if (
      review.state === "APPROVED" &&
      review.dismissed === false &&
      review.commitSha === request.expectedHeadSha &&
      reviewerId !== raw.authorId
    ) {
      approvals.push(reviewerId);
      if (review.isCodeOwner === true) codeOwnerApproval = true;
    }
  }

  const requiredApprovals = Math.max(
    request.minimumApprovals,
    protection.requiredApprovingReviewCount as number,
  );
  if (approvals.length < requiredApprovals) return invalidVerification("approval-quorum-not-met");
  if (request.requireCodeOwnerReview && !codeOwnerApproval) {
    return invalidVerification("code-owner-approval-missing");
  }

  approvals.sort();
  return Object.freeze({
    status: "verified",
    approvalReviewerIds: Object.freeze(approvals),
    requiredApprovals,
    verifiedAt: raw.verifiedAt,
    headSha: raw.headSha,
    promotionPlanFingerprint: expectedPlanFingerprintInput,
  });
}

function sourceControlMethod(value: unknown): ((request: HoidProtectedReviewFetchRequest) => Promise<unknown>) | null {
  try {
    if (!isPlainRecord(value)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, "fetchProtectedReviewSnapshot");
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      typeof descriptor.value !== "function"
    ) return null;
    return (descriptor.value as (request: HoidProtectedReviewFetchRequest) => Promise<unknown>).bind(value);
  } catch {
    return null;
  }
}

function blocked(
  reason: Extract<HoidPromotionCommitAuthorization, { status: "blocked" }>["reason"],
  verificationReason?: Extract<HoidProtectedReviewVerification, { status: "invalid" }>["reason"],
): HoidPromotionCommitAuthorization {
  return Object.freeze({
    status: "blocked",
    reason,
    ...(verificationReason ? { verificationReason } : {}),
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

/**
 * Authorize a maintainer-controlled commit only after the plan is canonical
 * and a trusted source-control adapter proves that the exact PR head reviewed
 * the same promotion-plan fingerprint under the requested protection policy.
 *
 * This function never writes production files and never merges a PR.
 */
export async function authorizeHoidPromotionCommit(
  promotionPlanInput: unknown,
  requestInput: unknown,
  sourceControlPortInput: unknown,
): Promise<HoidPromotionCommitAuthorization> {
  const plan = canonicalPromotionPlan(promotionPlanInput);
  if (!plan) {
    let status: unknown;
    try {
      status = isPlainRecord(promotionPlanInput)
        ? Object.getOwnPropertyDescriptor(promotionPlanInput, "status")?.value
        : undefined;
    } catch {
      status = undefined;
    }
    return blocked(status === "blocked" ? "promotion-plan-blocked" : "invalid-plan");
  }

  const request = canonicalRequest(requestInput);
  if (!request) return blocked("invalid-request");

  const fetchSnapshot = sourceControlMethod(sourceControlPortInput);
  if (!fetchSnapshot) return blocked("invalid-source-control-port");

  const planFingerprint = promotionPlanFingerprint(plan);
  const fetchRequest: HoidProtectedReviewFetchRequest = Object.freeze({
    ...request,
    promotionPlanFingerprint: planFingerprint,
  });

  type Outcome =
    | Readonly<{ kind: "value"; value: unknown }>
    | Readonly<{ kind: "error" }>
    | Readonly<{ kind: "timeout" }>;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const call = Promise.resolve()
    .then(() => fetchSnapshot(fetchRequest))
    .then<Outcome, Outcome>(
      value => Object.freeze({ kind: "value", value }),
      () => Object.freeze({ kind: "error" }),
    );
  const timeout = new Promise<Outcome>(resolve => {
    timer = setTimeout(() => resolve(Object.freeze({ kind: "timeout" })), DEFAULT_TIMEOUT_MS);
  });
  const outcome = await Promise.race([call, timeout]);
  if (timer !== undefined) clearTimeout(timer);

  if (outcome.kind === "timeout") return blocked("review-timeout");
  if (outcome.kind === "error") return blocked("review-source-unavailable");

  const verification = verifyHoidProtectedReviewSnapshot(request, outcome.value, planFingerprint);
  if (verification.status !== "verified") {
    return blocked("review-not-satisfied", verification.reason);
  }

  return Object.freeze({
    status: "ready-for-maintainer-commit",
    repositoryFullName: request.repositoryFullName,
    pullRequestNumber: request.pullRequestNumber,
    headSha: verification.headSha,
    promotionPlanFingerprint: verification.promotionPlanFingerprint,
    approvalReviewerIds: verification.approvalReviewerIds,
    requiredApprovals: verification.requiredApprovals,
    protectedReviewVerified: true,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}
