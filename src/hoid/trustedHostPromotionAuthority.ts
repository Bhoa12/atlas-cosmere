import type { HoidReviewerTrustRegistry } from "./editorialReviewSignatures";
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
}>;

export type HoidTrustedHostPromotionResult =
  | Readonly<{
      status: "ready-for-maintainer-commit";
      authorization: Extract<HoidRevisionBoundSignedPromotionResult, { status: "ready-for-maintainer-commit" }>;
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
      reason: "signed-editorial-promotion-blocked";
      promotion: Extract<HoidRevisionBoundSignedPromotionResult, { status: "blocked" }>;
      bootstrapFingerprint: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

function ownRepository(value: unknown): string | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, "repositoryFullName");
    return descriptor &&
      Object.prototype.hasOwnProperty.call(descriptor, "value") &&
      descriptor.enumerable === true &&
      typeof descriptor.value === "string"
      ? descriptor.value
      : null;
  } catch {
    return null;
  }
}

/**
 * Host composition boundary. Root key and trust domain come only from the
 * host-pinned bootstrap port; user/provider input cannot override them.
 * The function never writes editorial production or merges a pull request.
 */
export async function authorizeHoidTrustedHostSignedEditorialBundlePromotion(
  input: HoidTrustedHostPromotionInput,
): Promise<HoidTrustedHostPromotionResult> {
  const repositoryFullName = ownRepository(input.request);
  if (
    typeof input.expectedRepositoryFullName !== "string" ||
    repositoryFullName !== input.expectedRepositoryFullName
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
    input.expectedRepositoryFullName,
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
    input.expectedRepositoryFullName,
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
      bootstrapFingerprint: bootstrap.configurationFingerprint,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  return Object.freeze({
    status: "ready-for-maintainer-commit",
    authorization: promotion,
    bootstrapFingerprint: bootstrap.configurationFingerprint,
    configuredMinimumRegistryRevision: bootstrap.configuration.minimumRegistryRevision,
    persistedMinimumRegistryRevision: promotion.minimumRegistryRevision,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}
