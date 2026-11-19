import { describe, expect, it, vi } from "vitest";
import {
  loadHoidTrustedHostBootstrap,
  validateHoidTrustedHostBootstrapConfiguration,
  verifyHoidTrustedHostRevisionStore,
  type HoidTrustedHostBootstrapConfiguration,
} from "./trustedHostBootstrap";

const NOW = "2026-11-19T12:00:00.000Z";
const REPOSITORY = "Bhoa12/atlas-cosmere";

function configuration(overrides: Partial<HoidTrustedHostBootstrapConfiguration> = {}) {
  return Object.freeze({
    schemaVersion: 1 as const,
    configurationId: "atlas-production-root-2026",
    trustDomainId: "atlas-cosmere-production",
    rootKey: Object.freeze({
      keyId: "root-2026",
      publicKeyHex: "11".repeat(32),
    }),
    minimumRegistryRevision: 3,
    allowedRepositoryFullNames: Object.freeze([REPOSITORY]),
    provisionedAt: "2026-11-19T10:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("Hoid trusted host bootstrap", () => {
  it("loads an explicitly pinned, repository-scoped bootstrap configuration", async () => {
    const result = await loadHoidTrustedHostBootstrap(
      { readPinnedConfiguration: vi.fn(async () => configuration()) },
      REPOSITORY,
      NOW,
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.configuration.minimumRegistryRevision).toBe(3);
    expect(result.configuration.trustDomainId).toBe("atlas-cosmere-production");
    expect(result.configurationFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not bootstrap from an absent host configuration", async () => {
    const result = await loadHoidTrustedHostBootstrap(
      { readPinnedConfiguration: vi.fn(async () => null) },
      REPOSITORY,
      NOW,
    );
    expect(result).toMatchObject({
      status: "blocked",
      reason: "bootstrap-not-provisioned",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  });

  it("rejects a repository outside the host-pinned allowlist", async () => {
    const result = await loadHoidTrustedHostBootstrap(
      { readPinnedConfiguration: async () => configuration() },
      "another/repository",
      NOW,
    );
    expect(result).toMatchObject({
      status: "blocked",
      reason: "bootstrap-invalid",
      validationReason: "repository-not-authorized",
    });
  });

  it("rejects expired, future-dated and overlong bootstrap configurations", () => {
    expect(validateHoidTrustedHostBootstrapConfiguration(
      configuration({ expiresAt: "2026-11-18T00:00:00.000Z" }),
      REPOSITORY,
      NOW,
    )).toMatchObject({ status: "invalid", reason: "configuration-expired" });

    expect(validateHoidTrustedHostBootstrapConfiguration(
      configuration({ provisionedAt: "2026-11-20T00:00:00.000Z" }),
      REPOSITORY,
      NOW,
    )).toMatchObject({ status: "invalid", reason: "configuration-expired" });

    expect(validateHoidTrustedHostBootstrapConfiguration(
      configuration({ expiresAt: "2027-03-01T00:00:00.000Z" }),
      REPOSITORY,
      NOW,
    )).toMatchObject({ status: "invalid", reason: "configuration-lifetime-exceeded" });
  });

  it("rejects invalid roots, revisions and non-canonical repository scopes", () => {
    expect(validateHoidTrustedHostBootstrapConfiguration(
      configuration({ rootKey: { keyId: "root-2026", publicKeyHex: "zz".repeat(32) } }),
      REPOSITORY,
      NOW,
    )).toMatchObject({ status: "invalid", reason: "invalid-root-key" });

    expect(validateHoidTrustedHostBootstrapConfiguration(
      configuration({ minimumRegistryRevision: 0 }),
      REPOSITORY,
      NOW,
    )).toMatchObject({ status: "invalid", reason: "invalid-minimum-revision" });

    expect(validateHoidTrustedHostBootstrapConfiguration(
      configuration({ allowedRepositoryFullNames: Object.freeze([REPOSITORY, REPOSITORY]) }),
      REPOSITORY,
      NOW,
    )).toMatchObject({ status: "invalid", reason: "invalid-repository-scope" });
  });

  it("never invokes accessors in host-pinned configuration", () => {
    let invoked = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    for (const [key, value] of Object.entries(configuration())) {
      Object.defineProperty(hostile, key, {
        enumerable: true,
        configurable: true,
        ...(key === "trustDomainId"
          ? { get() { invoked = true; return value; } }
          : { value }),
      });
    }
    expect(validateHoidTrustedHostBootstrapConfiguration(hostile, REPOSITORY, NOW))
      .toMatchObject({ status: "invalid", reason: "invalid-configuration" });
    expect(invoked).toBe(false);
  });

  it("requires the pre-provisioned revision floor to exist in the host store", async () => {
    const validation = validateHoidTrustedHostBootstrapConfiguration(configuration(), REPOSITORY, NOW);
    if (validation.status !== "valid") throw new Error("Fixture bootstrap invalid");
    const store = {
      readMinimumRevision: vi.fn(async () => 4),
      compareAndSetMinimumRevision: vi.fn(async () => false),
    };
    const result = await verifyHoidTrustedHostRevisionStore(validation.configuration, store, REPOSITORY, NOW);
    expect(result).toEqual({
      status: "ready",
      trustDomainId: "atlas-cosmere-production",
      configuredMinimumRevision: 3,
      persistedMinimumRevision: 4,
    });
    expect(store.compareAndSetMinimumRevision).not.toHaveBeenCalled();
  });

  it("fails closed on an uninitialized, rolled-back or unavailable revision store", async () => {
    const validation = validateHoidTrustedHostBootstrapConfiguration(configuration(), REPOSITORY, NOW);
    if (validation.status !== "valid") throw new Error("Fixture bootstrap invalid");

    expect(await verifyHoidTrustedHostRevisionStore(validation.configuration, {
      readMinimumRevision: async () => null,
      compareAndSetMinimumRevision: async () => false,
    }, REPOSITORY, NOW)).toMatchObject({ status: "blocked", reason: "revision-store-uninitialized" });

    expect(await verifyHoidTrustedHostRevisionStore(validation.configuration, {
      readMinimumRevision: async () => 2,
      compareAndSetMinimumRevision: async () => false,
    }, REPOSITORY, NOW)).toMatchObject({ status: "blocked", reason: "revision-store-rollback" });

    expect(await verifyHoidTrustedHostRevisionStore(validation.configuration, {
      readMinimumRevision: async () => { throw new Error("offline"); },
      compareAndSetMinimumRevision: async () => false,
    }, REPOSITORY, NOW)).toMatchObject({ status: "blocked", reason: "revision-store-unavailable" });
  });
});
