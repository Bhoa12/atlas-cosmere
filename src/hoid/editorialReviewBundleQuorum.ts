import {
  buildHoidEditorialBundlePromotionPlan,
  validateHoidEditorialBundlePromotionPlan,
  type HoidEditorialBundlePromotionPlan,
} from "./editorialBundlePromotionAuthority";
import {
  verifyHoidReviewerBoundPayloadSignatures,
  type HoidApprovedClaimReviewSignatureContext,
  type HoidReviewerBoundPayloadSignatureRequest,
  type HoidReviewerTrustRegistry,
  type HoidReviewerTrustRootKey,
  type HoidEd25519VerificationPort,
} from "./editorialReviewSignatures";

const CONTEXT_KEYS = Object.freeze([
  "schemaVersion",
  "repositoryFullName",
  "pullRequestNumber",
  "baseRef",
  "baseSha",
  "headRef",
  "headSha",
  "promotionManifestPath",
  "promotionPlanFingerprint",
  "reviewBundleFingerprint",
] as const);
const ATTESTATION_KEYS = Object.freeze([
  "schemaVersion",
  "reviewBundleFingerprint",
  "promotionPlanFingerprint",
  "reviewerId",
  "decision",
  "reviewedAt",
  "keyId",
  "signatureHex",
] as const);
const INPUT_KEYS = Object.freeze([
  "plan",
  "reviewManifest",
  "knowledgeManifest",
  "sourceInput",
  "receipts",
  "progressSnapshot",
  "context",
  "attestations",
  "registry",
  "rootKey",
  "verifier",
  "now",
  "minimumRegistryRevision",
] as const);
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,126}$/iu;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const SIGNATURE_PATTERN = /^[a-f0-9]{128}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/u;
const PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]{1,240}$/u;
const MINIMUM_REVIEWERS = 2;
const MAXIMUM_REVIEWERS = 8;

export type HoidEditorialBundleReviewDecision = "approve" | "reject";

export type HoidEditorialBundleReviewAttestation = Readonly<{
  schemaVersion: 1;
  reviewBundleFingerprint: string;
  promotionPlanFingerprint: string;
  reviewerId: string;
  decision: HoidEditorialBundleReviewDecision;
  reviewedAt: string;
  keyId: string;
  signatureHex: string;
}>;

export type HoidEditorialBundleReviewContext = HoidApprovedClaimReviewSignatureContext;

export type HoidEditorialBundleReviewQuorumResult =
  | Readonly<{
      status: "verified";
      reviewBundleFingerprint: string;
      promotionPlanFingerprint: string;
      progressRevision: number;
      verifiedReviewerCount: number;
      reviewerIds: readonly string[];
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "rejected";
      reviewBundleFingerprint: string;
      promotionPlanFingerprint: string;
      progressRevision: number;
      verifiedReviewerCount: number;
      reviewerIds: readonly string[];
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason: "promotion-plan-blocked";
      planReason: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-input"
        | "invalid-plan"
        | "plan-content-mismatch"
        | "invalid-context"
        | "context-plan-mismatch"
        | "invalid-attestations"
        | "trust-verification-failed";
      trustReason?: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

type CanonicalContext = HoidEditorialBundleReviewContext;
type CanonicalAttestation = HoidEditorialBundleReviewAttestation;

function exactDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = allowedKeys,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))) return null;
    const output = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      output[key] = descriptor.value;
    }
    if (requiredKeys.some(key => !Object.prototype.hasOwnProperty.call(output, key))) return null;
    return output;
  } catch {
    return null;
  }
}

function denseValues(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length > maximum || Object.getPrototypeOf(value) !== Array.prototype) {
      return null;
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const output: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      output.push(descriptor.value);
    }
    return Object.freeze(output);
  } catch {
    return null;
  }
}

function canonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  try {
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
  } catch {
    return false;
  }
}

function canonicalContext(
  value: unknown,
  expectedPlan: HoidEditorialBundlePromotionPlan,
): CanonicalContext | null {
  const raw = exactDataRecord(value, CONTEXT_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    typeof raw.repositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(raw.repositoryFullName) ||
    typeof raw.pullRequestNumber !== "number" ||
    !Number.isSafeInteger(raw.pullRequestNumber) ||
    raw.pullRequestNumber < 1 ||
    typeof raw.baseRef !== "string" ||
    !REF_PATTERN.test(raw.baseRef) ||
    typeof raw.headRef !== "string" ||
    !REF_PATTERN.test(raw.headRef) ||
    raw.baseRef === raw.headRef ||
    typeof raw.baseSha !== "string" ||
    !COMMIT_PATTERN.test(raw.baseSha) ||
    typeof raw.headSha !== "string" ||
    !COMMIT_PATTERN.test(raw.headSha) ||
    raw.baseSha === raw.headSha ||
    typeof raw.promotionManifestPath !== "string" ||
    !PATH_PATTERN.test(raw.promotionManifestPath) ||
    raw.promotionPlanFingerprint !== expectedPlan.fingerprint ||
    raw.reviewBundleFingerprint !== expectedPlan.reviewBundleFingerprint
  ) return null;

  return Object.freeze({
    schemaVersion: 1,
    repositoryFullName: raw.repositoryFullName,
    pullRequestNumber: raw.pullRequestNumber,
    baseRef: raw.baseRef,
    baseSha: raw.baseSha,
    headRef: raw.headRef,
    headSha: raw.headSha,
    promotionManifestPath: raw.promotionManifestPath,
    promotionPlanFingerprint: expectedPlan.fingerprint,
    reviewBundleFingerprint: expectedPlan.reviewBundleFingerprint,
  });
}

function canonicalAttestations(
  value: unknown,
  expectedPlan: HoidEditorialBundlePromotionPlan,
): readonly CanonicalAttestation[] | null {
  const rawItems = denseValues(value, MAXIMUM_REVIEWERS);
  if (!rawItems || rawItems.length < MINIMUM_REVIEWERS) return null;

  const result: CanonicalAttestation[] = [];
  const reviewers = new Set<string>();
  const keyIds = new Set<string>();
  let previousReviewerId = "";

  for (const item of rawItems) {
    const raw = exactDataRecord(item, ATTESTATION_KEYS);
    if (
      !raw ||
      raw.schemaVersion !== 1 ||
      raw.reviewBundleFingerprint !== expectedPlan.reviewBundleFingerprint ||
      raw.promotionPlanFingerprint !== expectedPlan.fingerprint ||
      typeof raw.reviewerId !== "string" ||
      !ID_PATTERN.test(raw.reviewerId) ||
      (raw.decision !== "approve" && raw.decision !== "reject") ||
      !canonicalIsoTimestamp(raw.reviewedAt) ||
      typeof raw.keyId !== "string" ||
      !ID_PATTERN.test(raw.keyId) ||
      typeof raw.signatureHex !== "string" ||
      !SIGNATURE_PATTERN.test(raw.signatureHex) ||
      reviewers.has(raw.reviewerId) ||
      keyIds.has(raw.keyId) ||
      (previousReviewerId !== "" && raw.reviewerId <= previousReviewerId)
    ) return null;

    reviewers.add(raw.reviewerId);
    keyIds.add(raw.keyId);
    previousReviewerId = raw.reviewerId;
    result.push(Object.freeze({
      schemaVersion: 1,
      reviewBundleFingerprint: expectedPlan.reviewBundleFingerprint,
      promotionPlanFingerprint: expectedPlan.fingerprint,
      reviewerId: raw.reviewerId,
      decision: raw.decision,
      reviewedAt: raw.reviewedAt,
      keyId: raw.keyId,
      signatureHex: raw.signatureHex,
    }));
  }

  return Object.freeze(result);
}

type PlanValidation =
  | Readonly<{ status: "ready"; plan: HoidEditorialBundlePromotionPlan }>
  | Readonly<{ status: "blocked"; reason: string }>
  | Readonly<{ status: "invalid"; reason: "invalid-plan" | "plan-content-mismatch" }>;

function validatedPlan(
  planInput: unknown,
  reviewManifestInput: unknown,
  knowledgeManifestInput: unknown,
  sourceInput: unknown,
  receiptsInput: unknown,
  progressSnapshotInput: unknown,
): PlanValidation {
  const supplied = validateHoidEditorialBundlePromotionPlan(planInput);
  if (supplied.status !== "valid") return Object.freeze({ status: "invalid", reason: "invalid-plan" });

  const rebuilt = buildHoidEditorialBundlePromotionPlan(
    reviewManifestInput,
    knowledgeManifestInput,
    sourceInput,
    receiptsInput,
    progressSnapshotInput,
  );
  if (rebuilt.status === "blocked") {
    return Object.freeze({ status: "blocked", reason: rebuilt.reason });
  }
  if (rebuilt.status !== "ready-for-protected-review") {
    return Object.freeze({ status: "invalid", reason: "plan-content-mismatch" });
  }
  if (
    supplied.plan.fingerprint !== rebuilt.plan.fingerprint ||
    JSON.stringify(supplied.plan) !== JSON.stringify(rebuilt.plan)
  ) return Object.freeze({ status: "invalid", reason: "plan-content-mismatch" });

  return Object.freeze({ status: "ready", plan: rebuilt.plan });
}

function signingMessage(
  context: CanonicalContext,
  plan: HoidEditorialBundlePromotionPlan,
  reviewerId: string,
  decision: HoidEditorialBundleReviewDecision,
  reviewedAt: string,
  keyId: string,
): string {
  return JSON.stringify([
    "hoid-editorial-knowledge-bundle-review-ed25519-v1",
    context.repositoryFullName,
    context.pullRequestNumber,
    context.baseRef,
    context.baseSha,
    context.headRef,
    context.headSha,
    context.promotionManifestPath,
    plan.fingerprint,
    plan.reviewBundleFingerprint,
    plan.knowledgeBundleFingerprint,
    plan.receiptsFingerprint,
    plan.progressRevision,
    plan.progressFingerprint,
    reviewerId,
    decision,
    reviewedAt,
    keyId,
  ]);
}

/**
 * Build the exact domain-separated message an offline reviewer signs.
 *
 * The review manifest, knowledge manifest, complete receipt set and progress
 * snapshot are rebuilt into the supplied promotion plan before signing. The
 * message contains only plan fingerprints and review metadata, never draft
 * prose or source passages.
 */
export function buildHoidEditorialBundleReviewSigningMessage(
  planInput: unknown,
  reviewManifestInput: unknown,
  knowledgeManifestInput: unknown,
  sourceInput: unknown,
  receiptsInput: unknown,
  progressSnapshotInput: unknown,
  contextInput: unknown,
  reviewerIdInput: unknown,
  decisionInput: unknown,
  reviewedAtInput: unknown,
  keyIdInput: unknown,
): string | null {
  const planResult = validatedPlan(
    planInput,
    reviewManifestInput,
    knowledgeManifestInput,
    sourceInput,
    receiptsInput,
    progressSnapshotInput,
  );
  if (planResult.status !== "ready") return null;
  const context = canonicalContext(contextInput, planResult.plan);
  if (
    !context ||
    typeof reviewerIdInput !== "string" ||
    !ID_PATTERN.test(reviewerIdInput) ||
    (decisionInput !== "approve" && decisionInput !== "reject") ||
    !canonicalIsoTimestamp(reviewedAtInput) ||
    typeof keyIdInput !== "string" ||
    !ID_PATTERN.test(keyIdInput)
  ) return null;

  return signingMessage(
    context,
    planResult.plan,
    reviewerIdInput,
    decisionInput,
    reviewedAtInput,
    keyIdInput,
  );
}

/**
 * Validate a plan-bound reviewer context without exporting the raw progress
 * snapshot. The trusted host must still rebuild the plan against live progress.
 */
export function validateHoidEditorialBundleReviewContext(
  planInput: unknown,
  contextInput: unknown,
): HoidEditorialBundleReviewContext | null {
  const planResult = validateHoidEditorialBundlePromotionPlan(planInput);
  if (planResult.status !== "valid") return null;
  return canonicalContext(contextInput, planResult.plan);
}

/**
 * Build the exact offline reviewer message from a fingerprint-validated plan.
 * This avoids exporting a user's raw reading-progress ledger. It does not
 * prove that the plan is current; the trusted host rebuilds and rechecks it
 * against live progress before accepting the resulting attestation.
 */
export function buildHoidEditorialBundleReviewSigningMessageFromPlan(
  planInput: unknown,
  contextInput: unknown,
  reviewerIdInput: unknown,
  decisionInput: unknown,
  reviewedAtInput: unknown,
  keyIdInput: unknown,
): string | null {
  const planResult = validateHoidEditorialBundlePromotionPlan(planInput);
  if (planResult.status !== "valid") return null;
  const context = canonicalContext(contextInput, planResult.plan);
  if (
    !context ||
    typeof reviewerIdInput !== "string" ||
    !ID_PATTERN.test(reviewerIdInput) ||
    (decisionInput !== "approve" && decisionInput !== "reject") ||
    !canonicalIsoTimestamp(reviewedAtInput) ||
    typeof keyIdInput !== "string" ||
    !ID_PATTERN.test(keyIdInput)
  ) return null;

  return signingMessage(
    context,
    planResult.plan,
    reviewerIdInput,
    decisionInput,
    reviewedAtInput,
    keyIdInput,
  );
}

/**
 * Verify an independent whole-bundle editorial quorum after every individual
 * review packet has an approved receipt. Every signature binds the exact
 * review manifest, knowledge bundle, receipt set, progress snapshot and PR
 * head. This supplements (and does not replace) per-packet review receipts
 * and protected GitHub review.
 *
 * A verified quorum is still not a production promotion: this function never
 * writes the production editorial registry.
 */
export async function verifyHoidEditorialKnowledgeBundleReviewQuorum(
  input: unknown,
): Promise<HoidEditorialBundleReviewQuorumResult> {
  const raw = exactDataRecord(input, INPUT_KEYS);
  if (!raw) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-input",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const planResult = validatedPlan(
    raw.plan,
    raw.reviewManifest,
    raw.knowledgeManifest,
    raw.sourceInput,
    raw.receipts,
    raw.progressSnapshot,
  );
  if (planResult.status === "invalid") {
    return Object.freeze({
      status: "invalid",
      reason: planResult.reason,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  if (planResult.status === "blocked") {
    return Object.freeze({
      status: "blocked",
      reason: "promotion-plan-blocked",
      planReason: planResult.reason,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const plan = planResult.plan;
  const context = canonicalContext(raw.context, plan);
  if (!context) {
    const suppliedContext = exactDataRecord(raw.context, CONTEXT_KEYS);
    const reason = suppliedContext && (
      suppliedContext.promotionPlanFingerprint !== plan.fingerprint ||
      suppliedContext.reviewBundleFingerprint !== plan.reviewBundleFingerprint
    ) ? "context-plan-mismatch" : "invalid-context";
    return Object.freeze({
      status: "invalid",
      reason,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const attestations = canonicalAttestations(raw.attestations, plan);
  if (!attestations) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-attestations",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  if (
    typeof raw.now !== "string" ||
    !canonicalIsoTimestamp(raw.now) ||
    typeof raw.minimumRegistryRevision !== "number" ||
    !Number.isSafeInteger(raw.minimumRegistryRevision) ||
    raw.minimumRegistryRevision < 1
  ) {
    return Object.freeze({
      status: "invalid",
      reason: "invalid-input",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const requests: HoidReviewerBoundPayloadSignatureRequest[] = attestations.map(attestation => ({
    repositoryFullName: context.repositoryFullName,
    reviewerId: attestation.reviewerId,
    reviewedAt: attestation.reviewedAt,
    keyId: attestation.keyId,
    message: signingMessage(
      context,
      plan,
      attestation.reviewerId,
      attestation.decision,
      attestation.reviewedAt,
      attestation.keyId,
    ),
    signatureHex: attestation.signatureHex,
  }));

  const verification = await verifyHoidReviewerBoundPayloadSignatures(
    requests,
    raw.registry as HoidReviewerTrustRegistry,
    raw.rootKey as HoidReviewerTrustRootKey,
    raw.verifier as HoidEd25519VerificationPort,
    raw.now,
    raw.minimumRegistryRevision,
  );
  if (verification.status !== "verified") {
    return Object.freeze({
      status: "invalid",
      reason: "trust-verification-failed",
      trustReason: verification.reason,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const reviewerIds = Object.freeze(attestations.map(item => item.reviewerId));
  const common = {
    reviewBundleFingerprint: plan.reviewBundleFingerprint,
    promotionPlanFingerprint: plan.fingerprint,
    progressRevision: plan.progressRevision,
    verifiedReviewerCount: verification.verifiedCount,
    reviewerIds,
    promotionAllowed: false as const,
    productionWritePerformed: false as const,
  };

  return attestations.some(item => item.decision === "reject")
    ? Object.freeze({ status: "rejected", ...common })
    : Object.freeze({ status: "verified", ...common });
}
