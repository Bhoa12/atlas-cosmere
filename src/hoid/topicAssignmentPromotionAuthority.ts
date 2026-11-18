import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import type { HoidEvidenceCitation } from "./evidenceScope";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import {
  getHoidReadingManifest,
  validateHoidTopicAssignments,
  HOID_APPROVED_TOPIC_ASSIGNMENTS,
  type HoidTopicAssignment,
  type HoidTopicEntityFirstAppearance,
} from "./topicTaxonomy";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import {
  verifyHoidProtectedReviewSnapshot,
  type HoidPromotionProgressPort,
  type HoidPromotionReviewRequest,
  type HoidProtectedReviewFetchRequest,
  type HoidSourceControlReviewPort,
} from "./promotionReviewAuthority";
import { sha256Hex } from "./sha256";

export const HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH =
  "docs/hoid/topic-assignment-promotion.manifest.json";

export type HoidTopicAssignmentPromotionPlan = Readonly<{
  schemaVersion: 1;
  status: "ready-for-protected-review";
  assignmentCount: number;
  assignmentIds: readonly string[];
  assignmentReviewerIds: readonly string[];
  assignmentFingerprint: string;
  evidenceFingerprint: string;
  progressRevision: number;
  progressFingerprint: string;
  requiresProtectedReview: true;
  promotionAllowed: false;
  productionWritePerformed: false;
  fingerprint: string;
}>;

export type HoidTopicAssignmentPromotionBuildResult =
  | Readonly<{
      status: "ready";
      plan: HoidTopicAssignmentPromotionPlan;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason: "no-topic-assignments" | "invalid-progress";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-assignments" | "invalid-plan";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

export type HoidTopicAssignmentPromotionManifest = Readonly<{
  schemaVersion: 1;
  assignmentCount: number;
  assignmentIds: readonly string[];
  assignmentReviewerIds: readonly string[];
  assignmentFingerprint: string;
  evidenceFingerprint: string;
  progressRevision: number;
  progressFingerprint: string;
  planFingerprint: string;
  manifestFingerprint: string;
}>;

export type HoidTopicAssignmentPromotionManifestResult =
  | Readonly<{ status: "valid"; manifest: HoidTopicAssignmentPromotionManifest }>
  | Readonly<{ status: "invalid"; reason: "invalid-plan" | "invalid-manifest" | "manifest-mismatch" }>;

export type HoidTopicAssignmentPromotionAuthorization =
  | Readonly<{
      status: "ready-for-maintainer-commit";
      repositoryFullName: string;
      pullRequestNumber: number;
      headSha: string;
      promotionPlanFingerprint: string;
      assignmentFingerprint: string;
      authenticatedAssignmentReviewerIds: readonly string[];
      approvalReviewerIds: readonly string[];
      requiredApprovals: number;
      protectedReviewVerified: true;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "invalid-plan"
        | "invalid-assignments"
        | "assignments-changed"
        | "invalid-request"
        | "invalid-source-control-port"
        | "review-source-unavailable"
        | "review-timeout"
        | "review-not-satisfied"
        | "assignment-reviewer-not-authenticated"
        | "invalid-progress-port"
        | "progress-source-unavailable"
        | "progress-timeout"
        | "invalid-progress"
        | "progress-changed";
      verificationReason?: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

const PLAN_KEYS = new Set([
  "schemaVersion",
  "status",
  "assignmentCount",
  "assignmentIds",
  "assignmentReviewerIds",
  "assignmentFingerprint",
  "evidenceFingerprint",
  "progressRevision",
  "progressFingerprint",
  "requiresProtectedReview",
  "promotionAllowed",
  "productionWritePerformed",
  "fingerprint",
]);
const MANIFEST_KEYS = new Set([
  "schemaVersion",
  "assignmentCount",
  "assignmentIds",
  "assignmentReviewerIds",
  "assignmentFingerprint",
  "evidenceFingerprint",
  "progressRevision",
  "progressFingerprint",
  "planFingerprint",
  "manifestFingerprint",
]);
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
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SHA_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40,64}$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/;
const DEFAULT_TIMEOUT_MS = 8_000;

function canonicalRecord(value: unknown, allowedKeys: ReadonlySet<string>): Record<string, unknown> | null {
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

function canonicalDenseStrings(value: unknown, maximum: number): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > maximum || Object.getPrototypeOf(value) !== Array.prototype) {
      return null;
    }
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
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) return null;
    }
    const sorted = [...result].sort();
    if (sorted.some((id, index) => id !== result[index])) return null;
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function assignmentFingerprint(assignments: readonly HoidTopicAssignment[]): string {
  const records = [...assignments]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(item => [
      item.id,
      item.subjectKind,
      item.subjectId,
      item.worldId,
      item.worldLabel,
      item.topicId,
      item.dimensionId,
      item.claimId,
      item.claimTextSha256,
      [...item.evidenceIds],
      item.review.reviewerId,
      item.review.reviewedAt,
    ]);
  return sha256Hex(JSON.stringify(["hoid-topic-assignments-v1", records]));
}

function verifiedDocumentIdentity(bookId: string, chapter: number): readonly string[] | null {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") return null;
  const documentSha256 = getVerifiedChapterDocumentSha256(
    bookId,
    manifest.manifest.editionId,
    manifest.manifest.navigationSha256,
    chapter,
  );
  if (!documentSha256) return null;
  return Object.freeze([
    manifest.manifest.editionId,
    manifest.manifest.navigationSha256,
    documentSha256,
  ]);
}

function evidenceFingerprint(
  evidenceCitations: readonly HoidEvidenceCitation[],
  firstAppearances: readonly HoidTopicEntityFirstAppearance[],
): string | null {
  const evidence = [...evidenceCitations]
    .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId))
    .map(item => {
      const identity = verifiedDocumentIdentity(item.sourceBookId, item.sourceChapter);
      return identity ? [
        item.evidenceId,
        item.sourceBookId,
        item.sourceChapter,
        item.locatorId,
        item.unlockBookId,
        item.unlockChapter,
        ...identity,
      ] : null;
    });
  if (evidence.some(item => item === null)) return null;

  const appearances = [...firstAppearances]
    .sort((left, right) => left.entityId.localeCompare(right.entityId))
    .map(item => {
      const identity = verifiedDocumentIdentity(item.bookId, item.chapter);
      return identity ? [item.entityId, item.bookId, item.chapter, ...identity] : null;
    });
  if (appearances.some(item => item === null)) return null;
  return sha256Hex(JSON.stringify(["hoid-topic-evidence-scope-v1", evidence, appearances]));
}

function planFingerprint(plan: Omit<HoidTopicAssignmentPromotionPlan, "fingerprint">): string {
  return sha256Hex(JSON.stringify([
    "hoid-topic-assignment-promotion-v1",
    plan.assignmentCount,
    plan.assignmentIds,
    plan.assignmentReviewerIds,
    plan.assignmentFingerprint,
    plan.evidenceFingerprint,
    plan.progressRevision,
    plan.progressFingerprint,
  ]));
}

function canonicalPlan(value: unknown): HoidTopicAssignmentPromotionPlan | null {
  const raw = canonicalRecord(value, PLAN_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    raw.status !== "ready-for-protected-review" ||
    !Number.isSafeInteger(raw.assignmentCount) ||
    (raw.assignmentCount as number) < 1 ||
    (raw.assignmentCount as number) > 512 ||
    raw.requiresProtectedReview !== true ||
    raw.promotionAllowed !== false ||
    raw.productionWritePerformed !== false ||
    !Number.isSafeInteger(raw.progressRevision) ||
    (raw.progressRevision as number) < 0 ||
    typeof raw.progressFingerprint !== "string" ||
    !SHA_PATTERN.test(raw.progressFingerprint) ||
    typeof raw.assignmentFingerprint !== "string" ||
    !SHA_PATTERN.test(raw.assignmentFingerprint) ||
    typeof raw.evidenceFingerprint !== "string" ||
    !SHA_PATTERN.test(raw.evidenceFingerprint) ||
    typeof raw.fingerprint !== "string" ||
    !SHA_PATTERN.test(raw.fingerprint)
  ) return null;
  const assignmentIds = canonicalDenseStrings(raw.assignmentIds, 512);
  const reviewerIds = canonicalDenseStrings(raw.assignmentReviewerIds, 512);
  if (!assignmentIds || !reviewerIds || assignmentIds.length !== raw.assignmentCount) return null;
  const plan = Object.freeze({
    schemaVersion: 1 as const,
    status: "ready-for-protected-review" as const,
    assignmentCount: raw.assignmentCount as number,
    assignmentIds,
    assignmentReviewerIds: reviewerIds,
    assignmentFingerprint: raw.assignmentFingerprint,
    evidenceFingerprint: raw.evidenceFingerprint,
    progressRevision: raw.progressRevision as number,
    progressFingerprint: raw.progressFingerprint,
    requiresProtectedReview: true as const,
    promotionAllowed: false as const,
    productionWritePerformed: false as const,
    fingerprint: raw.fingerprint,
  });
  const { fingerprint, ...withoutFingerprint } = plan;
  return planFingerprint(withoutFingerprint) === fingerprint ? plan : null;
}

function manifestFingerprint(manifest: Omit<HoidTopicAssignmentPromotionManifest, "manifestFingerprint">): string {
  return sha256Hex(JSON.stringify([
    "hoid-topic-assignment-promotion-manifest-v1",
    manifest.assignmentCount,
    manifest.assignmentIds,
    manifest.assignmentReviewerIds,
    manifest.assignmentFingerprint,
    manifest.evidenceFingerprint,
    manifest.progressRevision,
    manifest.progressFingerprint,
    manifest.planFingerprint,
  ]));
}

export function buildHoidTopicAssignmentPromotionPlan(
  assignmentsInput: unknown,
  progressInput: unknown,
  approvedClaimsInput?: unknown,
  approvedKnowledgeInput?: unknown,
): HoidTopicAssignmentPromotionBuildResult {
  const validation = validateHoidTopicAssignments(assignmentsInput, approvedClaimsInput, approvedKnowledgeInput);
  if (validation.status !== "valid") {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-assignments",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  if (validation.assignments.length === 0) {
    return Object.freeze({
      status: "blocked",
      reason: "no-topic-assignments",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  const projection = projectHoidCursorProgressSnapshot(progressInput);
  if (projection.status !== "ready") {
    return Object.freeze({
      status: "blocked",
      reason: "invalid-progress",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  const assignmentIds = Object.freeze(validation.assignments.map(item => item.id).sort());
  const assignmentReviewerIds = Object.freeze(
    [...new Set(validation.assignments.map(item => item.review.reviewerId))].sort(),
  );
  const evidenceDigest = evidenceFingerprint(
    validation.evidenceCitations,
    validation.entityFirstAppearances,
  );
  if (!evidenceDigest) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-assignments",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  const base = Object.freeze({
    schemaVersion: 1 as const,
    status: "ready-for-protected-review" as const,
    assignmentCount: validation.assignments.length,
    assignmentIds,
    assignmentReviewerIds,
    assignmentFingerprint: assignmentFingerprint(validation.assignments),
    evidenceFingerprint: evidenceDigest,
    progressRevision: projection.revision,
    progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
    requiresProtectedReview: true as const,
    promotionAllowed: false as const,
    productionWritePerformed: false as const,
  });
  const plan = Object.freeze({ ...base, fingerprint: planFingerprint(base) });
  if (!canonicalPlan(plan)) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-plan",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  return Object.freeze({
    status: "ready",
    plan,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

export function buildProductionHoidTopicAssignmentPromotionPlan(
  progressInput: unknown,
): HoidTopicAssignmentPromotionBuildResult {
  return buildHoidTopicAssignmentPromotionPlan(HOID_APPROVED_TOPIC_ASSIGNMENTS, progressInput);
}

export function buildHoidTopicAssignmentPromotionManifest(
  planInput: unknown,
): HoidTopicAssignmentPromotionManifestResult {
  const plan = canonicalPlan(planInput);
  if (!plan) return Object.freeze({ status: "invalid", reason: "invalid-plan" });
  const base = Object.freeze({
    schemaVersion: 1 as const,
    assignmentCount: plan.assignmentCount,
    assignmentIds: plan.assignmentIds,
    assignmentReviewerIds: plan.assignmentReviewerIds,
    assignmentFingerprint: plan.assignmentFingerprint,
    evidenceFingerprint: plan.evidenceFingerprint,
    progressRevision: plan.progressRevision,
    progressFingerprint: plan.progressFingerprint,
    planFingerprint: plan.fingerprint,
  });
  return Object.freeze({
    status: "valid",
    manifest: Object.freeze({ ...base, manifestFingerprint: manifestFingerprint(base) }),
  });
}

export function validateHoidTopicAssignmentPromotionManifest(
  manifestInput: unknown,
  planInput: unknown,
): HoidTopicAssignmentPromotionManifestResult {
  const plan = canonicalPlan(planInput);
  if (!plan) return Object.freeze({ status: "invalid", reason: "invalid-plan" });
  const raw = canonicalRecord(manifestInput, MANIFEST_KEYS);
  if (!raw || raw.schemaVersion !== 1) {
    return Object.freeze({ status: "invalid", reason: "invalid-manifest" });
  }
  const built = buildHoidTopicAssignmentPromotionManifest(plan);
  if (built.status !== "valid") return built;
  const supplied = Object.freeze({
    schemaVersion: 1 as const,
    assignmentCount: raw.assignmentCount,
    assignmentIds: raw.assignmentIds,
    assignmentReviewerIds: raw.assignmentReviewerIds,
    assignmentFingerprint: raw.assignmentFingerprint,
    evidenceFingerprint: raw.evidenceFingerprint,
    progressRevision: raw.progressRevision,
    progressFingerprint: raw.progressFingerprint,
    planFingerprint: raw.planFingerprint,
    manifestFingerprint: raw.manifestFingerprint,
  });
  if (JSON.stringify(supplied) !== JSON.stringify(built.manifest)) {
    return Object.freeze({ status: "invalid", reason: "manifest-mismatch" });
  }
  return built;
}

function canonicalRequest(value: unknown): HoidPromotionReviewRequest | null {
  const raw = canonicalRecord(value, REQUEST_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
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
    !COMMIT_SHA_PATTERN.test(raw.expectedHeadSha) ||
    raw.promotionManifestPath !== HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH ||
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
    promotionManifestPath: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
    minimumApprovals: raw.minimumApprovals as number,
    requireCodeOwnerReview: raw.requireCodeOwnerReview,
    requireDismissStaleReviews: raw.requireDismissStaleReviews,
    requireEnforcedAdmins: raw.requireEnforcedAdmins,
  });
}

function methodFromPort<T>(value: unknown, methodName: string): ((request?: T) => Promise<unknown>) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 4; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, methodName);
      if (descriptor) {
        if (!Object.prototype.hasOwnProperty.call(descriptor, "value") || typeof descriptor.value !== "function") {
          return null;
        }
        return (descriptor.value as (request?: T) => Promise<unknown>).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

type TimedOutcome =
  | Readonly<{ kind: "value"; value: unknown }>
  | Readonly<{ kind: "error" }>
  | Readonly<{ kind: "timeout" }>;

async function callWithTimeout(call: () => Promise<unknown>): Promise<TimedOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = Promise.resolve().then(call).then<TimedOutcome, TimedOutcome>(
    value => Object.freeze({ kind: "value", value }),
    () => Object.freeze({ kind: "error" }),
  );
  const timeout = new Promise<TimedOutcome>(resolve => {
    timer = setTimeout(() => resolve(Object.freeze({ kind: "timeout" })), DEFAULT_TIMEOUT_MS);
  });
  const outcome = await Promise.race([result, timeout]);
  if (timer !== undefined) clearTimeout(timer);
  return outcome;
}

function progressFailure(plan: HoidTopicAssignmentPromotionPlan, snapshot: unknown): "invalid-progress" | "progress-changed" | null {
  const projection = projectHoidCursorProgressSnapshot(snapshot);
  if (projection.status !== "ready") return "invalid-progress";
  return projection.revision === plan.progressRevision &&
    fingerprintHoidCursorProgressProjection(projection) === plan.progressFingerprint
    ? null
    : "progress-changed";
}

function blocked(
  reason: Extract<HoidTopicAssignmentPromotionAuthorization, { status: "blocked" }>["reason"],
  verificationReason?: string,
): HoidTopicAssignmentPromotionAuthorization {
  return Object.freeze({
    status: "blocked",
    reason,
    ...(verificationReason ? { verificationReason } : {}),
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

/**
 * Authorizes a maintainer-controlled topic-assignment commit only when every
 * assignment reviewer is an authenticated, non-author approval on the exact
 * protected PR head. The source-control adapter must read the fixed manifest
 * path at that exact SHA and return its plan fingerprint.
 */
export async function authorizeHoidTopicAssignmentPromotion(
  planInput: unknown,
  assignmentsInput: unknown,
  requestInput: unknown,
  sourceControlPortInput: unknown,
  progressPortInput: unknown,
  approvedClaimsInput?: unknown,
  approvedKnowledgeInput?: unknown,
): Promise<HoidTopicAssignmentPromotionAuthorization> {
  const plan = canonicalPlan(planInput);
  if (!plan) return blocked("invalid-plan");
  const request = canonicalRequest(requestInput);
  if (!request) return blocked("invalid-request");

  const fetchSnapshot = methodFromPort<HoidProtectedReviewFetchRequest>(
    sourceControlPortInput,
    "fetchProtectedReviewSnapshot",
  );
  if (!fetchSnapshot) return blocked("invalid-source-control-port");
  const readProgress = methodFromPort<never>(progressPortInput, "readAuthoritativeProgressSnapshot");
  if (!readProgress) return blocked("invalid-progress-port");

  const before = await callWithTimeout(readProgress);
  if (before.kind === "timeout") return blocked("progress-timeout");
  if (before.kind === "error") return blocked("progress-source-unavailable");
  const beforeFailure = progressFailure(plan, before.value);
  if (beforeFailure) return blocked(beforeFailure);

  const rebuilt = buildHoidTopicAssignmentPromotionPlan(
    assignmentsInput,
    before.value,
    approvedClaimsInput,
    approvedKnowledgeInput,
  );
  if (rebuilt.status !== "ready") return blocked("invalid-assignments");
  if (rebuilt.plan.fingerprint !== plan.fingerprint) return blocked("assignments-changed");

  const fetchRequest: HoidProtectedReviewFetchRequest = Object.freeze({
    ...request,
    promotionPlanFingerprint: plan.fingerprint,
  });
  const fetched = await callWithTimeout(() => fetchSnapshot(fetchRequest));
  if (fetched.kind === "timeout") return blocked("review-timeout");
  if (fetched.kind === "error") return blocked("review-source-unavailable");

  const verification = verifyHoidProtectedReviewSnapshot(request, fetched.value, plan.fingerprint);
  if (verification.status !== "verified") {
    return blocked("review-not-satisfied", verification.reason);
  }
  const authenticated = new Set(verification.approvalReviewerIds);
  if (!plan.assignmentReviewerIds.every(reviewerId => authenticated.has(reviewerId))) {
    return blocked("assignment-reviewer-not-authenticated");
  }

  const after = await callWithTimeout(readProgress);
  if (after.kind === "timeout") return blocked("progress-timeout");
  if (after.kind === "error") return blocked("progress-source-unavailable");
  const afterFailure = progressFailure(plan, after.value);
  if (afterFailure) return blocked(afterFailure);

  return Object.freeze({
    status: "ready-for-maintainer-commit",
    repositoryFullName: request.repositoryFullName,
    pullRequestNumber: request.pullRequestNumber,
    headSha: verification.headSha,
    promotionPlanFingerprint: verification.promotionPlanFingerprint,
    assignmentFingerprint: plan.assignmentFingerprint,
    authenticatedAssignmentReviewerIds: plan.assignmentReviewerIds,
    approvalReviewerIds: verification.approvalReviewerIds,
    requiredApprovals: verification.requiredApprovals,
    protectedReviewVerified: true,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

export function authorizeProductionHoidTopicAssignmentPromotion(
  planInput: unknown,
  requestInput: unknown,
  sourceControlPortInput: unknown,
  progressPortInput: unknown,
): Promise<HoidTopicAssignmentPromotionAuthorization> {
  return authorizeHoidTopicAssignmentPromotion(
    planInput,
    HOID_APPROVED_TOPIC_ASSIGNMENTS,
    requestInput,
    sourceControlPortInput,
    progressPortInput,
  );
}
