import { describe, expect, it, vi } from "vitest";
import {
  authorizeHoidTrustedHostSignedEditorialBundlePromotion,
  type HoidTrustedHostPromotionInput,
} from "./trustedHostPromotionAuthority";
import type { HoidReviewerTrustRegistry } from "./editorialReviewSignatures";
import type { HoidTrustRegistryRevisionStorePort } from "./trustRegistryRevisionStore";

const NOW = "2026-11-19T12:00:00.000Z";
const REPOSITORY = "Bhoa12/atlas-cosmere";
const DOMAIN = "atlas-cosmere-production";

function bootstrap() {
  return Object.freeze({
    schemaVersion: 1 as const,
    configurationId: "atlas-production-root-2026",
    trustDomainId: DOMAIN,
    rootKey: Object.freeze({ keyId: "root-2026", publicKeyHex: "11".repeat(32) }),
    minimumRegistryRevision: 1,
    allowedRepositoryFullNames: Object.freeze([REPOSITORY]),
    provisionedAt: "2026-11-19T10:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z",
  });
}

function registry(): HoidReviewerTrustRegistry {
  return Object.freeze({
    schemaVersion: 1,
    revision: 2,
    issuedAt: "2026-11-19T09:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z",
    keys: Object.freeze([Object.freeze({
      keyId: "reviewer-one-key",
      reviewerId: "reviewer-one",
      algorithm: "Ed25519" as const,
      publicKeyHex: "22".repeat(32),
      status: "active" as const,
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2027-01-01T00:00:00.000Z",
      revokedAt: null,
      allowedRepositoryFullNames: Object.freeze([REPOSITORY]),
    })]),
    rootSignature: Object.freeze({
      algorithm: "Ed25519" as const,
      keyId: "root-2026",
      signatureHex: "33".repeat(64),
    }),
  });
}

function memoryStore(initial: number | null): HoidTrustRegistryRevisionStorePort & { value: number | null } {
  const state = { value: initial };
  return {
    get value() { return state.value; },
    readMinimumRevision: async input => input.trustDomainId === DOMAIN ? state.value : null,
    compareAndSetMinimumRevision: async input => {
      if (
        input.trustDomainId !== DOMAIN ||
        state.value !== input.expectedRevision ||
        input.nextRevision <= input.expectedRevision
      ) return false;
      state.value = input.nextRevision;
      return true;
    },
  };
}

function input(overrides: Partial<HoidTrustedHostPromotionInput> = {}): HoidTrustedHostPromotionInput {
  return {
    bootstrapPort: { readPinnedConfiguration: async () => bootstrap() },
    expectedRepositoryFullName: REPOSITORY,
    bundleReviewAttestations: Object.freeze([]),
    plan: null,
    context: null,
    request: { repositoryFullName: REPOSITORY },
    signatureBatch: null,
    trustRegistry: registry(),
    verifier: { verify: async () => true },
    now: NOW,
    revisionStore: memoryStore(1),
    progressSnapshot: null,
    sourceControlPort: { fetchProtectedReviewSnapshot: vi.fn(async () => null) },
    progressPort: { readAuthoritativeProgressSnapshot: vi.fn(async () => null) },
    ...overrides,
  };
}

describe("Hoid trusted host promotion composition", () => {
  it("blocks when no out-of-band bootstrap configuration is provisioned", async () => {
    const store = memoryStore(1);
    const result = await authorizeHoidTrustedHostSignedEditorialBundlePromotion(input({
      bootstrapPort: { readPinnedConfiguration: async () => null },
      revisionStore: store,
    }));
    expect(result).toMatchObject({
      status: "blocked",
      reason: "trusted-host-bootstrap-blocked",
      bootstrapFailure: { reason: "bootstrap-not-provisioned" },
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(store.value).toBe(1);
  });

  it("rejects a request whose repository differs from the host-pinned repository", async () => {
    const result = await authorizeHoidTrustedHostSignedEditorialBundlePromotion(input({
      request: { repositoryFullName: "another/repository" },
    }));
    expect(result).toMatchObject({
      status: "blocked",
      reason: "trusted-host-bootstrap-blocked",
      bootstrapFailure: { validationReason: "repository-not-authorized" },
    });
  });

  it("fails closed when the monotonic revision floor has not been provisioned", async () => {
    const store = memoryStore(null);
    const result = await authorizeHoidTrustedHostSignedEditorialBundlePromotion(input({
      revisionStore: store,
    }));
    expect(result).toMatchObject({
      status: "blocked",
      reason: "trusted-host-revision-store-blocked",
      storeFailure: { reason: "revision-store-uninitialized" },
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(store.value).toBe(null);
  });

  it("loads the pinned root, advances the initialized trust floor, then leaves invalid editorial input blocked", async () => {
    const store = memoryStore(1);
    const sourceControlPort = { fetchProtectedReviewSnapshot: vi.fn(async () => null) };
    const progressPort = { readAuthoritativeProgressSnapshot: vi.fn(async () => null) };
    const result = await authorizeHoidTrustedHostSignedEditorialBundlePromotion(input({
      revisionStore: store,
      sourceControlPort,
      progressPort,
    }));
    expect(result).toMatchObject({
      status: "blocked",
      reason: "bundle-review-quorum-blocked",
      quorumFailure: { status: "invalid", promotionAllowed: false, productionWritePerformed: false },
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(store.value).toBe(1);
    expect(sourceControlPort.fetchProtectedReviewSnapshot).not.toHaveBeenCalled();
    expect(progressPort.readAuthoritativeProgressSnapshot).not.toHaveBeenCalled();
  });
});
