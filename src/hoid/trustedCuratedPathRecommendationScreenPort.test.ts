import { describe, expect, it, vi } from "vitest";
import {
  createHoidTrustedCuratedPathRecommendationScreenPort,
  isHoidTrustedCuratedPathRecommendationScreenPort,
} from "./trustedCuratedPathRecommendationScreenPort";

const REPOSITORY = "Bhoa12/atlas-cosmere";
const NOW = "2026-11-26T08:00:00.000Z";

function pinnedConfiguration(minimumRegistryRevision = 1) {
  return Object.freeze({
    schemaVersion: 1,
    configurationId: "hoid-route-test",
    trustDomainId: "hoid-routes",
    rootKey: Object.freeze({
      keyId: "route-root",
      publicKeyHex: "a".repeat(64),
    }),
    minimumRegistryRevision,
    allowedRepositoryFullNames: Object.freeze([REPOSITORY]),
    provisionedAt: "2026-11-26T07:00:00.000Z",
    expiresAt: "2026-12-01T00:00:00.000Z",
  });
}

function validationMaterial(repositoryFullName = REPOSITORY) {
  return Object.freeze({
    plan: null,
    catalogue: null,
    progressSnapshot: null,
    attestations: Object.freeze([]),
    registry: null,
    verifier: Object.freeze({ verify: async () => false }),
    evidencePackages: Object.freeze([]),
    evidenceContext: Object.freeze({ repositoryFullName }),
  });
}

function config(
  loadValidationInput: (signal?: AbortSignal) => unknown | Promise<unknown>,
  options: Readonly<{
    pinned?: unknown;
    minimumRevision?: number | null;
    repositoryFullName?: string;
  }> = {},
) {
  return Object.freeze({
    loadValidationInput,
    trustedHostBootstrapPort: Object.freeze({
      readPinnedConfiguration: async () => options.pinned === undefined
        ? pinnedConfiguration()
        : options.pinned,
    }),
    revisionStore: Object.freeze({
      readMinimumRevision: async () => options.minimumRevision === undefined
        ? 1
        : options.minimumRevision,
    }),
    repositoryFullName: options.repositoryFullName ?? REPOSITORY,
    clock: Object.freeze({ now: () => NOW }),
  });
}

describe("Hoid trusted curated-path recommendation screen port", () => {
  it("creates a branded port and reloads route material on every presentation", async () => {
    const loadValidationInput = vi.fn(async () => validationMaterial());
    const port = createHoidTrustedCuratedPathRecommendationScreenPort(config(loadValidationInput));
    expect(port).not.toBeNull();
    if (!port) return;

    expect(isHoidTrustedCuratedPathRecommendationScreenPort(port)).toBe(true);
    expect(await port.present()).toEqual({
      status: "withheld",
      reason: "plan-revalidation-failed",
    });
    expect(await port.present()).toEqual({
      status: "withheld",
      reason: "plan-revalidation-failed",
    });
    expect(loadValidationInput).toHaveBeenCalledTimes(2);
    port.dispose();
  });

  it("rejects structurally compatible but unbranded ports", () => {
    const fake = Object.freeze({
      present: async () => ({ status: "ready", items: [] }),
      dispose: () => {},
    });
    expect(isHoidTrustedCuratedPathRecommendationScreenPort(fake)).toBe(false);
  });

  it("rejects accessor-backed configuration without invoking getters", () => {
    let getterCalls = 0;
    const hostile = Object.create(null);
    Object.defineProperties(hostile, {
      loadValidationInput: {
        enumerable: true,
        get() {
          getterCalls += 1;
          return async () => validationMaterial();
        },
      },
      trustedHostBootstrapPort: { enumerable: true, value: {} },
      revisionStore: { enumerable: true, value: {} },
      repositoryFullName: { enumerable: true, value: REPOSITORY },
      clock: { enumerable: true, value: { now: () => NOW } },
    });
    expect(createHoidTrustedCuratedPathRecommendationScreenPort(hostile)).toBeNull();
    expect(getterCalls).toBe(0);
  });

  it("does not call the host loader when the request is already aborted", async () => {
    const loadValidationInput = vi.fn(async () => validationMaterial());
    const port = createHoidTrustedCuratedPathRecommendationScreenPort(config(loadValidationInput));
    if (!port) throw new Error("Port unavailable");
    const controller = new AbortController();
    controller.abort();

    expect(await port.present(controller.signal)).toEqual({
      status: "withheld",
      reason: "cancelled",
    });
    expect(loadValidationInput).not.toHaveBeenCalled();
    port.dispose();
  });

  it("discards an older request when a newer presentation starts", async () => {
    let releaseFirst!: (value: unknown) => void;
    const firstInput = new Promise<unknown>(resolve => {
      releaseFirst = resolve;
    });
    let calls = 0;
    const loadValidationInput = vi.fn(() => {
      calls += 1;
      return calls === 1 ? firstInput : Promise.resolve(validationMaterial());
    });
    const port = createHoidTrustedCuratedPathRecommendationScreenPort(config(loadValidationInput));
    if (!port) throw new Error("Port unavailable");

    const first = port.present();
    const second = port.present();
    expect(await second).toEqual({
      status: "withheld",
      reason: "plan-revalidation-failed",
    });
    releaseFirst(validationMaterial());
    expect(await first).toEqual({ status: "withheld", reason: "cancelled" });
    port.dispose();
  });

  it("returns a neutral source-unavailable result when the host loader fails", async () => {
    const port = createHoidTrustedCuratedPathRecommendationScreenPort(config(async () => {
      throw new Error("private host failure");
    }));
    if (!port) throw new Error("Port unavailable");
    expect(await port.present()).toEqual({
      status: "withheld",
      reason: "source-unavailable",
    });
    port.dispose();
  });

  it("invalidates in-flight work before loading route material when disposed", async () => {
    const loadValidationInput = vi.fn(async () => validationMaterial());
    const port = createHoidTrustedCuratedPathRecommendationScreenPort(config(loadValidationInput));
    if (!port) throw new Error("Port unavailable");

    const request = port.present();
    port.dispose();
    expect(await port.present()).toEqual({
      status: "withheld",
      reason: "port-disposed",
    });
    expect(await request).toEqual({
      status: "withheld",
      reason: "port-disposed",
    });
    expect(loadValidationInput).not.toHaveBeenCalled();
  });

  it("blocks when the pinned trust bootstrap is not provisioned", async () => {
    const loadValidationInput = vi.fn(async () => validationMaterial());
    const port = createHoidTrustedCuratedPathRecommendationScreenPort(config(
      loadValidationInput,
      { pinned: null },
    ));
    if (!port) throw new Error("Port unavailable");
    expect(await port.present()).toEqual({
      status: "withheld",
      reason: "trust-anchor-unavailable",
    });
    expect(loadValidationInput).not.toHaveBeenCalled();
    port.dispose();
  });

  it("blocks a rolled-back durable reviewer-registry revision", async () => {
    const loadValidationInput = vi.fn(async () => validationMaterial());
    const port = createHoidTrustedCuratedPathRecommendationScreenPort(config(
      loadValidationInput,
      { pinned: pinnedConfiguration(2), minimumRevision: 1 },
    ));
    if (!port) throw new Error("Port unavailable");
    expect(await port.present()).toEqual({
      status: "withheld",
      reason: "trust-anchor-unavailable",
    });
    expect(loadValidationInput).not.toHaveBeenCalled();
    port.dispose();
  });

  it("rejects route material scoped to another repository", async () => {
    const loadValidationInput = vi.fn(async () => validationMaterial("attacker/other-repo"));
    const port = createHoidTrustedCuratedPathRecommendationScreenPort(config(loadValidationInput));
    if (!port) throw new Error("Port unavailable");
    expect(await port.present()).toEqual({
      status: "withheld",
      reason: "invalid-validation-context",
    });
    port.dispose();
  });

  it("rejects loader attempts to supply an alternate root key or revision floor", async () => {
    const material = {
      ...validationMaterial(),
      rootKey: { keyId: "attacker", publicKeyHex: "b".repeat(64) },
      minimumRegistryRevision: 1,
    };
    const port = createHoidTrustedCuratedPathRecommendationScreenPort(config(async () => material));
    if (!port) throw new Error("Port unavailable");
    expect(await port.present()).toEqual({
      status: "withheld",
      reason: "invalid-validation-context",
    });
    port.dispose();
  });
});
