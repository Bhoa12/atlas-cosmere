import { describe, expect, it, vi } from "vitest";
import { emptyHoidCursorProgressSnapshot } from "./cursorProgressLedger";
import type {
  HoidCursorProgressStore,
  HoidCursorStoreLoadResult,
} from "./cursorSqliteProgressStore";
import {
  createHoidTrustedApplicationDependencyLoader,
} from "./trustedApplicationPlatform";

function createProgressRuntime() {
  const snapshot = emptyHoidCursorProgressSnapshot();
  const loadResult: HoidCursorStoreLoadResult = Object.freeze({
    status: "ready",
    snapshot,
    migratedFromV1: false,
  });
  const cursorStore: HoidCursorProgressStore = {
    load: vi.fn(async () => loadResult),
    read: vi.fn(async () => snapshot),
    compareAndSwap: vi.fn(async () => true),
  };
  const invalidationSource = {
    subscribe: vi.fn((_listener: () => void) => () => {}),
  };
  return { cursorStore, invalidationSource };
}

function platformPorts(
  progressRuntime: () => Promise<unknown>,
  compositionConfig: () => Promise<unknown>,
) {
  return Object.freeze({
    loadProgressRuntime: vi.fn(progressRuntime),
    loadCompositionConfig: vi.fn(compositionConfig),
  });
}

const config = Object.freeze({
  transport: vi.fn(async () => Object.freeze({})),
  packageSource: Object.freeze({
    load: async () => Object.freeze([]),
    subscribe: (_listener: () => void) => () => {},
  }),
  registrySource: Object.freeze({ load: async () => null }),
  checkpointStore: Object.freeze({
    read: async () => null,
    compareAndSwap: async () => false,
    subscribe: (_listener: (checkpoint: unknown) => void) => () => {},
  }),
  clock: Object.freeze({ nowIso: () => "2026-11-25T17:00:00.000Z" }),
  context: Object.freeze({
    schemaVersion: 1,
    repositoryFullName: "Bhoa12/atlas-cosmere",
    pullRequestNumber: 314,
    baseRef: "feat/hoid-ia-core-run313",
    baseSha: "f81ffba62e2360be723f172a9767e4e8b1a9cc00",
    headRef: "feat/hoid-ia-core-run314",
    headSha: "0".repeat(40),
    promotionManifestPath: "docs/hoid/promotions/run314.json",
    promotionPlanFingerprint: "a".repeat(64),
    reviewBundleFingerprint: "b".repeat(64),
  }),
  rootKey: Object.freeze({ keyId: "synthetic-test-root", publicKeyHex: "c".repeat(64) }),
  verifier: Object.freeze({ verify: async () => false }),
});

describe("Hoid trusted application platform dependency loader", () => {
  it("returns frozen dependencies backed by captured progress ports", async () => {
    const runtime = createProgressRuntime();
    const ports = platformPorts(
      async () => runtime,
      async () => config,
    );
    const loader = createHoidTrustedApplicationDependencyLoader(
      ports,
      "hoid-screen:primary",
    );
    expect(loader).not.toBeNull();
    if (!loader) return;

    const dependencies = await loader(new AbortController().signal);
    expect(Object.isFrozen(dependencies)).toBe(true);
    expect(dependencies.compositionConfig).toBe(config);
    expect(dependencies.sessionId).toBe("hoid-screen:primary");
    expect(Object.isFrozen(dependencies.cursorStore)).toBe(true);
    expect(Object.isFrozen(dependencies.invalidationSource)).toBe(true);

    await dependencies.cursorStore.load();
    await dependencies.cursorStore.read();
    expect(await dependencies.cursorStore.compareAndSwap(0, emptyHoidCursorProgressSnapshot())).toBe(true);
    const listener = vi.fn();
    expect(typeof dependencies.invalidationSource.subscribe(listener)).toBe("function");
    expect(runtime.cursorStore.load).toHaveBeenCalledTimes(1);
    expect(runtime.cursorStore.read).toHaveBeenCalledTimes(1);
    expect(runtime.cursorStore.compareAndSwap).toHaveBeenCalledTimes(1);
    expect(runtime.invalidationSource.subscribe).toHaveBeenCalledWith(listener);
  });

  it("validates progress before requesting native trust or provider configuration", async () => {
    const loadCompositionConfig = vi.fn(async () => config);
    const loader = createHoidTrustedApplicationDependencyLoader(
      platformPorts(async () => null, loadCompositionConfig),
      "hoid-screen:primary",
    );
    if (!loader) throw new Error("Dependency loader unavailable");

    await expect(loader(new AbortController().signal)).rejects.toThrow(
      "Hoid native progress runtime is incomplete or malformed",
    );
    expect(loadCompositionConfig).not.toHaveBeenCalled();
  });

  it("rejects unknown platform and progress-runtime fields", () => {
    const validRuntime = createProgressRuntime();
    expect(createHoidTrustedApplicationDependencyLoader(
      Object.freeze({
        loadProgressRuntime: async () => validRuntime,
        loadCompositionConfig: async () => config,
        unexpected: true,
      }),
      "hoid-screen:primary",
    )).toBeNull();

    expect(createHoidTrustedApplicationDependencyLoader(
      Object.freeze({
        loadProgressRuntime: async () => ({
          ...validRuntime,
          extra: true,
        }),
        loadCompositionConfig: async () => config,
      }),
      "hoid-screen:primary",
    )).not.toBeNull();
  });

  it("rejects accessor-backed platform ports without invoking getters", () => {
    let getterCalls = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "loadProgressRuntime", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return async () => createProgressRuntime();
      },
    });
    Object.defineProperty(hostile, "loadCompositionConfig", {
      enumerable: true,
      value: async () => config,
    });

    expect(createHoidTrustedApplicationDependencyLoader(hostile, "hoid-screen:primary")).toBeNull();
    expect(getterCalls).toBe(0);
  });

  it("rejects accessor-backed progress ports without invoking getters", async () => {
    let getterCalls = 0;
    const runtime = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(runtime, "cursorStore", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return createProgressRuntime().cursorStore;
      },
    });
    Object.defineProperty(runtime, "invalidationSource", {
      enumerable: true,
      value: createProgressRuntime().invalidationSource,
    });

    const loadCompositionConfig = vi.fn(async () => config);
    const loader = createHoidTrustedApplicationDependencyLoader(
      platformPorts(async () => runtime, loadCompositionConfig),
      "hoid-screen:primary",
    );
    if (!loader) throw new Error("Dependency loader unavailable");

    await expect(loader(new AbortController().signal)).rejects.toThrow(
      "Hoid native progress runtime is incomplete or malformed",
    );
    expect(getterCalls).toBe(0);
    expect(loadCompositionConfig).not.toHaveBeenCalled();
  });

  it("captures native store methods before later property replacement", async () => {
    const runtime = createProgressRuntime();
    const originalLoad = runtime.cursorStore.load;
    const replacementLoad = vi.fn(async () => ({
      status: "unavailable" as const,
      reason: "storage-error" as const,
    }));
    const loader = createHoidTrustedApplicationDependencyLoader(
      platformPorts(async () => runtime, async () => config),
      "hoid-screen:primary",
    );
    if (!loader) throw new Error("Dependency loader unavailable");

    const dependencies = await loader(new AbortController().signal);
    (runtime.cursorStore as { load: typeof replacementLoad }).load = replacementLoad;
    await dependencies.cursorStore.load();

    expect(originalLoad).toHaveBeenCalledTimes(1);
    expect(replacementLoad).not.toHaveBeenCalled();
  });

  it("does not load trust configuration when the bootstrap signal is already aborted", async () => {
    const runtime = createProgressRuntime();
    const ports = platformPorts(async () => runtime, async () => config);
    const loader = createHoidTrustedApplicationDependencyLoader(ports, "hoid-screen:primary");
    if (!loader) throw new Error("Dependency loader unavailable");

    const controller = new AbortController();
    controller.abort();
    await expect(loader(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(ports.loadProgressRuntime).not.toHaveBeenCalled();
    expect(ports.loadCompositionConfig).not.toHaveBeenCalled();
  });

  it("stops before trust loading when cancellation occurs during progress acquisition", async () => {
    const runtime = createProgressRuntime();
    const controller = new AbortController();
    const loadCompositionConfig = vi.fn(async () => config);
    const loader = createHoidTrustedApplicationDependencyLoader(
      platformPorts(async () => {
        controller.abort();
        return runtime;
      }, loadCompositionConfig),
      "hoid-screen:primary",
    );
    if (!loader) throw new Error("Dependency loader unavailable");

    await expect(loader(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(loadCompositionConfig).not.toHaveBeenCalled();
  });

  it("rejects malformed session identifiers before any platform call", () => {
    const loadProgressRuntime = vi.fn(async () => createProgressRuntime());
    const loadCompositionConfig = vi.fn(async () => config);
    expect(createHoidTrustedApplicationDependencyLoader(
      platformPorts(loadProgressRuntime, loadCompositionConfig),
      "../screen",
    )).toBeNull();
    expect(loadProgressRuntime).not.toHaveBeenCalled();
    expect(loadCompositionConfig).not.toHaveBeenCalled();
  });
});
