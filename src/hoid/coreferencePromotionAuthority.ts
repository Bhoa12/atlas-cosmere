import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import {
  verifyHoidProtectedReviewSnapshot,
  type HoidPromotionReviewRequest,
  type HoidProtectedReviewFetchRequest,
} from "./promotionReviewAuthority";
import {
  auditHoidCoreferenceRegistry,
  areHoidCoreferenceRecordsUnlocked,
  type HoidCoreferenceRegistryAuditResult,
} from "./coreferenceResolver";
import { HOID_COREFERENCE_REGISTRY } from "./coreferenceRegistry";
import { sha256Hex } from "./sha256";

export const HOID_COREFERENCE_PROMOTION_MANIFEST_PATH =
  "docs/hoid/coreference-promotion.manifest.json";

export type HoidCoreferencePromotionPlan = Readonly<{
  schemaVersion: 1;
  status: "ready-for-protected-review";
  recordCount: number;
  recordIds: readonly string[];
  entityIds: readonly string[];
  reviewerIds: readonly string[];
  registryFingerprint: string;
  evidenceFingerprint: string;
  progressRevision: number;
  progressFingerprint: string;
  requiresProtectedReview: true;
  promotionAllowed: false;
  productionWritePerformed: false;
  fingerprint: string;
}>;

export type HoidCoreferencePromotionBuildResult =
  | Readonly<{
      status: "ready";
      plan: HoidCoreferencePromotionPlan;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason: "no-coreference-records" | "invalid-progress" | "source-evidence-not-unlocked";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-registry" | "invalid-plan";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

export type HoidCoreferencePromotionManifest = Readonly<{
  schemaVersion: 1;
  recordCount: number;
  recordIds: readonly string[];
  entityIds: readonly string[];
  reviewerIds: readonly string[];
  registryFingerprint: string;
  evidenceFingerprint: string;
  progressRevision: number;
  progressFingerprint: string;
  planFingerprint: string;
  manifestFingerprint: string;
}>;

export type HoidCoreferencePromotionManifestResult =
  | Readonly<{ status: "valid"; manifest: HoidCoreferencePromotionManifest }>
  | Readonly<{ status: "invalid"; reason: "invalid-plan" | "invalid-manifest" | "manifest-mismatch" }>;

export type HoidCoreferencePromotionRequest = HoidPromotionReviewRequest;

export type HoidCoreferencePromotionAuthorization =
  | Readonly<{
      status: "ready-for-maintainer-commit";
      repositoryFullName: string;
      pullRequestNumber: number;
      headSha: string;
      promotionPlanFingerprint: string;
      registryFingerprint: string;
      authenticatedReviewerIds: readonly string[];
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
        | "invalid-registry"
        | "registry-changed"
        | "invalid-request"
        | "invalid-source-control-port"
        | "review-source-unavailable"
        | "review-timeout"
        | "review-not-satisfied"
        | "reviewer-not-authenticated"
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
  "schemaVersion", "status", "recordCount", "recordIds", "entityIds", "reviewerIds",
  "registryFingerprint", "evidenceFingerprint", "progressRevision", "progressFingerprint",
  "requiresProtectedReview", "promotionAllowed", "productionWritePerformed", "fingerprint",
]);
const MANIFEST_KEYS = new Set([
  "schemaVersion", "recordCount", "recordIds", "entityIds", "reviewerIds",
  "registryFingerprint", "evidenceFingerprint", "progressRevision", "progressFingerprint",
  "planFingerprint", "manifestFingerprint",
]);
const REQUEST_KEYS = new Set([
  "schemaVersion", "repositoryFullName", "pullRequestNumber", "expectedBaseRef",
  "expectedHeadRef", "expectedHeadSha", "promotionManifestPath", "minimumApprovals",
  "requireCodeOwnerReview", "requireDismissStaleReviews", "requireEnforcedAdmins",
]);
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40,64}$/u;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/u;
const REVIEWER_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
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
    for (const key of allowedKeys) if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    return result;
  } catch {
    return null;
  }
}

function canonicalStrings(value: unknown, maximum: number, pattern: RegExp): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length > maximum || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const values: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
      const item = descriptor.value;
      if (typeof item !== "string" || !pattern.test(item) || seen.has(item)) return null;
      seen.add(item);
      values.push(item);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) return null;
    }
    const sorted = [...values].sort();
    if (sorted.some((item, index) => item !== values[index])) return null;
    return Object.freeze(values);
  } catch {
    return null;
  }
}

function planFingerprint(plan: Omit<HoidCoreferencePromotionPlan, "fingerprint">): string {
  return sha256Hex(JSON.stringify([
    "hoid-coreference-promotion-v1",
    plan.recordCount,
    plan.recordIds,
    plan.entityIds,
    plan.reviewerIds,
    plan.registryFingerprint,
    plan.evidenceFingerprint,
    plan.progressRevision,
    plan.progressFingerprint,
  ]));
}

function canonicalPlan(value: unknown): HoidCoreferencePromotionPlan | null {
  const raw = canonicalRecord(value, PLAN_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    raw.status !== "ready-for-protected-review" ||
    !Number.isSafeInteger(raw.recordCount) ||
    (raw.recordCount as number) < 1 ||
    (raw.recordCount as number) > 512 ||
    raw.requiresProtectedReview !== true ||
    raw.promotionAllowed !== false ||
    raw.productionWritePerformed !== false ||
    !Number.isSafeInteger(raw.progressRevision) ||
    (raw.progressRevision as number) < 0 ||
    typeof raw.progressFingerprint !== "string" ||
    !SHA_PATTERN.test(raw.progressFingerprint) ||
    typeof raw.registryFingerprint !== "string" ||
    !SHA_PATTERN.test(raw.registryFingerprint) ||
    typeof raw.evidenceFingerprint !== "string" ||
    !SHA_PATTERN.test(raw.evidenceFingerprint) ||
    typeof raw.fingerprint !== "string" ||
    !SHA_PATTERN.test(raw.fingerprint)
  ) return null;

  const recordIds = canonicalStrings(raw.recordIds, 512, /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u);
  const entityIds = canonicalStrings(raw.entityIds, 512, /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u);
  const reviewerIds = canonicalStrings(raw.reviewerIds, 512, REVIEWER_PATTERN);
  if (!recordIds || !entityIds || !reviewerIds || recordIds.length !== raw.recordCount || entityIds.length === 0 || reviewerIds.length === 0) return null;

  const base = Object.freeze({
    schemaVersion: 1 as const,
    status: "ready-for-protected-review" as const,
    recordCount: raw.recordCount as number,
    recordIds,
    entityIds,
    reviewerIds,
    registryFingerprint: raw.registryFingerprint,
    evidenceFingerprint: raw.evidenceFingerprint,
    progressRevision: raw.progressRevision as number,
    progressFingerprint: raw.progressFingerprint,
    requiresProtectedReview: true as const,
    promotionAllowed: false as const,
    productionWritePerformed: false as const,
  });
  const plan = Object.freeze({ ...base, fingerprint: raw.fingerprint });
  return planFingerprint(base) === plan.fingerprint ? plan : null;
}

export function buildHoidCoreferencePromotionPlan(
  registryInput: unknown,
  progressInput: unknown,
): HoidCoreferencePromotionBuildResult {
  const audit: HoidCoreferenceRegistryAuditResult = auditHoidCoreferenceRegistry(registryInput);
  if (audit.status !== "valid") return Object.freeze({
    status: "invalid",
    reason: "invalid-registry",
    promotionAllowed: false,
    productionWritePerformed: false,
  });
  if (audit.recordCount === 0) return Object.freeze({
    status: "blocked",
    reason: "no-coreference-records",
    promotionAllowed: false,
    productionWritePerformed: false,
  });

  const projection = projectHoidCursorProgressSnapshot(progressInput);
  if (projection.status !== "ready") return Object.freeze({
    status: "blocked",
    reason: "invalid-progress",
    promotionAllowed: false,
    productionWritePerformed: false,
  });
  if (!areHoidCoreferenceRecordsUnlocked(registryInput, progressInput)) return Object.freeze({
    status: "blocked",
    reason: "source-evidence-not-unlocked",
    promotionAllowed: false,
    productionWritePerformed: false,
  });

  const base = Object.freeze({
    schemaVersion: 1 as const,
    status: "ready-for-protected-review" as const,
    recordCount: audit.recordCount,
    recordIds: audit.recordIds,
    entityIds: audit.entityIds,
    reviewerIds: audit.reviewerIds,
    registryFingerprint: audit.registryFingerprint,
    evidenceFingerprint: audit.evidenceFingerprint,
    progressRevision: projection.revision,
    progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
    requiresProtectedReview: true as const,
    promotionAllowed: false as const,
    productionWritePerformed: false as const,
  });
  const plan = Object.freeze({ ...base, fingerprint: planFingerprint(base) });
  if (!canonicalPlan(plan)) return Object.freeze({
    status: "invalid",
    reason: "invalid-plan",
    promotionAllowed: false,
    productionWritePerformed: false,
  });
  return Object.freeze({
    status: "ready",
    plan,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

export function buildProductionHoidCoreferencePromotionPlan(
  progressInput: unknown,
): HoidCoreferencePromotionBuildResult {
  return buildHoidCoreferencePromotionPlan(HOID_COREFERENCE_REGISTRY, progressInput);
}

function manifestFingerprint(manifest: Omit<HoidCoreferencePromotionManifest, "manifestFingerprint">): string {
  return sha256Hex(JSON.stringify([
    "hoid-coreference-promotion-manifest-v1",
    manifest.recordCount,
    manifest.recordIds,
    manifest.entityIds,
    manifest.reviewerIds,
    manifest.registryFingerprint,
    manifest.evidenceFingerprint,
    manifest.progressRevision,
    manifest.progressFingerprint,
    manifest.planFingerprint,
  ]));
}

export function buildHoidCoreferencePromotionManifest(
  planInput: unknown,
): HoidCoreferencePromotionManifestResult {
  const plan = canonicalPlan(planInput);
  if (!plan) return Object.freeze({ status: "invalid", reason: "invalid-plan" });
  const base = Object.freeze({
    schemaVersion: 1 as const,
    recordCount: plan.recordCount,
    recordIds: plan.recordIds,
    entityIds: plan.entityIds,
    reviewerIds: plan.reviewerIds,
    registryFingerprint: plan.registryFingerprint,
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

export function validateHoidCoreferencePromotionManifest(
  manifestInput: unknown,
  planInput: unknown,
): HoidCoreferencePromotionManifestResult {
  const plan = canonicalPlan(planInput);
  if (!plan) return Object.freeze({ status: "invalid", reason: "invalid-plan" });
  const raw = canonicalRecord(manifestInput, MANIFEST_KEYS);
  if (!raw || raw.schemaVersion !== 1) return Object.freeze({ status: "invalid", reason: "invalid-manifest" });
  const built = buildHoidCoreferencePromotionManifest(plan);
  if (built.status !== "valid") return built;
  const recordIds = canonicalStrings(raw.recordIds, 512, /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u);
  const entityIds = canonicalStrings(raw.entityIds, 512, /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u);
  const reviewerIds = canonicalStrings(raw.reviewerIds, 512, REVIEWER_PATTERN);
  if (!recordIds || !entityIds || !reviewerIds) return Object.freeze({ status: "invalid", reason: "invalid-manifest" });
  const suppliedBase = Object.freeze({
    schemaVersion: 1 as const,
    recordCount: raw.recordCount as number,
    recordIds,
    entityIds,
    reviewerIds,
    registryFingerprint: raw.registryFingerprint as string,
    evidenceFingerprint: raw.evidenceFingerprint as string,
    progressRevision: raw.progressRevision as number,
    progressFingerprint: raw.progressFingerprint as string,
    planFingerprint: raw.planFingerprint as string,
  });
  if (
    !Number.isSafeInteger(raw.recordCount) ||
    typeof raw.registryFingerprint !== "string" || !SHA_PATTERN.test(raw.registryFingerprint) ||
    typeof raw.evidenceFingerprint !== "string" || !SHA_PATTERN.test(raw.evidenceFingerprint) ||
    !Number.isSafeInteger(raw.progressRevision) ||
    typeof raw.progressFingerprint !== "string" || !SHA_PATTERN.test(raw.progressFingerprint) ||
    typeof raw.planFingerprint !== "string" || !SHA_PATTERN.test(raw.planFingerprint) ||
    typeof raw.manifestFingerprint !== "string" || !SHA_PATTERN.test(raw.manifestFingerprint) ||
    manifestFingerprint(suppliedBase) !== raw.manifestFingerprint ||
    JSON.stringify({ ...suppliedBase, manifestFingerprint: manifestFingerprint(suppliedBase) }) !== JSON.stringify(built.manifest)
  ) return Object.freeze({ status: "invalid", reason: "manifest-mismatch" });
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
    raw.promotionManifestPath !== HOID_COREFERENCE_PROMOTION_MANIFEST_PATH ||
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
    promotionManifestPath: HOID_COREFERENCE_PROMOTION_MANIFEST_PATH,
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
        if (!Object.prototype.hasOwnProperty.call(descriptor, "value") || typeof descriptor.value !== "function") return null;
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

function progressFailure(plan: HoidCoreferencePromotionPlan, snapshot: unknown): "invalid-progress" | "progress-changed" | null {
  const projection = projectHoidCursorProgressSnapshot(snapshot);
  if (projection.status !== "ready") return "invalid-progress";
  return projection.revision === plan.progressRevision &&
    fingerprintHoidCursorProgressProjection(projection) === plan.progressFingerprint
    ? null
    : "progress-changed";
}

function blocked(
  reason: Extract<HoidCoreferencePromotionAuthorization, { status: "blocked" }>["reason"],
  verificationReason?: string,
): HoidCoreferencePromotionAuthorization {
  return Object.freeze({
    status: "blocked",
    reason,
    ...(verificationReason ? { verificationReason } : {}),
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

/**
 * Requires the exact registry and source-control head to be reviewed. Even a
 * verified result only authorizes a maintainer-controlled commit; it never
 * writes a production registry or merges a pull request.
 */
export async function authorizeHoidCoreferencePromotion(
  planInput: unknown,
  registryInput: unknown,
  requestInput: unknown,
  sourceControlPortInput: unknown,
  progressPortInput: unknown,
): Promise<HoidCoreferencePromotionAuthorization> {
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

  const rebuilt = buildHoidCoreferencePromotionPlan(registryInput, before.value);
  if (rebuilt.status !== "ready") return blocked("invalid-registry");
  if (rebuilt.plan.fingerprint !== plan.fingerprint) return blocked("registry-changed");

  const fetchRequest: HoidProtectedReviewFetchRequest = Object.freeze({
    ...request,
    promotionPlanFingerprint: plan.fingerprint,
  });
  const fetched = await callWithTimeout(() => fetchSnapshot(fetchRequest));
  if (fetched.kind === "timeout") return blocked("review-timeout");
  if (fetched.kind === "error") return blocked("review-source-unavailable");

  const verification = verifyHoidProtectedReviewSnapshot(request, fetched.value, plan.fingerprint);
  if (verification.status !== "verified") return blocked("review-not-satisfied", verification.reason);
  const authenticated = new Set(verification.approvalReviewerIds);
  if (!plan.reviewerIds.every(reviewerId => authenticated.has(reviewerId))) {
    return blocked("reviewer-not-authenticated");
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
    registryFingerprint: plan.registryFingerprint,
    authenticatedReviewerIds: plan.reviewerIds,
    approvalReviewerIds: verification.approvalReviewerIds,
    requiredApprovals: verification.requiredApprovals,
    protectedReviewVerified: true,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

export function authorizeProductionHoidCoreferencePromotion(
  planInput: unknown,
  requestInput: unknown,
  sourceControlPortInput: unknown,
  progressPortInput: unknown,
): Promise<HoidCoreferencePromotionAuthorization> {
  return authorizeHoidCoreferencePromotion(
    planInput,
    HOID_COREFERENCE_REGISTRY,
    requestInput,
    sourceControlPortInput,
    progressPortInput,
  );
}
