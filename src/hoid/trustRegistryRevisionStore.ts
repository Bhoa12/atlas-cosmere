import {
  verifyHoidReviewerTrustRegistry,
  type HoidEd25519VerificationPort,
  type HoidReviewerTrustRegistry,
  type HoidReviewerTrustRootKey,
} from "./editorialReviewSignatures";
import {
  authorizeHoidSignedEditorialBundlePromotion,
  type HoidSignedEditorialBundlePromotionAuthorization,
} from "./signedEditorialBundlePromotionAuthority";
import type {
  HoidPromotionProgressPort,
  HoidSourceControlReviewPort,
} from "./promotionReviewAuthority";

/**
 * The host must back this port with durable, rollback-resistant storage.
 * compareAndSetMinimumRevision must be linearizable and atomic for one
 * trustDomainId; a successful true result means the new value is durable.
 */
export type HoidTrustRegistryRevisionStorePort = Readonly<{
  readMinimumRevision(input: Readonly<{ trustDomainId: string }>): Promise<unknown>;
  compareAndSetMinimumRevision(input: Readonly<{
    trustDomainId: string;
    expectedRevision: number;
    nextRevision: number;
  }>): Promise<unknown>;
}>;

export type HoidTrustRegistryRevisionPersistence =
  | Readonly<{
      status: "persisted";
      trustDomainId: string;
      registryRevision: number;
      minimumRevision: number;
      advanced: boolean;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "invalid-trust-domain"
        | "invalid-revision-store"
        | "revision-store-unavailable"
        | "revision-store-uninitialized"
        | "revision-store-invalid"
        | "revision-store-not-durable"
        | "revision-store-conflict"
        | "trust-registry-invalid";
      verificationReason?: string;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

export type HoidRevisionBoundSignedPromotionResult =
  | Readonly<{
      status: "ready-for-maintainer-commit";
      authorization: Extract<HoidSignedEditorialBundlePromotionAuthorization, { status: "ready-for-maintainer-commit" }>;
      trustDomainId: string;
      trustRegistryRevision: number;
      minimumRegistryRevision: number;
      minimumRevisionPersisted: true;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "blocked";
      reason: "trust-registry-revision-blocked" | "editorial-promotion-blocked";
      trustFailure?: Extract<HoidTrustRegistryRevisionPersistence, { status: "blocked" }>;
      authorization?: Extract<HoidSignedEditorialBundlePromotionAuthorization, { status: "blocked" }>;
      trustDomainId?: string;
      trustRegistryRevision?: number;
      minimumRegistryRevision?: number;
      minimumRevisionPersisted: false;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

export type HoidRevisionBoundSignedPromotionInput = Readonly<{
  plan: unknown;
  context: unknown;
  request: unknown;
  signatureBatch: unknown;
  trustRegistry: HoidReviewerTrustRegistry;
  trustRootKey: HoidReviewerTrustRootKey;
  verifier: HoidEd25519VerificationPort;
  now: unknown;
  trustDomainId: string;
  revisionStore: HoidTrustRegistryRevisionStorePort;
  progressSnapshot: unknown;
  sourceControlPort: HoidSourceControlReviewPort;
  progressPort: HoidPromotionProgressPort;
}>;

const TRUST_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const MAX_CAS_ATTEMPTS = 4;
const STORE_TIMEOUT_MS = 8_000;

type StoreMethod<T> = (input: T) => Promise<unknown>;

function resolveStoreMethod<T>(value: unknown, name: string): StoreMethod<T> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 4; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as StoreMethod<T>).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

async function withStoreTimeout<T>(operation: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = Promise.resolve().then(operation);
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Trust revision store timeout")), STORE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function blocked(
  reason: Extract<HoidTrustRegistryRevisionPersistence, { status: "blocked" }>["reason"],
  verificationReason?: string,
): HoidTrustRegistryRevisionPersistence {
  return Object.freeze({
    status: "blocked",
    reason,
    ...(verificationReason === undefined ? {} : { verificationReason }),
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

/**
 * Verifies a root-signed registry and monotonically persists its revision.
 * Missing state is never bootstrapped from the supplied registry: the host
 * must initialize the trust domain out-of-band before this operation.
 */
export async function persistHoidTrustRegistryMinimumRevision(
  registryInput: HoidReviewerTrustRegistry,
  rootKeyInput: HoidReviewerTrustRootKey,
  verifierInput: HoidEd25519VerificationPort,
  nowInput: unknown,
  trustDomainIdInput: unknown,
  storeInput: unknown,
): Promise<HoidTrustRegistryRevisionPersistence> {
  if (typeof trustDomainIdInput !== "string" || !TRUST_DOMAIN_PATTERN.test(trustDomainIdInput)) {
    return blocked("invalid-trust-domain");
  }
  const trustDomainId = trustDomainIdInput;
  const readMinimumRevision = resolveStoreMethod<{ trustDomainId: string }>(
    storeInput,
    "readMinimumRevision",
  );
  const compareAndSetMinimumRevision = resolveStoreMethod<{
    trustDomainId: string;
    expectedRevision: number;
    nextRevision: number;
  }>(storeInput, "compareAndSetMinimumRevision");
  if (!readMinimumRevision || !compareAndSetMinimumRevision) {
    return blocked("invalid-revision-store");
  }

  let writeAttempted = false;
  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
    let currentValue: unknown;
    try {
      currentValue = await withStoreTimeout(() => readMinimumRevision(Object.freeze({ trustDomainId })));
    } catch {
      return blocked("revision-store-unavailable");
    }
    if (currentValue === null || currentValue === undefined) {
      return blocked("revision-store-uninitialized");
    }
    if (!Number.isSafeInteger(currentValue) || (currentValue as number) < 1) {
      return blocked("revision-store-invalid");
    }
    const currentRevision = currentValue as number;

    const verification = await verifyHoidReviewerTrustRegistry(
      registryInput,
      rootKeyInput,
      verifierInput,
      nowInput,
      currentRevision,
    );
    if (verification.status !== "verified") {
      return blocked("trust-registry-invalid", verification.reason);
    }

    if (verification.revision === currentRevision) {
      return Object.freeze({
        status: "persisted",
        trustDomainId,
        registryRevision: verification.revision,
        minimumRevision: currentRevision,
        advanced: false,
      });
    }

    if (writeAttempted && currentRevision < verification.revision) {
      return blocked("revision-store-not-durable");
    }

    let compareResult: unknown;
    try {
      compareResult = await withStoreTimeout(() => compareAndSetMinimumRevision(Object.freeze({
        trustDomainId,
        expectedRevision: currentRevision,
        nextRevision: verification.revision,
      })));
    } catch {
      return blocked("revision-store-unavailable");
    }
    if (typeof compareResult !== "boolean") return blocked("revision-store-invalid");
    if (compareResult) {
      writeAttempted = true;
      continue;
    }
  }

  return blocked("revision-store-conflict");
}

/**
 * Production-facing composition wrapper. It persists the authenticated
 * registry revision before delegating to the signed bundle gate. The delegate
 * verifies all packet signatures again using the persisted minimum revision.
 */
export async function authorizeHoidSignedEditorialBundlePromotionWithRevisionStore(
  input: HoidRevisionBoundSignedPromotionInput,
): Promise<HoidRevisionBoundSignedPromotionResult> {
  const persistence = await persistHoidTrustRegistryMinimumRevision(
    input.trustRegistry,
    input.trustRootKey,
    input.verifier,
    input.now,
    input.trustDomainId,
    input.revisionStore,
  );
  if (persistence.status !== "persisted") {
    return Object.freeze({
      status: "blocked",
      reason: "trust-registry-revision-blocked",
      trustFailure: persistence,
      minimumRevisionPersisted: false,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const authorization = await authorizeHoidSignedEditorialBundlePromotion(
    input.plan,
    input.context,
    input.request,
    input.signatureBatch,
    input.trustRegistry,
    input.trustRootKey,
    input.verifier,
    input.now,
    persistence.minimumRevision,
    input.progressSnapshot,
    input.sourceControlPort,
    input.progressPort,
  );
  if (authorization.status !== "ready-for-maintainer-commit") {
    return Object.freeze({
      status: "blocked",
      reason: "editorial-promotion-blocked",
      authorization,
      trustDomainId: persistence.trustDomainId,
      trustRegistryRevision: persistence.registryRevision,
      minimumRegistryRevision: persistence.minimumRevision,
      minimumRevisionPersisted: true,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  return Object.freeze({
    status: "ready-for-maintainer-commit",
    authorization,
    trustDomainId: persistence.trustDomainId,
    trustRegistryRevision: persistence.registryRevision,
    minimumRegistryRevision: persistence.minimumRevision,
    minimumRevisionPersisted: true,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}
