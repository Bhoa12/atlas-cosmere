import { describe, expect, it, vi } from "vitest";
import {
  emptyHoidCursorProgressSnapshot,
  type HoidCursorProgressSnapshot,
} from "./cursorProgressLedger";
import type {
  HoidCursorProgressStore,
  HoidCursorStoreLoadResult,
} from "./cursorSqliteProgressStore";
import type { HoidCursorProgressInvalidationSource } from "./cursorBackedUnitProgressStore";
import { isHoidTrustedConversationScreenPort } from "./trustedConversationScreenPort";
import {
  createHoidTrustedApplicationBootstrap,
  type HoidTrustedApplicationDependencies,
} from "./trustedApplicationBootstrap";

const fixedNow = "2026-11-25T01:00:00.000Z";

function dependencies(
  overrides: Partial<HoidTrustedApplicationDependencies> = {},
  loadResult?: HoidCursorStoreLoadResult,
) {
  const snapshot = emptyHoidCursorProgressSnapshot();
  const cursorStore: HoidCursorProgressStore = Object.freeze({
    load: async () => loadResult ?? Object.freeze({
      status: "ready" as const,
      snapshot,
      migratedFromV1: false,
    }),
    read: async () => snapshot,
    compareAndSwap: async () => false,
  });
  const invalidationSource: HoidCursorProgressInvalidationSource = Object.freeze({
    subscribe: (_listener: () => void) => () => {},
  });
  const transport = vi.fn(async () => Object.freeze({}));
  const compositionConfig = Object.freeze({
    transport,
    packageSource: Object.freeze({
      load: async () => Object.freeze([]),
      subscribe: (_listener: () => void) => () => {},
    }),
    registrySource: Object.freeze({
      load: async () => null,
    }),
    checkpointStore: Object.freeze({
      read: async () => null,
      compareAndSwap: async () => false,
      subscribe: (_listener: (checkpoint: unknown) => void) => () => {},
    }),
    clock: Object.freeze({ nowIso: () => fixedNow }),
    context: Object.freeze({
      schemaVersion: 1,
      repositoryFullName: "Bhoa12/atlas-cosmere",
      pullRequestNumber: 297,
      baseRef: "feat/hoid-ia-core-run296",
      baseSha: "13063195f7d329f82fa9f0d60c13f7e8c9b63b8a",
      headRef: "feat/hoid-ia-core-run297",
      headSha: "f".repeat(40),
      promotionManifestPath: "docs/hoid/promotions/run297.json",
      promotionPlanFingerprint: "a".repeat(64),
      reviewBundleFingerprint: "b".repeat(64),
    }),
    rootKey: Object.freeze({ keyId: "root-test", publicKeyHex: "c".repeat(64) }),
    verifier: Object.freeze({ verify: async () => false }),
  });

  return Object.freeze({
    compositionConfig,
    cursorStore,
    invalidationSource,
    sessionId: "hoid-screen:primary",
    ...overrides,
  });
}

describe("Hoid trusted application bootstrap", () => {
  it("creates one branded screen port after durable cursor progress initializes", async () => {
    const load = vi.fn(async () => dependencies());
    const bootstrap = createHoidTrustedApplicationBootstrap(load, () => fixedNow);
    expect(bootstrap).not.toBeNull();
    if (!bootstrap) return;

    expect(bootstrap.getSnapshot()).toEqual({ status: "idle" });
    const result = await bootstrap.initialize();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(isHoidTrustedConversationScreenPort(result.screenPort)).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
    bootstrap.dispose();
    expect(bootstrap.getSnapshot()).toEqual({ status: "disposed" });
  });

  it("coalesces concurrent and re-entrant initialization into one attempt", async () => {
    const load = vi.fn(async () => dependencies());
    const bootstrap = createHoidTrustedApplicationBootstrap(load, () => fixedNow);
    if (!bootstrap) throw new Error("Bootstrap factory unavailable");

    let reentrant: Promise<unknown> | null = null;
    const unsubscribe = bootstrap.subscribe(() => {
      if (bootstrap.getSnapshot().status === "loading") {
        reentrant = bootstrap.initialize();
      }
    });

    const first = bootstrap.initialize();
    const second = bootstrap.initialize();
    expect(second).toBe(first);
    const result = await first;
    expect(result.status).toBe("ready");
    expect(reentrant).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);

    unsubscribe();
    bootstrap.dispose();
  });

  it("rejects accessor-backed dependency records without invoking getters", async () => {
    const base = dependencies();
    let getterCalls = 0;
    const hostile = { ...base };
    Object.defineProperty(hostile, "compositionConfig", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return base.compositionConfig;
      },
    });
    Object.freeze(hostile);

    const bootstrap = createHoidTrustedApplicationBootstrap(async () => hostile);
    if (!bootstrap) throw new Error("Bootstrap factory unavailable");
    expect(await bootstrap.initialize()).toEqual({
      status: "blocked",
      reason: "invalid-dependencies",
    });
    expect(getterCalls).toBe(0);
    bootstrap.dispose();
  });

  it("rejects unknown dependency fields and malformed session identifiers", async () => {
    const base = dependencies();
    const extra = Object.freeze({ ...base, unexpected: true });
    const first = createHoidTrustedApplicationBootstrap(async () => extra);
    if (!first) throw new Error("Bootstrap factory unavailable");
    expect(await first.initialize()).toMatchObject({
      status: "blocked",
      reason: "invalid-dependencies",
    });
    first.dispose();

    const second = createHoidTrustedApplicationBootstrap(async () =>
      dependencies({ sessionId: "../screen" }),
    );
    if (!second) throw new Error("Bootstrap factory unavailable");
    expect(await second.initialize()).toMatchObject({
      status: "blocked",
      reason: "invalid-dependencies",
    });
    second.dispose();
  });

  it("fails closed when the durable cursor ledger is unavailable", async () => {
    const unavailable: HoidCursorStoreLoadResult = Object.freeze({
      status: "unavailable",
      reason: "storage-error",
    });
    const bootstrap = createHoidTrustedApplicationBootstrap(async () =>
      dependencies({}, unavailable),
    );
    if (!bootstrap) throw new Error("Bootstrap factory unavailable");

    expect(await bootstrap.initialize()).toEqual({
      status: "blocked",
      reason: "progress-unavailable",
    });
    bootstrap.dispose();
  });

  it("does not retry a blocked initialization implicitly", async () => {
    const load = vi.fn(async () => null);
    const bootstrap = createHoidTrustedApplicationBootstrap(load);
    if (!bootstrap) throw new Error("Bootstrap factory unavailable");

    const first = await bootstrap.initialize();
    const second = await bootstrap.initialize();
    expect(first).toEqual({ status: "blocked", reason: "invalid-dependencies" });
    expect(second).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
    bootstrap.dispose();
  });

  it("aborts dependency loading and never publishes a late result after disposal", async () => {
    let resolveDependencies: ((value: unknown) => void) | null = null;
    let receivedSignal: AbortSignal | null = null;
    const pending = new Promise<unknown>(resolve => {
      resolveDependencies = resolve;
    });
    const bootstrap = createHoidTrustedApplicationBootstrap(signal => {
      receivedSignal = signal;
      return pending;
    });
    if (!bootstrap) throw new Error("Bootstrap factory unavailable");

    const initialization = bootstrap.initialize();
    await Promise.resolve();
    expect(receivedSignal).not.toBeNull();

    bootstrap.dispose();
    expect(receivedSignal?.aborted).toBe(true);
    resolveDependencies?.(dependencies());

    expect(await initialization).toEqual({ status: "disposed" });
    expect(bootstrap.getSnapshot()).toEqual({ status: "disposed" });
  });

  it("maps loader failures to a neutral blocked state", async () => {
    const bootstrap = createHoidTrustedApplicationBootstrap(async () => {
      throw new Error("synthetic loader failure");
    });
    if (!bootstrap) throw new Error("Bootstrap factory unavailable");

    expect(await bootstrap.initialize()).toEqual({
      status: "blocked",
      reason: "bootstrap-failed",
    });
    bootstrap.dispose();
  });

  it("keeps the provider uncalled until a user turn and disposes the screen session", async () => {
    const deps = dependencies();
    const bootstrap = createHoidTrustedApplicationBootstrap(async () => deps);
    if (!bootstrap) throw new Error("Bootstrap factory unavailable");

    const result = await bootstrap.initialize();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    const response = await result.screenPort.send({
      question: "Pregunta sintética.",
      intent: "explain",
      depth: "brief",
    });
    expect(response.status).toBe("blocked");
    expect(deps.compositionConfig).toBeDefined();
    expect((deps.compositionConfig as { transport: ReturnType<typeof vi.fn> }).transport)
      .not.toHaveBeenCalled();

    bootstrap.dispose();
    const afterDispose = await result.screenPort.send({
      question: "Otra pregunta sintética.",
      intent: "explain",
      depth: "brief",
    });
    expect(afterDispose).toMatchObject({ status: "blocked", reason: "disposed" });
  });

  it("isolates listener failures and notifies state transitions", async () => {
    const bootstrap = createHoidTrustedApplicationBootstrap(async () => dependencies());
    if (!bootstrap) throw new Error("Bootstrap factory unavailable");
    const observed: string[] = [];
    bootstrap.subscribe(() => {
      throw new Error("observer failure");
    });
    const unsubscribe = bootstrap.subscribe(() => {
      observed.push(bootstrap.getSnapshot().status);
    });

    await bootstrap.initialize();
    expect(observed).toEqual(["loading", "ready"]);
    unsubscribe();
    bootstrap.dispose();
    expect(observed).toEqual(["loading", "ready", "disposed"]);
  });

  it("returns null for a missing loader or invalid clock", () => {
    expect(createHoidTrustedApplicationBootstrap(null as never)).toBeNull();
    expect(createHoidTrustedApplicationBootstrap(async () => dependencies(), "not-a-clock" as never))
      .toBeNull();
  });
});
