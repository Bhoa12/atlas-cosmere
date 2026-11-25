import { describe, expect, it, vi } from "vitest";
import {
  createHoidConversationVaultGenerationFencedAdapter,
  HOID_VAULT_GENERATION_FENCE_DURABILITY,
  type HoidVaultGenerationFenceRecord,
  type HoidVaultGenerationFenceStorePort,
  type HoidVaultGenerationFenceTransactionPort,
} from "./conversationVaultGenerationFence";
import type { HoidConversationVault, HoidConversationVaultResult } from "./conversationVault";
import { createHoidConversationVaultHistoryBridge } from "./conversationVaultHistoryBridge";

const PARTITION = "profile-local-01:conversation-01";
const SESSION = "hoid-screen:primary";

class MemoryFenceStore {
  private readonly rows = new Map<string, HoidVaultGenerationFenceRecord>();
  private readonly tails = new Map<string, Promise<void>>();

  readonly port: HoidVaultGenerationFenceStorePort = Object.freeze({
    durability: HOID_VAULT_GENERATION_FENCE_DURABILITY,
    withExclusive: async <T>(
      partitionId: string,
      task: (transaction: HoidVaultGenerationFenceTransactionPort) => Promise<T>,
    ): Promise<T> => {
      const previous = this.tails.get(partitionId) ?? Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>(resolve => { release = resolve; });
      this.tails.set(partitionId, previous.then(() => current));
      await previous;
      const transaction: HoidVaultGenerationFenceTransactionPort = Object.freeze({
        read: async id => id === partitionId ? this.rows.get(id) ?? null : null,
        create: async (id, initial) => {
          if (id !== partitionId || this.rows.has(id)) return "conflict";
          this.rows.set(id, initial);
          return "created";
        },
        compareAndSwap: async (id, expected, next) => {
          if (id !== partitionId) return "conflict";
          const row = this.rows.get(id);
          if (!row ||
            row.generation !== expected.generation ||
            row.state !== expected.state ||
            row.operationId !== expected.operationId) return "conflict";
          this.rows.set(id, next);
          return "saved";
        },
      });
      try {
        return await task(transaction);
      } finally {
        release();
      }
    },
  });

  row(): HoidVaultGenerationFenceRecord | null {
    return this.rows.get(PARTITION) ?? null;
  }
}

function makeVault(options: Readonly<{ delaySave?: boolean }> = {}) {
  let revision = 0;
  let stored: unknown = null;
  let releaseSave: (() => void) | null = null;
  let markStarted: (() => void) | null = null;
  const saveStarted = new Promise<void>(resolve => { markStarted = resolve; });
  const saveGate = options.delaySave
    ? new Promise<void>(resolve => { releaseSave = resolve; })
    : Promise.resolve();

  const restore = vi.fn(async (): Promise<HoidConversationVaultResult> => stored === null
    ? Object.freeze({ status: "empty", revision })
    : Object.freeze({ status: "ready", revision, snapshot: stored }));
  const save = vi.fn(async (
    _sessionId: string,
    expectedRevision: number,
    snapshot: unknown,
  ): Promise<HoidConversationVaultResult> => {
    if (options.delaySave) markStarted?.();
    await saveGate;
    if (expectedRevision !== revision) return Object.freeze({ status: "conflict", revision });
    revision += 1;
    stored = snapshot;
    return Object.freeze({ status: "saved", revision });
  });
  const clear = vi.fn(async (
    _sessionId: string,
    expectedRevision: number,
  ): Promise<HoidConversationVaultResult> => {
    if (expectedRevision !== revision) return Object.freeze({ status: "conflict", revision });
    revision += 1;
    stored = null;
    return Object.freeze({ status: "cleared", revision });
  });
  const vault: HoidConversationVault = Object.freeze({ restore, save, clear });
  return {
    vault, restore, save, clear, saveStarted,
    releaseSave: () => releaseSave?.(),
  };
}

function adapter(
  vault: HoidConversationVault,
  store: HoidVaultGenerationFenceStorePort,
  role: "source" | "target" = "source",
  initialGeneration = 0,
) {
  const value = createHoidConversationVaultGenerationFencedAdapter(vault, store, {
    partitionId: PARTITION,
    sessionId: SESSION,
    role,
    initialGeneration,
    storeGeneration: role === "source" ? initialGeneration : initialGeneration + 1,
  });
  if (!value) throw new Error("Vault generation fence construction failed");
  return value;
}

describe("Hoid Vault generation fence", () => {
  it("allows active source restore, save and clear", async () => {
    const memory = new MemoryFenceStore();
    const fixture = makeVault();
    const fenced = adapter(fixture.vault, memory.port);
    await expect(fenced.vault.restore(SESSION)).resolves.toEqual({ status: "empty", revision: 0 });
    await expect(fenced.vault.save(SESSION, 0, { messages: ["reader"] }))
      .resolves.toEqual({ status: "saved", revision: 1 });
    await expect(fenced.vault.clear(SESSION, 1))
      .resolves.toEqual({ status: "cleared", revision: 2 });
    expect(fixture.restore).toHaveBeenCalledTimes(1);
    expect(fixture.save).toHaveBeenCalledTimes(1);
    expect(fixture.clear).toHaveBeenCalledTimes(1);
    expect(memory.row()).toMatchObject({ generation: 0, state: "active" });
  });

  it("blocks all operations on the old source after fencing", async () => {
    const memory = new MemoryFenceStore();
    const fixture = makeVault();
    const fenced = adapter(fixture.vault, memory.port);
    await fenced.vault.save(SESSION, 0, { messages: ["safe"] });
    await expect(fenced.participant.fence({
      partitionId: PARTITION, expectedGeneration: 0, nextGeneration: 1,
      operationId: "migration-305-01",
    })).resolves.toBe("fenced");
    await expect(fenced.vault.restore(SESSION)).resolves.toEqual({
      status: "blocked", reason: "generation-fenced",
    });
    await expect(fenced.vault.save(SESSION, 1, {})).resolves.toEqual({
      status: "blocked", reason: "generation-fenced",
    });
    await expect(fenced.vault.clear(SESSION, 1)).resolves.toEqual({
      status: "blocked", reason: "generation-fenced",
    });
    expect(fixture.restore).not.toHaveBeenCalled();
    expect(fixture.save).toHaveBeenCalledTimes(1);
    expect(fixture.clear).not.toHaveBeenCalled();
  });

  it("keeps a target inactive until fenced and activated", async () => {
    const memory = new MemoryFenceStore();
    const fixture = makeVault();
    const target = adapter(fixture.vault, memory.port, "target", 0);
    await expect(target.vault.restore(SESSION)).resolves.toEqual({
      status: "blocked", reason: "generation-fenced",
    });
    await expect(target.participant.fence({
      partitionId: PARTITION, expectedGeneration: 0, nextGeneration: 1,
      operationId: "migration-305-02",
    })).resolves.toBe("fenced");
    await expect(target.participant.activate({
      partitionId: PARTITION, generation: 1, operationId: "migration-305-02",
    })).resolves.toBe("activated");
    await expect(target.vault.restore(SESSION)).resolves.toEqual({ status: "empty", revision: 0 });
  });

  it("keeps an old facade stale after a newer source generation is activated", async () => {
    const memory = new MemoryFenceStore();
    const fixture = makeVault();
    const old = adapter(fixture.vault, memory.port);
    await old.participant.fence({
      partitionId: PARTITION, expectedGeneration: 0, nextGeneration: 1,
      operationId: "migration-305-03",
    });
    await old.participant.activate({
      partitionId: PARTITION, generation: 1, operationId: "migration-305-03",
    });
    const fresh = adapter(fixture.vault, memory.port, "source", 1);
    await expect(old.vault.restore(SESSION)).resolves.toEqual({
      status: "blocked", reason: "generation-fenced",
    });
    await expect(fresh.vault.restore(SESSION)).resolves.toEqual({ status: "empty", revision: 0 });
  });

  it("makes fence and activation idempotent for the same operation", async () => {
    const memory = new MemoryFenceStore();
    const fenced = adapter(makeVault().vault, memory.port);
    const fenceInput = {
      partitionId: PARTITION, expectedGeneration: 0, nextGeneration: 1,
      operationId: "migration-305-04",
    };
    await expect(fenced.participant.fence(fenceInput)).resolves.toBe("fenced");
    await expect(fenced.participant.fence(fenceInput)).resolves.toBe("fenced");
    const activation = {
      partitionId: PARTITION, generation: 1, operationId: fenceInput.operationId,
    };
    await expect(fenced.participant.activate(activation)).resolves.toBe("activated");
    await expect(fenced.participant.activate(activation)).resolves.toBe("already-active");
  });

  it("does not let a target fence an active source", async () => {
    const memory = new MemoryFenceStore();
    const source = adapter(makeVault().vault, memory.port);
    await source.vault.restore(SESSION);
    const target = adapter(makeVault().vault, memory.port, "target", 0);
    await expect(target.participant.fence({
      partitionId: PARTITION, expectedGeneration: 0, nextGeneration: 1,
      operationId: "migration-305-05",
    })).resolves.toBe("conflict");
  });

  it("requires the matching operation ID to activate", async () => {
    const memory = new MemoryFenceStore();
    const target = adapter(makeVault().vault, memory.port, "target", 0);
    await target.participant.fence({
      partitionId: PARTITION, expectedGeneration: 0, nextGeneration: 1,
      operationId: "migration-305-06",
    });
    await expect(target.participant.activate({
      partitionId: PARTITION, generation: 1, operationId: "wrong-operation",
    })).resolves.toBe("blocked");
    expect(memory.row()).toMatchObject({ state: "fenced", operationId: "migration-305-06" });
  });

  it("rejects a different session before invoking the underlying Vault", async () => {
    const fixture = makeVault();
    const fenced = adapter(fixture.vault, new MemoryFenceStore().port);
    await expect(fenced.vault.restore("other-session")).resolves.toEqual({
      status: "blocked", reason: "invalid-session",
    });
    expect(fixture.restore).not.toHaveBeenCalled();
  });

  it("fails closed if the native exclusive gate is unavailable", async () => {
    const fixture = makeVault();
    const unavailable: HoidVaultGenerationFenceStorePort = Object.freeze({
      durability: HOID_VAULT_GENERATION_FENCE_DURABILITY,
      withExclusive: async () => { throw new Error("gate unavailable"); },
    });
    const fenced = adapter(fixture.vault, unavailable);
    await expect(fenced.vault.restore(SESSION)).resolves.toEqual({
      status: "blocked", reason: "generation-fence-unavailable",
    });
    expect(fixture.restore).not.toHaveBeenCalled();
    await expect(fenced.participant.fence({
      partitionId: PARTITION, expectedGeneration: 0, nextGeneration: 1,
      operationId: "migration-305-07",
    })).resolves.toBe("blocked");
  });

  it("rejects a malformed fence record", async () => {
    const fixture = makeVault();
    const malformed: HoidVaultGenerationFenceStorePort = Object.freeze({
      durability: HOID_VAULT_GENERATION_FENCE_DURABILITY,
      withExclusive: async (_partitionId, task) => task({
        read: async () => ({ partitionId: PARTITION, generation: 0 }),
        create: async () => "created",
        compareAndSwap: async () => "saved",
      } as unknown as HoidVaultGenerationFenceTransactionPort),
    });
    const fenced = adapter(fixture.vault, malformed);
    await expect(fenced.vault.restore(SESSION)).resolves.toEqual({
      status: "blocked", reason: "generation-fence-unavailable",
    });
    expect(fixture.restore).not.toHaveBeenCalled();
  });

  it("rejects invalid binding and false durability declarations", () => {
    const fixture = makeVault();
    const memory = new MemoryFenceStore();
    expect(createHoidConversationVaultGenerationFencedAdapter(
      fixture.vault, memory.port, {
        partitionId: PARTITION, sessionId: SESSION, role: "source",
        initialGeneration: 0, storeGeneration: 1,
      },
    )).toBeNull();
    expect(createHoidConversationVaultGenerationFencedAdapter(
      fixture.vault,
      { durability: "memory-only", withExclusive: memory.port.withExclusive },
      {
        partitionId: PARTITION, sessionId: SESSION, role: "source",
        initialGeneration: 0, storeGeneration: 0,
      },
    )).toBeNull();
  });

  it("rejects accessor-backed ports without invoking getters", () => {
    const fixture = makeVault();
    const memory = new MemoryFenceStore();
    let invoked = false;
    const hostile = Object.create(null);
    Object.defineProperties(hostile, {
      restore: { enumerable: true, get: () => { invoked = true; return fixture.vault.restore; } },
      save: { enumerable: true, value: fixture.vault.save },
      clear: { enumerable: true, value: fixture.vault.clear },
    });
    expect(createHoidConversationVaultGenerationFencedAdapter(
      hostile, memory.port, {
        partitionId: PARTITION, sessionId: SESSION, role: "source",
        initialGeneration: 0, storeGeneration: 0,
      },
    )).toBeNull();
    expect(invoked).toBe(false);
  });

  it("serializes an in-flight save before fencing and blocks all later writes", async () => {
    const memory = new MemoryFenceStore();
    const fixture = makeVault({ delaySave: true });
    const fenced = adapter(fixture.vault, memory.port);
    const savePromise = fenced.vault.save(SESSION, 0, { messages: ["in flight"] });
    await fixture.saveStarted;
    const fencePromise = fenced.participant.fence({
      partitionId: PARTITION, expectedGeneration: 0, nextGeneration: 1,
      operationId: "migration-305-08",
    });
    fixture.releaseSave();
    await expect(savePromise).resolves.toEqual({ status: "saved", revision: 1 });
    await expect(fencePromise).resolves.toBe("fenced");
    await expect(fenced.vault.save(SESSION, 1, { messages: ["stale"] })).resolves.toEqual({
      status: "blocked", reason: "generation-fenced",
    });
  });

  it("shares a fence between separately constructed facades", async () => {
    const memory = new MemoryFenceStore();
    const firstVault = makeVault();
    const secondVault = makeVault();
    const first = adapter(firstVault.vault, memory.port);
    const second = adapter(secondVault.vault, memory.port);
    await first.participant.fence({
      partitionId: PARTITION, expectedGeneration: 0, nextGeneration: 1,
      operationId: "migration-305-09",
    });
    await expect(second.vault.restore(SESSION)).resolves.toEqual({
      status: "blocked", reason: "generation-fenced",
    });
    expect(secondVault.restore).not.toHaveBeenCalled();
  });

  it("propagates the generation-fenced reason through the spoiler-safe bridge", async () => {
    const memory = new MemoryFenceStore();
    const fixture = makeVault();
    const fenced = adapter(fixture.vault, memory.port);
    const bridge = createHoidConversationVaultHistoryBridge(fenced.vault, SESSION);
    expect(bridge).not.toBeNull();
    if (!bridge) return;
    await fenced.participant.fence({
      partitionId: PARTITION, expectedGeneration: 0, nextGeneration: 1,
      operationId: "migration-305-10",
    });
    await expect(bridge.restore(null)).resolves.toEqual({
      status: "blocked", reason: "generation-fenced",
    });
    expect(fixture.restore).not.toHaveBeenCalled();
  });

  it("converts unexpected underlying Vault exceptions into blocked results", async () => {
    const memory = new MemoryFenceStore();
    const throwing: HoidConversationVault = Object.freeze({
      restore: async () => { throw new Error("restore failed"); },
      save: async () => { throw new Error("save failed"); },
      clear: async () => { throw new Error("clear failed"); },
    });
    const fenced = adapter(throwing, memory.port);
    await expect(fenced.vault.restore(SESSION)).resolves.toEqual({
      status: "blocked", reason: "blob-store-unavailable",
    });
    await expect(fenced.vault.save(SESSION, 0, {})).resolves.toEqual({
      status: "blocked", reason: "blob-store-unavailable",
    });
    await expect(fenced.vault.clear(SESSION, 0)).resolves.toEqual({
      status: "blocked", reason: "blob-store-unavailable",
    });
  });

  it("exposes migration-only reads and target writes only for the fenced operation", async () => {
    const sourceMemory = new MemoryFenceStore();
    const sourceFixture = makeVault();
    const source = adapter(sourceFixture.vault, sourceMemory.port);
    await expect(source.vault.save(SESSION, 0, { messages: ["source"] }))
      .resolves.toMatchObject({ status: "saved", revision: 1 });
    const operationId = "migration-307-vault-01";

    await expect(source.migration.read({ operationId, generation: 1 }))
      .resolves.toMatchObject({ status: "blocked" });
    await expect(source.participant.fence({
      partitionId: PARTITION,
      expectedGeneration: 0,
      nextGeneration: 1,
      operationId,
    })).resolves.toBe("fenced");
    await expect(source.migration.read({ operationId, generation: 1 }))
      .resolves.toMatchObject({ status: "ready", revision: 1 });
    await expect(source.migration.replace({
      operationId, generation: 1, expectedRevision: 1, snapshot: { messages: ["forbidden"] },
    })).resolves.toMatchObject({ status: "blocked" });

    const targetMemory = new MemoryFenceStore();
    const targetFixture = makeVault();
    const target = adapter(targetFixture.vault, targetMemory.port, "target", 0);
    await expect(target.participant.fence({
      partitionId: PARTITION,
      expectedGeneration: 0,
      nextGeneration: 1,
      operationId,
    })).resolves.toBe("fenced");
    await expect(target.migration.replace({
      operationId, generation: 1, expectedRevision: 0, snapshot: { messages: ["copied"] },
    })).resolves.toMatchObject({ status: "saved", revision: 1 });
    await expect(target.migration.read({ operationId, generation: 1 }))
      .resolves.toMatchObject({ status: "ready", revision: 1, snapshot: { messages: ["copied"] } });
    await expect(target.participant.activate({
      partitionId: PARTITION, generation: 1, operationId,
    })).resolves.toBe("activated");
    await expect(target.migration.read({ operationId, generation: 1 }))
      .resolves.toMatchObject({ status: "blocked" });
    await expect(target.vault.restore(SESSION))
      .resolves.toMatchObject({ status: "ready", revision: 1 });
  });

});
