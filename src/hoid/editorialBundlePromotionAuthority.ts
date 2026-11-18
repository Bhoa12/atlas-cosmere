import {
  validateHoidEditorialReviewBundleManifest,
  validateHoidEditorialReviewBundleReceipts,
  type HoidEditorialReviewPacketReference,
} from "./editorialReviewBundle";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import {
  verifyHoidProtectedReviewSnapshot,
  type HoidPromotionReviewRequest,
  type HoidProtectedReviewFetchRequest,
  type HoidSourceControlReviewPort,
} from "./promotionReviewAuthority";
import { sha256Hex } from "./sha256";

export type HoidEditorialBundlePromotionPlan = Readonly<{
  schemaVersion: 1;
  status: "ready-for-protected-review";
  reviewBundleFingerprint: string;
  knowledgeBundleFingerprint: string;
  receiptsFingerprint: string;
  receiptReviewerIds: readonly string[];
  packetCount: number;
  packets: readonly HoidEditorialReviewPacketReference[];
  progressRevision: number;
  progressFingerprint: string;
  requiresProtectedReview: true;
  promotionAllowed: false;
  productionWritePerformed: false;
  fingerprint: string;
}>;

export type HoidEditorialBundlePromotionBuildResult =
  | Readonly<{
      status: "ready-for-protected-review";
      plan: HoidEditorialBundlePromotionPlan;
      approvedCount: number;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "editorial-review-incomplete"
        | "editorial-review-needs-revision"
        | "invalid-progress";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-review-bundle"
        | "invalid-receipts"
        | "invalid-receipt-serialization"
        | "invalid-plan";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

export type HoidEditorialBundlePromotionPlanValidation =
  | Readonly<{ status: "valid"; plan: HoidEditorialBundlePromotionPlan }>
  | Readonly<{ status: "invalid"; reason: "invalid-plan" | "plan-fingerprint-mismatch" }>;

export type HoidEditorialBundlePromotionContext = Readonly<{
  reviewManifest: unknown;
  knowledgeManifest: unknown;
  source: unknown;
  receipts: unknown;
}>;

export type HoidEditorialBundlePromotionAuthorization =
  | Readonly<{
      status: "ready-for-maintainer-commit";
      repositoryFullName: string;
      pullRequestNumber: number;
      headSha: string;
      promotionPlanFingerprint: string;
      reviewBundleFingerprint: string;
      receiptsFingerprint: string;
      authenticatedReceiptReviewerIds: readonly string[];
      approvalReviewerIds: readonly string[];
      requiredApprovals: number;
      protectedReviewVerified: true;
      editorialReviewComplete: true;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "invalid-plan"
        | "invalid-editorial-context"
        | "invalid-request"
        | "invalid-source-control-port"
        | "review-source-unavailable"
        | "review-timeout"
        | "review-not-satisfied"
        | "invalid-progress-port"
        | "progress-source-unavailable"
        | "progress-timeout"
        | "invalid-progress"
        | "progress-changed"
        | "editorial-bundle-invalid"
        | "editorial-review-incomplete"
        | "editorial-review-needs-revision"
        | "editorial-bundle-changed"
        | "editorial-reviewer-not-authenticated";
      verificationReason?: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

const PLAN_KEYS = new Set([
  "schemaVersion",
  "status",
  "reviewBundleFingerprint",
  "knowledgeBundleFingerprint",
  "receiptsFingerprint",
  "receiptReviewerIds",
  "packetCount",
  "packets",
  "progressRevision",
  "progressFingerprint",
  "requiresProtectedReview",
  "promotionAllowed",
  "productionWritePerformed",
  "fingerprint",
]);
const PACKET_KEYS = new Set(["category", "draftId", "packetId", "contentSha256"]);
const CONTEXT_KEYS = new Set(["reviewManifest", "knowledgeManifest", "source", "receipts"]);
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
const SHA_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40,64}$/;
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/;
const PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]{1,240}$/;
const MAX_PACKETS = 2_048;
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

function canonicalDenseArray(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length > maximum) return null;
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

function canonicalPacketReference(value: unknown): HoidEditorialReviewPacketReference | null {
  const raw = canonicalRecord(value, PACKET_KEYS);
  if (
    !raw ||
    !(raw.category === "summary" || raw.category === "atomic-claim" ||
      raw.category === "entity" || raw.category === "relationship") ||
    typeof raw.draftId !== "string" ||
    !ID_PATTERN.test(raw.draftId) ||
    typeof raw.packetId !== "string" ||
    !(raw.category === "summary"
      ? /^review:[a-f0-9]{64}$/.test(raw.packetId)
      : SHA_PATTERN.test(raw.packetId)) ||
    typeof raw.contentSha256 !== "string" ||
    !SHA_PATTERN.test(raw.contentSha256)
  ) return null;
  return Object.freeze({
    category: raw.category as HoidEditorialReviewPacketReference["category"],
    draftId: raw.draftId,
    packetId: raw.packetId,
    contentSha256: raw.contentSha256,
  });
}

function comparePackets(
  left: HoidEditorialReviewPacketReference,
  right: HoidEditorialReviewPacketReference,
): number {
  const order = { summary: 0, "atomic-claim": 1, entity: 2, relationship: 3 } as const;
  const categoryOrder = order[left.category] - order[right.category];
  if (categoryOrder !== 0) return categoryOrder;
  return left.draftId < right.draftId ? -1 : left.draftId > right.draftId ? 1 : 0;
}

function planFingerprint(plan: Omit<HoidEditorialBundlePromotionPlan, "fingerprint">): string {
  return sha256Hex(JSON.stringify([
    "hoid-editorial-bundle-promotion-plan-v1",
    plan.reviewBundleFingerprint,
    plan.knowledgeBundleFingerprint,
    plan.receiptsFingerprint,
    plan.receiptReviewerIds,
    plan.packetCount,
    plan.packets,
    plan.progressRevision,
    plan.progressFingerprint,
  ]));
}

function extractReceiptReviewerIds(value: unknown): readonly string[] | null {
  const raw = canonicalRecord(value, new Set([
    "schemaVersion", "reviewBundleFingerprint", "summaries", "claims", "entities", "relationships",
  ]));
  if (!raw || raw.schemaVersion !== 1) return null;
  const ids = new Set<string>();
  for (const key of ["summaries", "claims", "entities", "relationships"]) {
    const receipts = canonicalDenseArray(raw[key], MAX_PACKETS);
    if (!receipts) return null;
    for (const receipt of receipts) {
      try {
        if (receipt === null || typeof receipt !== "object" || Array.isArray(receipt)) return null;
        const prototype = Object.getPrototypeOf(receipt);
        if (prototype !== Object.prototype && prototype !== null) return null;
        const descriptor = Object.getOwnPropertyDescriptor(receipt, "reviewerId");
        if (
          !descriptor ||
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true ||
          typeof descriptor.value !== "string" ||
          !descriptor.value.trim() ||
          descriptor.value.length > 128
        ) return null;
        ids.add(descriptor.value);
      } catch {
        return null;
      }
    }
  }
  return ids.size > 0 ? Object.freeze([...ids].sort()) : null;
}

function invalidBuild(
  reason: Extract<HoidEditorialBundlePromotionBuildResult, { status: "invalid" }>["reason"],
): HoidEditorialBundlePromotionBuildResult {
  return Object.freeze({
    status: "invalid",
    reason,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

/**
 * Build a metadata-only promotion plan after every review packet has a valid
 * approved receipt. Structural receipts are not reviewer authentication.
 */
export function buildHoidEditorialBundlePromotionPlan(
  reviewManifestInput: unknown,
  knowledgeManifestInput: unknown,
  sourceInput: unknown,
  receiptsInput: unknown,
  progressSnapshotInput: unknown,
): HoidEditorialBundlePromotionBuildResult {
  const review = validateHoidEditorialReviewBundleManifest(
    reviewManifestInput,
    knowledgeManifestInput,
    sourceInput,
  );
  if (review.status !== "valid") return invalidBuild("invalid-review-bundle");

  const receipts = validateHoidEditorialReviewBundleReceipts(
    reviewManifestInput,
    knowledgeManifestInput,
    sourceInput,
    receiptsInput,
  );
  if (receipts.status === "invalid") return invalidBuild("invalid-receipts");
  if (receipts.status === "incomplete") {
    return Object.freeze({
      status: "blocked",
      reason: "editorial-review-incomplete",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  if (receipts.status === "needs-revision") {
    return Object.freeze({
      status: "blocked",
      reason: "editorial-review-needs-revision",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const projection = projectHoidCursorProgressSnapshot(progressSnapshotInput);
  if (projection.status !== "ready") {
    return Object.freeze({
      status: "blocked",
      reason: "invalid-progress",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const receiptReviewerIds = extractReceiptReviewerIds(receiptsInput);
  if (!receiptReviewerIds) return invalidBuild("invalid-receipts");

  let serializedReceipts: string;
  try {
    serializedReceipts = JSON.stringify(receiptsInput);
  } catch {
    return invalidBuild("invalid-receipt-serialization");
  }
  if (typeof serializedReceipts !== "string") return invalidBuild("invalid-receipt-serialization");

  const base = Object.freeze({
    schemaVersion: 1 as const,
    status: "ready-for-protected-review" as const,
    reviewBundleFingerprint: review.manifest.fingerprint,
    knowledgeBundleFingerprint: review.manifest.knowledgeBundleFingerprint,
    receiptsFingerprint: sha256Hex(serializedReceipts),
    receiptReviewerIds,
    packetCount: review.manifest.packets.length,
    packets: review.manifest.packets,
    progressRevision: projection.revision,
    progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
    requiresProtectedReview: true as const,
    promotionAllowed: false as const,
    productionWritePerformed: false as const,
  });
  const plan: HoidEditorialBundlePromotionPlan = Object.freeze({
    ...base,
    fingerprint: planFingerprint(base),
  });
  return Object.freeze({
    status: "ready-for-protected-review",
    plan,
    approvedCount: receipts.approvedCount,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

export function validateHoidEditorialBundlePromotionPlan(
  value: unknown,
): HoidEditorialBundlePromotionPlanValidation {
  const raw = canonicalRecord(value, PLAN_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    raw.status !== "ready-for-protected-review" ||
    typeof raw.reviewBundleFingerprint !== "string" ||
    !SHA_PATTERN.test(raw.reviewBundleFingerprint) ||
    typeof raw.knowledgeBundleFingerprint !== "string" ||
    !SHA_PATTERN.test(raw.knowledgeBundleFingerprint) ||
    typeof raw.receiptsFingerprint !== "string" ||
    !SHA_PATTERN.test(raw.receiptsFingerprint) ||
    !Number.isSafeInteger(raw.packetCount) ||
    (raw.packetCount as number) < 1 ||
    (raw.packetCount as number) > MAX_PACKETS ||
    !Number.isSafeInteger(raw.progressRevision) ||
    (raw.progressRevision as number) < 0 ||
    typeof raw.progressFingerprint !== "string" ||
    !SHA_PATTERN.test(raw.progressFingerprint) ||
    raw.requiresProtectedReview !== true ||
    raw.promotionAllowed !== false ||
    raw.productionWritePerformed !== false ||
    typeof raw.fingerprint !== "string" ||
    !SHA_PATTERN.test(raw.fingerprint)
  ) return Object.freeze({ status: "invalid", reason: "invalid-plan" });

  const rawReviewerIds = canonicalDenseArray(raw.receiptReviewerIds, 128);
  if (!rawReviewerIds || rawReviewerIds.length === 0) {
    return Object.freeze({ status: "invalid", reason: "invalid-plan" });
  }
  const receiptReviewerIds: string[] = [];
  const reviewerSet = new Set<string>();
  for (const item of rawReviewerIds) {
    if (typeof item !== "string" || !item.trim() || item.length > 128 || reviewerSet.has(item)) {
      return Object.freeze({ status: "invalid", reason: "invalid-plan" });
    }
    reviewerSet.add(item);
    receiptReviewerIds.push(item);
  }
  if ([...receiptReviewerIds].sort().some((id, index) => id !== receiptReviewerIds[index])) {
    return Object.freeze({ status: "invalid", reason: "invalid-plan" });
  }

  const rawPackets = canonicalDenseArray(raw.packets, MAX_PACKETS);
  if (!rawPackets || rawPackets.length !== raw.packetCount) {
    return Object.freeze({ status: "invalid", reason: "invalid-plan" });
  }
  const packets: HoidEditorialReviewPacketReference[] = [];
  const seen = new Set<string>();
  for (const item of rawPackets) {
    const packet = canonicalPacketReference(item);
    if (!packet) return Object.freeze({ status: "invalid", reason: "invalid-plan" });
    const key = packet.category + ":" + packet.draftId;
    if (seen.has(key)) return Object.freeze({ status: "invalid", reason: "invalid-plan" });
    seen.add(key);
    packets.push(packet);
  }
  const sorted = [...packets].sort(comparePackets);
  if (JSON.stringify(sorted) !== JSON.stringify(packets)) {
    return Object.freeze({ status: "invalid", reason: "invalid-plan" });
  }

  const base = Object.freeze({
    schemaVersion: 1 as const,
    status: "ready-for-protected-review" as const,
    reviewBundleFingerprint: raw.reviewBundleFingerprint,
    knowledgeBundleFingerprint: raw.knowledgeBundleFingerprint,
    receiptsFingerprint: raw.receiptsFingerprint,
    receiptReviewerIds: Object.freeze(receiptReviewerIds),
    packetCount: raw.packetCount as number,
    packets: Object.freeze(packets),
    progressRevision: raw.progressRevision as number,
    progressFingerprint: raw.progressFingerprint,
    requiresProtectedReview: true as const,
    promotionAllowed: false as const,
    productionWritePerformed: false as const,
  });
  const expectedFingerprint = planFingerprint(base);
  if (expectedFingerprint !== raw.fingerprint) {
    return Object.freeze({ status: "invalid", reason: "plan-fingerprint-mismatch" });
  }
  return Object.freeze({
    status: "valid",
    plan: Object.freeze({ ...base, fingerprint: expectedFingerprint }),
  });
}

function canonicalContext(value: unknown): HoidEditorialBundlePromotionContext | null {
  const raw = canonicalRecord(value, CONTEXT_KEYS);
  if (!raw) return null;
  return Object.freeze({
    reviewManifest: raw.reviewManifest,
    knowledgeManifest: raw.knowledgeManifest,
    source: raw.source,
    receipts: raw.receipts,
  });
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

function methodFromPort<T>(
  value: unknown,
  methodName: string,
): ((request?: T) => Promise<unknown>) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 4; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, methodName);
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as (request?: T) => Promise<unknown>).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

function currentProgressFailure(
  plan: HoidEditorialBundlePromotionPlan,
  snapshot: unknown,
): "invalid-progress" | "progress-changed" | null {
  const projection = projectHoidCursorProgressSnapshot(snapshot);
  if (projection.status !== "ready") return "invalid-progress";
  return projection.revision === plan.progressRevision &&
    fingerprintHoidCursorProgressProjection(projection) === plan.progressFingerprint
    ? null
    : "progress-changed";
}

type TimedOutcome =
  | Readonly<{ kind: "value"; value: unknown }>
  | Readonly<{ kind: "error" }>
  | Readonly<{ kind: "timeout" }>;

async function callWithTimeout(call: () => Promise<unknown>): Promise<TimedOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = Promise.resolve()
    .then(call)
    .then<TimedOutcome, TimedOutcome>(
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

function blocked(
  reason: Extract<HoidEditorialBundlePromotionAuthorization, { status: "blocked" }>["reason"],
  verificationReason?: string,
): HoidEditorialBundlePromotionAuthorization {
  return Object.freeze({
    status: "blocked",
    reason,
    ...(verificationReason ? { verificationReason } : {}),
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

/**
 * Rebuilds the complete four-category review plan, verifies the exact protected
 * source-control review, and reads the live SQLite-backed progress before and
 * after the asynchronous review fetch. It never writes production or merges PRs.
 */
export async function authorizeHoidEditorialBundlePromotion(
  planInput: unknown,
  contextInput: unknown,
  requestInput: unknown,
  sourceControlPortInput: unknown,
  progressPortInput: unknown,
): Promise<HoidEditorialBundlePromotionAuthorization> {
  const validation = validateHoidEditorialBundlePromotionPlan(planInput);
  if (validation.status !== "valid") return blocked("invalid-plan");
  const plan = validation.plan;
  const context = canonicalContext(contextInput);
  if (!context) return blocked("invalid-editorial-context");
  const request = canonicalRequest(requestInput);
  if (!request) return blocked("invalid-request");

  const fetchSnapshot = methodFromPort<HoidProtectedReviewFetchRequest>(
    sourceControlPortInput,
    "fetchProtectedReviewSnapshot",
  ) as ((request: HoidProtectedReviewFetchRequest) => Promise<unknown>) | null;
  if (!fetchSnapshot) return blocked("invalid-source-control-port");

  const readProgress = methodFromPort<never>(
    progressPortInput,
    "readAuthoritativeProgressSnapshot",
  ) as (() => Promise<unknown>) | null;
  if (!readProgress) return blocked("invalid-progress-port");

  const before = await callWithTimeout(readProgress);
  if (before.kind === "timeout") return blocked("progress-timeout");
  if (before.kind === "error") return blocked("progress-source-unavailable");
  const beforeFailure = currentProgressFailure(plan, before.value);
  if (beforeFailure) return blocked(beforeFailure);

  const rebuilt = buildHoidEditorialBundlePromotionPlan(
    context.reviewManifest,
    context.knowledgeManifest,
    context.source,
    context.receipts,
    before.value,
  );
  if (rebuilt.status === "invalid") return blocked("editorial-bundle-invalid");
  if (rebuilt.status === "blocked") return blocked(rebuilt.reason);
  if (rebuilt.plan.fingerprint !== plan.fingerprint) return blocked("editorial-bundle-changed");

  const fetchRequest: HoidProtectedReviewFetchRequest = Object.freeze({
    ...request,
    promotionPlanFingerprint: plan.fingerprint,
  });
  const outcome = await callWithTimeout(() => fetchSnapshot(fetchRequest));
  if (outcome.kind === "timeout") return blocked("review-timeout");
  if (outcome.kind === "error") return blocked("review-source-unavailable");

  const verification = verifyHoidProtectedReviewSnapshot(request, outcome.value, plan.fingerprint);
  if (verification.status !== "verified") {
    return blocked("review-not-satisfied", verification.reason);
  }
  if (plan.receiptReviewerIds.some(id => !verification.approvalReviewerIds.includes(id))) {
    return blocked("editorial-reviewer-not-authenticated");
  }

  const after = await callWithTimeout(readProgress);
  if (after.kind === "timeout") return blocked("progress-timeout");
  if (after.kind === "error") return blocked("progress-source-unavailable");
  const afterFailure = currentProgressFailure(plan, after.value);
  if (afterFailure) return blocked(afterFailure);

  return Object.freeze({
    status: "ready-for-maintainer-commit",
    repositoryFullName: request.repositoryFullName,
    pullRequestNumber: request.pullRequestNumber,
    headSha: verification.headSha,
    promotionPlanFingerprint: verification.promotionPlanFingerprint,
    reviewBundleFingerprint: plan.reviewBundleFingerprint,
    receiptsFingerprint: plan.receiptsFingerprint,
    authenticatedReceiptReviewerIds: plan.receiptReviewerIds,
    approvalReviewerIds: verification.approvalReviewerIds,
    requiredApprovals: verification.requiredApprovals,
    protectedReviewVerified: true,
    editorialReviewComplete: true,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}
