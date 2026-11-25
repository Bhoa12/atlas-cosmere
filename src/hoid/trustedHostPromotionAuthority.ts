import type { HoidReviewerTrustRegistry } from "./editorialReviewSignatures";
import {
  verifyHoidEditorialKnowledgeBundleReviewQuorum,
  type HoidEditorialBundleReviewAttestation,
  type HoidEditorialBundleReviewQuorumResult,
} from "./editorialReviewBundleQuorum";
import {
  authorizeHoidSignedEditorialBundlePromotionWithRevisionStore,
  type HoidRevisionBoundSignedPromotionInput,
  type HoidRevisionBoundSignedPromotionResult,
} from "./trustRegistryRevisionStore";
import {
  loadHoidTrustedHostBootstrap,
  verifyHoidTrustedHostRevisionStore,
  type HoidTrustedHostBootstrapPort,
  type HoidTrustedHostBootstrapLoadResult,
  type HoidTrustedHostRevisionStoreCheck,
} from "./trustedHostBootstrap";

export type HoidTrustedHostPromotionInput = Omit<
  HoidRevisionBoundSignedPromotionInput,
  "trustRootKey" | "trustDomainId"
> & Readonly<{
  bootstrapPort: HoidTrustedHostBootstrapPort;
  expectedRepositoryFullName: string;
  bundleReviewAttestations: readonly HoidEditorialBundleReviewAttestation[];
}>;

type VerifiedBundleQuorum = Extract<HoidEditorialBundleReviewQuorumResult, { status: "verified" }>;
type BundleQuorumFailure =
  | Exclude<HoidEditorialBundleReviewQuorumResult, { status: "verified" }>
  | Readonly<{ status: "timeout" }>
  | Readonly<{ status: "unavailable" }>;

export type HoidTrustedHostPromotionResult =
  | Readonly<{
      status: "ready-for-maintainer-commit";
      authorization: Extract<HoidRevisionBoundSignedPromotionResult, { status: "ready-for-maintainer-commit" }>;
      bundleReviewQuorum: VerifiedBundleQuorum;
      bootstrapFingerprint: string;
      configuredMinimumRegistryRevision: number;
      persistedMinimumRegistryRevision: number;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason: "trusted-host-bootstrap-blocked";
      bootstrapFailure: Extract<HoidTrustedHostBootstrapLoadResult, { status: "blocked" }>;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason: "trusted-host-revision-store-blocked";
      storeFailure: Extract<HoidTrustedHostRevisionStoreCheck, { status: "blocked" }>;
      bootstrapFingerprint: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason: "bundle-review-quorum-blocked";
      quorumFailure: BundleQuorumFailure;
      bootstrapFingerprint: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason: "signed-editorial-promotion-blocked";
      promotion: Extract<HoidRevisionBoundSignedPromotionResult, { status: "blocked" }>;
      bundleReviewQuorum: VerifiedBundleQuorum;
      bootstrapFingerprint: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

const REQUEST_KEYS = Object.freeze([
  "schemaVersion",
  "repositoryFullName",
  "pullRequestNumber",
  "expectedBaseRef",
  "expectedBaseSha",
  "expectedHeadRef",
  "expectedHeadSha",
  "promotionManifestPath",
  "minimumApprovals",
  "requireCodeOwnerReview",
  "requireDismissStaleReviews",
  "requireEnforcedAdmins",
] as const);
const CONTEXT_KEYS = Object.freeze([
  "reviewManifest",
  "knowledgeManifest",
  "source",
  "receipts",
] as const);
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]{1,240}$/u;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,126}$/u;
const QUORUM_TIMEOUT_MS = 15_000;

function ownDataValue(value: unknown, key: string): unknown {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor &&
      Object.prototype.hasOwnProperty.call(descriptor, "value") &&
      descriptor.enumerable === true
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

function ownDataString(value: unknown, key: string): string | null {
  const field = ownDataValue(value, key);
  return typeof field === "string" ? field : null;
}

function ownDataNumber(value: unknown, key: string): number | null {
  const field = ownDataValue(value, key);
  return typeof field === "number" && Number.isSafeInteger(field) ? field : null;
}

function ownDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== allowedKeys.length ||
      keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))
    ) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of allowedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function ownRepository(value: unknown): string | null {
  const repository = ownDataString(value, "repositoryFullName");
  return repository && REPOSITORY_PATTERN.test(repository) ? repository : null;
}

function buildBundleQuorumInput(
  input: HoidTrustedHostPromotionInput,
  rootKey: unknown,
  minimumRegistryRevision: number,
): Readonly<{
  value: unknown;
  planFingerprint: string;
  reviewBundleFingerprint: string;
  progressRevision: number;
}> | null {
  const plan = ownDataValue(input, "plan");
  const planFingerprint = ownDataString(plan, "fingerprint");
  const reviewBundleFingerprint = ownDataString(plan, "reviewBundleFingerprint");
  const progressRevision = ownDataNumber(plan, "progressRevision");
  if (
    !planFingerprint || !SHA_PATTERN.test(planFingerprint) ||
    !reviewBundleFingerprint || !SHA_PATTERN.test(reviewBundleFingerprint) ||
    progressRevision === null || progressRevision < 0
  ) return null;

  const request = ownDataRecord(ownDataValue(input, "request"), REQUEST_KEYS);
  const context = ownDataRecord(ownDataValue(input, "context"), CONTEXT_KEYS);
  const attestations = ownDataValue(input, "bundleReviewAttestations");
  if (!request || !context || !Array.isArray(attestations)) return null;

  if (
    request.schemaVersion !== 2 ||
    typeof request.repositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(request.repositoryFullName) ||
    request.repositoryFullName !== input.expectedRepositoryFullName ||
    typeof request.pullRequestNumber !== "number" ||
    !Number.isSafeInteger(request.pullRequestNumber) ||
    request.pullRequestNumber < 1 ||
    typeof request.expectedBaseRef !== "string" ||
    !REF_PATTERN.test(request.expectedBaseRef) ||
    typeof request.expectedBaseSha !== "string" ||
    !COMMIT_PATTERN.test(request.expectedBaseSha) ||
    typeof request.expectedHeadRef !== "string" ||
    !REF_PATTERN.test(request.expectedHeadRef) ||
    request.expectedBaseRef === request.expectedHeadRef ||
    typeof request.expectedHeadSha !== "string" ||
    !COMMIT_PATTERN.test(request.expectedHeadSha) ||
    request.expectedBaseSha === request.expectedHeadSha ||
    typeof request.promotionManifestPath !== "string" ||
    !PATH_PATTERN.test(request.promotionManifestPath) ||
    typeof request.minimumApprovals !== "number" ||
    !Number.isSafeInteger(request.minimumApprovals) ||
    request.minimumApprovals < 1 ||
    request.minimumApprovals > 5 ||
    typeof request.requireCodeOwnerReview !== "boolean" ||
    typeof request.requireDismissStaleReviews !== "boolean" ||
    typeof request.requireEnforcedAdmins !== "boolean"
  ) return null;

  const progressSnapshot = ownDataValue(input, "progressSnapshot");
  const registry = ownDataValue(input, "trustRegistry");
  const verifier = ownDataValue(input, "verifier");
  const now = ownDataValue(input, "now");
  if (typeof now !== "string" || registry === undefined || verifier === undefined) return null;

  const quorumContext = Object.freeze({
    schemaVersion: 1 as const,
    repositoryFullName: request.repositoryFullName,
    pullRequestNumber: request.pullRequestNumber,
    baseRef: request.expectedBaseRef,
    baseSha: request.expectedBaseSha,
    headRef: request.expectedHeadRef,
    headSha: request.expectedHeadSha,
    promotionManifestPath: request.promotionManifestPath,
    promotionPlanFingerprint: planFingerprint,
    reviewBundleFingerprint,
  });

  return Object.freeze({
    planFingerprint,
    reviewBundleFingerprint,
    progressRevision,
    value: Object.freeze({
      plan,
      reviewManifest: context.reviewManifest,
      knowledgeManifest: context.knowledgeManifest,
      sourceInput: context.source,
      receipts: context.receipts,
      progressSnapshot,
      context: quorumContext,
      attestations,
      registry,
      rootKey,
      verifier,
      now,
      minimumRegistryRevision,
    }),
  });
}

type QuorumOutcome =
  | Readonly<{ status: "value"; value: HoidEditorialBundleReviewQuorumResult }>
  | Readonly<{ status: "timeout" }>
  | Readonly<{ status: "unavailable" }>;

async function verifyBundleQuorumWithTimeout(input: unknown): Promise<QuorumOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = Promise.resolve()
    .then(() => verifyHoidEditorialKnowledgeBundleReviewQuorum(input))
    .then<QuorumOutcome, QuorumOutcome>(
      value => Object.freeze({ status: "value", value }),
      () => Object.freeze({ status: "unavailable" }),
    );
  const timeout = new Promise<QuorumOutcome>(resolve => {
    timer = setTimeout(() => resolve(Object.freeze({ status: "timeout" })), QUORUM_TIMEOUT_MS);
  });
  const outcome = await Promise.race([work, timeout]);
  if (timer !== undefined) clearTimeout(timer);
  return outcome;
}

function verifiedQuorumMatches(
  value: HoidEditorialBundleReviewQuorumResult,
  expected: Readonly<{
    planFingerprint: string;
    reviewBundleFingerprint: string;
    progressRevision: number;
  }>,
): value is VerifiedBundleQuorum {
  if (value.status !== "verified") return false;
  const reviewerIds = value.reviewerIds;
  return value.promotionAllowed === false &&
    value.productionWritePerformed === false &&
    value.promotionPlanFingerprint === expected.planFingerprint &&
    value.reviewBundleFingerprint === expected.reviewBundleFingerprint &&
    value.progressRevision === expected.progressRevision &&
    Number.isSafeInteger(value.verifiedReviewerCount) &&
    value.verifiedReviewerCount >= 2 &&
    value.verifiedReviewerCount <= 8 &&
    Array.isArray(reviewerIds) &&
    reviewerIds.length === value.verifiedReviewerCount &&
    new Set(reviewerIds).size === reviewerIds.length &&
    reviewerIds.every((id, index) =>
      typeof id === "string" &&
      ID_PATTERN.test(id) &&
      (index === 0 || reviewerIds[index - 1] < id)
    );
}

function invalidQuorumFailure(): BundleQuorumFailure {
  return Object.freeze({
    status: "invalid",
    reason: "invalid-input",
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

/**
 * Trusted-host composition boundary. Root key and trust domain come only from
 * the host-pinned bootstrap. Before packet signatures, GitHub review or live
 * progress are consulted, the exact bundle must pass the independent
 * whole-bundle reviewer quorum. The function never writes editorial
 * production or merges a pull request.
 */
export async function authorizeHoidTrustedHostSignedEditorialBundlePromotion(
  input: HoidTrustedHostPromotionInput,
): Promise<HoidTrustedHostPromotionResult> {
  const repositoryFullName = ownRepository(ownDataValue(input, "request"));
  const expectedRepository = ownDataValue(input, "expectedRepositoryFullName");
  if (
    typeof expectedRepository !== "string" ||
    repositoryFullName !== expectedRepository
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "trusted-host-bootstrap-blocked",
      bootstrapFailure: Object.freeze({
        status: "blocked",
        reason: "bootstrap-invalid",
        validationReason: "repository-not-authorized",
        promotionAllowed: false,
        productionWritePerformed: false,
      }),
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const bootstrap = await loadHoidTrustedHostBootstrap(
    input.bootstrapPort,
    expectedRepository,
    input.now,
  );
  if (bootstrap.status !== "ready") {
    return Object.freeze({
      status: "blocked",
      reason: "trusted-host-bootstrap-blocked",
      bootstrapFailure: bootstrap,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const storeCheck = await verifyHoidTrustedHostRevisionStore(
    bootstrap.configuration,
    input.revisionStore,
    expectedRepository,
    input.now,
  );
  if (storeCheck.status !== "ready") {
    return Object.freeze({
      status: "blocked",
      reason: "trusted-host-revision-store-blocked",
      storeFailure: storeCheck,
      bootstrapFingerprint: bootstrap.configurationFingerprint,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const quorumInput = buildBundleQuorumInput(
    input,
    bootstrap.configuration.rootKey,
    storeCheck.persistedMinimumRevision,
  );
  if (!quorumInput) {
    return Object.freeze({
      status: "blocked",
      reason: "bundle-review-quorum-blocked",
      quorumFailure: invalidQuorumFailure(),
      bootstrapFingerprint: bootstrap.configurationFingerprint,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const quorumOutcome = await verifyBundleQuorumWithTimeout(quorumInput.value);
  if (quorumOutcome.status !== "value") {
    return Object.freeze({
      status: "blocked",
      reason: "bundle-review-quorum-blocked",
      quorumFailure: quorumOutcome,
      bootstrapFingerprint: bootstrap.configurationFingerprint,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  if (quorumOutcome.value.status !== "verified") {
    return Object.freeze({
      status: "blocked",
      reason: "bundle-review-quorum-blocked",
      quorumFailure: quorumOutcome.value,
      bootstrapFingerprint: bootstrap.configurationFingerprint,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  if (!verifiedQuorumMatches(quorumOutcome.value, quorumInput)) {
    return Object.freeze({
      status: "blocked",
      reason: "bundle-review-quorum-blocked",
      quorumFailure: invalidQuorumFailure(),
      bootstrapFingerprint: bootstrap.configurationFingerprint,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const bundleReviewQuorum = quorumOutcome.value;
  const promotion = await authorizeHoidSignedEditorialBundlePromotionWithRevisionStore({
    plan: input.plan,
    context: input.context,
    request: input.request,
    signatureBatch: input.signatureBatch,
    trustRegistry: input.trustRegistry as HoidReviewerTrustRegistry,
    trustRootKey: bootstrap.configuration.rootKey,
    verifier: input.verifier,
    now: input.now,
    trustDomainId: bootstrap.configuration.trustDomainId,
    revisionStore: input.revisionStore,
    progressSnapshot: input.progressSnapshot,
    sourceControlPort: input.sourceControlPort,
    progressPort: input.progressPort,
  });
  if (promotion.status !== "ready-for-maintainer-commit") {
    return Object.freeze({
      status: "blocked",
      reason: "signed-editorial-promotion-blocked",
      promotion,
      bundleReviewQuorum,
      bootstrapFingerprint: bootstrap.configurationFingerprint,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  return Object.freeze({
    status: "ready-for-maintainer-commit",
    authorization: promotion,
    bundleReviewQuorum,
    bootstrapFingerprint: bootstrap.configurationFingerprint,
    configuredMinimumRegistryRevision: bootstrap.configuration.minimumRegistryRevision,
    persistedMinimumRegistryRevision: promotion.minimumRegistryRevision,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}
