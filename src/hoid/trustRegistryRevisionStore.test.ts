import { describe, expect, it, vi } from "vitest";
import {
  authorizeHoidSignedEditorialBundlePromotionWithRevisionStore,
  persistHoidTrustRegistryMinimumRevision,
  type HoidTrustRegistryRevisionStorePort,
} from "./trustRegistryRevisionStore";
import type {
  HoidReviewerTrustRegistry,
  HoidReviewerTrustRootKey,
} from "./editorialReviewSignatures";

const NOW = "2026-11-19T10:00:00.000Z";
const DOMAIN = "atlas-cosmere-production";
const REPOSITORY = "Bhoa12/atlas-cosmere";
const rootKey: HoidReviewerTrustRootKey = Object.freeze({
  keyId: "root-2026",
  publicKeyHex: "11".repeat(32),
});
const verifier = Object.freeze({ verify: async () => true });

function registry(revision = 2): HoidReviewerTrustRegistry {
  return Object.freeze({
    schemaVersion: 1,
    revision,
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
      keyId: rootKey.keyId,
      signatureHex: "33".repeat(64),
    }),
  });
}

function memoryStore(initial: number | null): HoidTrustRegistryRevisionStorePort & {
  value: number | null;
  readMinimumRevision: ReturnType<typeof vi.fn>;
  compareAndSetMinimumRevision: ReturnType<typeof vi.fn>;
} {
  const state = { value: initial };
  return {
    get value() { return state.value; },
    readMinimumRevision: vi.fn(async () => state.value),
    compareAndSetMinimumRevision: vi.fn(async (input: {
      trustDomainId: string;
      expectedRevision: number;
      nextRevision: number;
    }) => {
      if (
        input.trustDomainId !== DOMAIN ||
        state.value !== input.expectedRevision ||
        input.nextRevision <= input.expectedRevision
      ) return false;
      state.value = input.nextRevision;
      return true;
    }),
  };
}

describe("Hoid rollback-resistant trust registry revision store", () => {
  it("advances a pre-initialized minimum only after authenticating the newer registry", async () => {
    const store = memoryStore(1);
    const result = await persistHoidTrustRegistryMinimumRevision(
      registry(2), rootKey, verifier, NOW, DOMAIN, store,
    );
    expect(result).toEqual({
      status: "persisted",
      trustDomainId: DOMAIN,
      registryRevision: 2,
      minimumRevision: 2,
      advanced: true,
    });
    expect(store.value).toBe(2);
    expect(store.compareAndSetMinimumRevision).toHaveBeenCalledWith({
      trustDomainId: DOMAIN,
      expectedRevision: 1,
      nextRevision: 2,
    });
  });

  it("never bootstraps an uninitialized store from an untrusted registry", async () => {
    const store = memoryStore(null);
    const result = await persistHoidTrustRegistryMinimumRevision(
      registry(2), rootKey, verifier, NOW, DOMAIN, store,
    );
    expect(result).toMatchObject({
      status: "blocked",
      reason: "revision-store-uninitialized",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(store.compareAndSetMinimumRevision).not.toHaveBeenCalled();
  });

  it("rejects a root-signed registry older than the persisted minimum", async () => {
    const store = memoryStore(3);
    const result = await persistHoidTrustRegistryMinimumRevision(
      registry(2), rootKey, verifier, NOW, DOMAIN, store,
    );
    expect(result).toMatchObject({
      status: "blocked",
      reason: "trust-registry-invalid",
      verificationReason: "registry-rollback",
    });
    expect(store.compareAndSetMinimumRevision).not.toHaveBeenCalled();
  });

  it("converges when another verifier atomically advances the same revision first", async () => {
    const store = memoryStore(1);
    store.compareAndSetMinimumRevision.mockImplementationOnce(async () => {
      store.value = 2;
      return false;
    });
    const result = await persistHoidTrustRegistryMinimumRevision(
      registry(2), rootKey, verifier, NOW, DOMAIN, store,
    );
    expect(result).toMatchObject({
      status: "persisted",
      registryRevision: 2,
      minimumRevision: 2,
    });
    expect(store.readMinimumRevision).toHaveBeenCalledTimes(2);
  });

  it("rejects a concurrent higher revision rather than accepting an older registry", async () => {
    const store = memoryStore(1);
    store.compareAndSetMinimumRevision.mockImplementationOnce(async () => {
      store.value = 3;
      return false;
    });
    const result = await persistHoidTrustRegistryMinimumRevision(
      registry(2), rootKey, verifier, NOW, DOMAIN, store,
    );
    expect(result).toMatchObject({
      status: "blocked",
      reason: "trust-registry-invalid",
      verificationReason: "registry-rollback",
    });
  });

  it("fails closed when compare-and-set does not converge", async () => {
    const store = memoryStore(1);
    store.compareAndSetMinimumRevision.mockResolvedValue(false);
    const result = await persistHoidTrustRegistryMinimumRevision(
      registry(2), rootKey, verifier, NOW, DOMAIN, store,
    );
    expect(result).toMatchObject({
      status: "blocked",
      reason: "revision-store-conflict",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("rejects invalid trust-domain identifiers and accessor-based store methods", async () => {
    const store = memoryStore(1);
    expect(await persistHoidTrustRegistryMinimumRevision(
      registry(2), rootKey, verifier, NOW, "../production", store,
    )).toMatchObject({ status: "blocked", reason: "invalid-trust-domain" });

    let invoked = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "readMinimumRevision", {
      enumerable: true,
      get() { invoked = true; return async () => 1; },
    });
    Object.defineProperty(hostile, "compareAndSetMinimumRevision", {
      enumerable: true,
      value: async () => true,
    });
    expect(await persistHoidTrustRegistryMinimumRevision(
      registry(2), rootKey, verifier, NOW, DOMAIN, hostile,
    )).toMatchObject({ status: "blocked", reason: "invalid-revision-store" });
    expect(invoked).toBe(false);
  });

  it("persists trust before delegating and still leaves invalid editorial plans blocked", async () => {
    const store = memoryStore(1);
    const sourceControlPort = {
      fetchProtectedReviewSnapshot: vi.fn(async () => null),
    };
    const result = await authorizeHoidSignedEditorialBundlePromotionWithRevisionStore({
      plan: null,
      context: null,
      request: null,
      signatureBatch: null,
      trustRegistry: registry(2),
      trustRootKey: rootKey,
      verifier,
      now: NOW,
      trustDomainId: DOMAIN,
      revisionStore: store,
      progressSnapshot: null,
      sourceControlPort,
      progressPort: { readAuthoritativeProgressSnapshot: vi.fn(async () => null) },
    });
    expect(result).toMatchObject({
      status: "blocked",
      reason: "editorial-promotion-blocked",
      minimumRevisionPersisted: true,
      promotionAllowed: false,
      productionWritePerformed: false,
      authorization: { status: "blocked", reason: "invalid-plan" },
    });
    expect(store.value).toBe(2);
    expect(sourceControlPort.fetchProtectedReviewSnapshot).not.toHaveBeenCalled();
  });
});
