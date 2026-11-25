import { describe, expect, it, vi } from "vitest";
import { emptyHoidUnitProgressSnapshot, type HoidUnitProgressStore } from "./unitProgressLedger";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";
import {
  createHoidTrustedConversationComposition,
  createHoidTrustedCursorConversationComposition,
  isHoidTrustedConversationComposition,
} from "./trustedConversationComposition";
import { createHoidReadingCursor } from "./readingManifest";
import { emptyHoidCursorProgressSnapshot, type HoidCursorProgressSnapshot } from "./cursorProgressLedger";
import type { HoidCursorProgressStore, HoidCursorStoreLoadResult } from "./cursorSqliteProgressStore";
import type { HoidCursorProgressInvalidationSource } from "./cursorBackedUnitProgressStore";

const fixedNow = "2026-11-24T22:00:00.000Z";

class MemoryProgressStore implements HoidUnitProgressStore {
  async read(): Promise<unknown> {
    return emptyHoidUnitProgressSnapshot();
  }

  async compareAndSwap(): Promise<boolean> {
    return false;
  }
}

class ProgressInvalidation {
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

function sink() {
  return Object.freeze({
    present: vi.fn(),
    clear: vi.fn(),
  });
}

function setup() {
  const coordinator = new HoidUnitProgressCoordinator(
    new MemoryProgressStore(),
    () => fixedNow,
  );
  const progressInvalidation = new ProgressInvalidation();
  const transport = vi.fn(async () => Object.freeze({}));

  const checkpointStore = {
    read: async () => null as unknown,
    compareAndSwap: async () => false,
    subscribe: (_listener: (checkpoint: unknown) => void) => () => {},
  };
  const config = Object.freeze({
    coordinator,
    progressInvalidation,
    transport,
    packageSource: Object.freeze({
      load: async () => Object.freeze([]),
      subscribe: (_listener: () => void) => () => {},
    }),
    registrySource: Object.freeze({
      load: async () => null,
    }),
    checkpointStore,
    clock: Object.freeze({ nowIso: () => fixedNow }),
    context: Object.freeze({
      schemaVersion: 1,
      repositoryFullName: "Bhoa12/atlas-cosmere",
      pullRequestNumber: 294,
      baseRef: "feat/hoid-ia-core-run293",
      baseSha: "9233af55823e32cfca2fc9b3a34cfe1c3423e2d3",
      headRef: "feat/hoid-ia-core-run294",
      headSha: "753c54644a416c8853dffedbe57e273a34b8c292",
      promotionManifestPath: "docs/hoid/promotions/run294.json",
      promotionPlanFingerprint: "a".repeat(64),
      reviewBundleFingerprint: "b".repeat(64),
    }),
    rootKey: Object.freeze({ keyId: "root-test", publicKeyHex: "c".repeat(64) }),
    verifier: Object.freeze({ verify: async () => false }),
  });

  const result = createHoidTrustedConversationComposition(config);
  if (result.status !== "composed") {
    throw new Error("Synthetic composition was not constructed: " + result.reason);
  }
  return { ...result, transport, progressInvalidation, coordinator, checkpointStore, config };
}

describe("Hoid trusted conversation composition v3", () => {
  it("brands only compositions returned by the trusted composition factory", () => {
    const { composition } = setup();
    expect(isHoidTrustedConversationComposition(composition)).toBe(true);
    expect(Object.isFrozen(composition)).toBe(true);
    expect(Object.getOwnPropertyNames(composition)).toEqual([]);
    expect(Object.isFrozen(Object.getPrototypeOf(composition))).toBe(true);
    expect(isHoidTrustedConversationComposition(Object.freeze({
      createSession: () => ({ status: "invalid-session" }),
      closeSession: () => false,
      dispose: () => {},
    }))).toBe(false);
    composition.dispose();
  });

  it("fails closed on a missing or malformed composition", () => {
    expect(createHoidTrustedConversationComposition(null)).toEqual({
      status: "blocked",
      reason: "invalid-composition-config",
    });
    expect(createHoidTrustedConversationComposition({})).toEqual({
      status: "blocked",
      reason: "invalid-composition-config",
    });
  });

  it("rejects accessor-backed composition fields without invoking getters", () => {
    const { config: base, composition } = setup();
    let getterCalls = 0;
    const hostile = { ...base };
    Object.defineProperty(hostile, "transport", {
      enumerable: true,
      configurable: true,
      get() {
        getterCalls += 1;
        return base.transport;
      },
    });
    Object.freeze(hostile);

    expect(createHoidTrustedConversationComposition(hostile)).toEqual({
      status: "blocked",
      reason: "invalid-composition-config",
    });
    expect(getterCalls).toBe(0);
    composition.dispose();
  });

  it("creates isolated sessions and rejects duplicate or malformed IDs", () => {
    const { composition } = setup();
    const firstSink = sink();
    const first = composition.createSession("screen:primary", firstSink);
    expect(first.status).toBe("created");
    expect(composition.activeSessionCount).toBe(1);

    expect(composition.createSession("screen:primary", sink())).toEqual({
      status: "duplicate-session",
    });
    expect(composition.createSession("../invalid", sink())).toEqual({
      status: "invalid-session",
    });
    expect(composition.createSession("screen:secondary", {})).toEqual({
      status: "invalid-sink",
    });
    expect(composition.activeSessionCount).toBe(1);
    composition.dispose();
  });

  it("allows a session identifier to be reused only after the old session is closed", () => {
    const { composition } = setup();
    expect(composition.createSession("screen:primary", sink()).status).toBe("created");
    expect(composition.closeSession("screen:primary")).toBe(true);
    expect(composition.activeSessionCount).toBe(0);
    expect(composition.createSession("screen:primary", sink()).status).toBe("created");
    composition.dispose();
  });

  it("disposes every session and rejects new work after disposal", () => {
    const { composition } = setup();
    expect(composition.createSession("screen:one", sink()).status).toBe("created");
    expect(composition.createSession("screen:two", sink()).status).toBe("created");
    composition.dispose();
    composition.dispose();
    expect(composition.activeSessionCount).toBe(0);
    expect(composition.createSession("screen:three", sink())).toEqual({ status: "disposed" });
  });

  it("does not call the provider when the trusted checkpoint is not provisioned", async () => {
    const { composition, transport } = setup();
    const created = composition.createSession("screen:primary", sink());
    expect(created.status).toBe("created");
    if (created.status !== "created") return;

    const result = await created.session.send({
      question: "Pregunta sintética sin spoilers.",
      intent: "explain",
      depth: "brief",
    });

    expect(result).toMatchObject({
      status: "blocked",
      reason: "host-blocked",
      hostReason: "trust-checkpoint-invalid",
    });
    expect(transport).not.toHaveBeenCalled();
    composition.dispose();
  });

  it("does not create a composition when the provider transport is not callable", () => {
    const { config, composition } = setup();
    const invalid = { ...config, transport: "not-a-transport" };
    expect(createHoidTrustedConversationComposition(invalid)).toEqual({
      status: "blocked",
      reason: "invalid-composition-config",
    });
    composition.dispose();
  });

  it("captures trust-port methods so later property replacement cannot swap the checkpoint reader", async () => {
    const { composition, checkpointStore, transport } = setup();
    checkpointStore.read = async () => Object.freeze({ revision: 0, registryFingerprint: null });
    const created = composition.createSession("screen:captured-port", sink());
    expect(created.status).toBe("created");
    if (created.status !== "created") return;

    const result = await created.session.send({
      question: "Pregunta sintética.",
      intent: "explain",
      depth: "brief",
    });

    expect(result).toMatchObject({
      status: "blocked",
      reason: "host-blocked",
      hostReason: "trust-checkpoint-invalid",
    });
    expect(transport).not.toHaveBeenCalled();
    composition.dispose();
  });

  it("caps active sessions to the host presentation limit", () => {
    const { composition } = setup();
    for (let index = 0; index < 64; index += 1) {
      expect(composition.createSession(`screen:${index}`, sink()).status).toBe("created");
    }
    expect(composition.activeSessionCount).toBe(64);
    expect(composition.createSession("screen:overflow", sink())).toEqual({ status: "session-limit" });
    composition.dispose();
  });

  it("closes a session idempotently without affecting other sessions", () => {
    const { composition } = setup();
    expect(composition.createSession("screen:one", sink()).status).toBe("created");
    expect(composition.createSession("screen:two", sink()).status).toBe("created");
    expect(composition.closeSession("screen:one")).toBe(true);
    expect(composition.closeSession("screen:one")).toBe(false);
    expect(composition.activeSessionCount).toBe(1);
    composition.dispose();
  });
});

class MemoryCursorProgressStore implements HoidCursorProgressStore {
  value: HoidCursorProgressSnapshot = emptyHoidCursorProgressSnapshot();
  loadResult: HoidCursorStoreLoadResult | null = null;
  casCalls = 0;

  async load(): Promise<HoidCursorStoreLoadResult> {
    return this.loadResult ?? Object.freeze({
      status: "ready" as const,
      snapshot: this.value,
      migratedFromV1: false,
    });
  }

  async read(): Promise<unknown> {
    const result = await this.load();
    return result.status === "ready" ? result.snapshot : null;
  }

  async compareAndSwap(): Promise<boolean> {
    this.casCalls += 1;
    return false;
  }
}

class MemoryCursorProgressInvalidation implements HoidCursorProgressInvalidationSource {
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

function cursorSnapshot(bookId = "tfe", chapterNumber = 3, revision = 1): HoidCursorProgressSnapshot {
  const created = createHoidReadingCursor(bookId, chapterNumber);
  if (created.status !== "ready") throw new Error("Synthetic cursor unavailable");
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze([
      Object.freeze({ bookId, cursor: created.cursor }),
    ]),
    updatedAt: fixedNow,
  });
}

describe("Hoid trusted composition over Atlas cursor progress", () => {
  it("uses the existing cursor ledger as the only progress authority", async () => {
    const base = setup();
    const cursorStore = new MemoryCursorProgressStore();
    cursorStore.value = cursorSnapshot("tfe", 3, 7);
    const invalidation = new MemoryCursorProgressInvalidation();
    const cursorConfig = {
      transport: base.config.transport,
      packageSource: base.config.packageSource,
      registrySource: base.config.registrySource,
      checkpointStore: base.config.checkpointStore,
      clock: base.config.clock,
      context: base.config.context,
      rootKey: base.config.rootKey,
      verifier: base.config.verifier,
    };

    const result = await createHoidTrustedCursorConversationComposition(
      cursorConfig,
      cursorStore,
      invalidation,
      () => fixedNow,
    );
    expect(result.status).toBe("composed");
    if (result.status !== "composed") return;

    expect(result.coordinator.getSnapshot()).toMatchObject({
      schemaVersion: 3,
      revision: 7,
      positions: [{
        bookId: "tfe",
        cursor: { reference: { unitId: "chapter:003", ordinal: 3 } },
      }],
    });

    const listener = vi.fn();
    const unsubscribe = result.progressInvalidation.subscribe(listener);
    invalidation.emit();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();

    const created = result.composition.createSession("screen:cursor-backed", sink());
    expect(created.status).toBe("created");
    if (created.status === "created") {
      const answer = await created.session.send({
        question: "Pregunta sintética.",
        intent: "explain",
        depth: "brief",
      });
      expect(answer).toMatchObject({
        status: "blocked",
        reason: "host-blocked",
        hostReason: "trust-checkpoint-invalid",
      });
    }

    expect(base.transport).not.toHaveBeenCalled();
    expect(cursorStore.casCalls).toBe(0);
    result.dispose();
    base.composition.dispose();
  });

  it("does not compose when the authoritative cursor ledger is unavailable", async () => {
    const base = setup();
    const cursorStore = new MemoryCursorProgressStore();
    cursorStore.loadResult = Object.freeze({
      status: "unavailable",
      reason: "storage-error",
    });
    const result = await createHoidTrustedCursorConversationComposition(
      {
        transport: base.config.transport,
        packageSource: base.config.packageSource,
        registrySource: base.config.registrySource,
        checkpointStore: base.config.checkpointStore,
        clock: base.config.clock,
        context: base.config.context,
        rootKey: base.config.rootKey,
        verifier: base.config.verifier,
      },
      cursorStore,
      new MemoryCursorProgressInvalidation(),
      () => fixedNow,
    );

    expect(result).toEqual({ status: "blocked", reason: "progress-unavailable" });
    expect(cursorStore.casCalls).toBe(0);
    base.composition.dispose();
  });
});

