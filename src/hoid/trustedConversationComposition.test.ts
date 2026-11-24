import { describe, expect, it, vi } from "vitest";
import { emptyHoidUnitProgressSnapshot, type HoidUnitProgressStore } from "./unitProgressLedger";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";
import { createHoidTrustedConversationComposition } from "./trustedConversationComposition";

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
