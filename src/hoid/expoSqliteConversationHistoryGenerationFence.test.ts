import { describe, expect, it } from "vitest";
import {
  createHoidConversationHistorySnapshot,
} from "./conversationHistoryHydration";
import {
  HOID_STATIC_GREETING_ID,
  HOID_STATIC_GREETING_KIND,
  HOID_STATIC_GREETING_TEXT,
} from "./conversationHistoryPolicy";
import {
  loadHoidConversationHistory,
  saveHoidConversationHistory,
  type HoidConversationHistoryStorePort,
  type HoidConversationStorageKey,
} from "./conversationHistoryStorePort";
import {
  createExpoSqliteHoidConversationHistoryFencedAdapter,
  type HoidExpoSqliteHoidConversationHistoryFencedAdapter,
} from "./expoSqliteConversationHistoryGenerationFence";
import type {
  HoidConversationPayloadProtectionContext,
  HoidConversationPayloadProtector,
} from "./expoSqliteConversationHistoryStore";
import type {
  HoidSqliteBindValue,
  HoidSqliteDatabasePort,
  HoidSqliteRunResult,
  HoidSqliteTransactionPort,
} from "./sqliteProgressStore";

type StoredHistoryRow = Readonly<{
  schema_version: number;
  storage_revision: number;
  payload_ciphertext: string;
}>;

type StoredFenceRow = Readonly<{
  partition_id: string;
  principal_id: string;
  conversation_id: string;
  generation: number;
  state: "active" | "inactive" | "fenced";
  operation_id: string | null;
}>;

type MemoryState = {
  history: Map<string, StoredHistoryRow>;
  fences: Map<string, StoredFenceRow>;
};

const PARTITION = "profile-local-01:conversation-01";
const KEY_A = Object.freeze({
  principalId: "profile-local-01",
  conversationId: "conversation-01",
});
const KEY_B = Object.freeze({
  principalId: "profile-local-02",
  conversationId: "conversation-01",
});
const SCOPE = Object.freeze({ revision: 31, fingerprint: "a".repeat(64) });

function historyKey(key: HoidConversationStorageKey): string {
  return key.principalId + "\u0000" + key.conversationId;
}

function greeting() {
  return {
    id: HOID_STATIC_GREETING_ID,
    emisor: "hoid" as const,
    kind: HOID_STATIC_GREETING_KIND,
    texto: HOID_STATIC_GREETING_TEXT,
  };
}

function snapshot() {
  const created = createHoidConversationHistorySnapshot([
    greeting(),
    { id: "user-1", emisor: "usuario" as const, texto: "Pregunta" },
    {
      id: "answer-1",
      emisor: "hoid" as const,
      texto: "Respuesta",
      progressScope: SCOPE,
    },
  ], SCOPE);
  if (created.status !== "ready") throw new Error("Invalid test snapshot");
  return created.snapshot;
}

const protector: HoidConversationPayloadProtector = Object.freeze({
  seal: async (plaintext: string, context: HoidConversationPayloadProtectionContext) =>
    "sealed:" + context.principalId + ":" + context.conversationId + ":" +
    String(context.storageRevision) + ":" + encodeURIComponent(plaintext),
  open: async (ciphertext: string, context: HoidConversationPayloadProtectionContext) => {
    const prefix = "sealed:" + context.principalId + ":" + context.conversationId + ":" +
      String(context.storageRevision) + ":";
    if (!ciphertext.startsWith(prefix)) throw new Error("Authentication failed");
    return decodeURIComponent(ciphertext.slice(prefix.length));
  },
});

class MemoryTransaction implements HoidSqliteTransactionPort {
  constructor(private readonly state: MemoryState) {}

  async execAsync(_source: string): Promise<void> {}

  async getFirstAsync<T>(
    source: string,
    ...params: HoidSqliteBindValue[]
  ): Promise<T | null> {
    if (source.includes("FROM hoid_conversation_history_generation_v1")) {
      return (this.state.fences.get(String(params[0])) as unknown as T | undefined) ?? null;
    }
    if (source.includes("FROM hoid_conversation_history_v1")) {
      const key = String(params[0]) + "\u0000" + String(params[1]);
      return (this.state.history.get(key) as unknown as T | undefined) ?? null;
    }
    throw new Error("Unexpected SELECT: " + source);
  }

  async runAsync(
    source: string,
    ...params: HoidSqliteBindValue[]
  ): Promise<HoidSqliteRunResult> {
    if (source.includes("INSERT OR IGNORE INTO hoid_conversation_history_generation_v1")) {
      const partitionId = String(params[0]);
      if (this.state.fences.has(partitionId)) return { changes: 0 };
      this.state.fences.set(partitionId, Object.freeze({
        partition_id: partitionId,
        principal_id: String(params[1]),
        conversation_id: String(params[2]),
        generation: Number(params[3]),
        state: String(params[4]) as StoredFenceRow["state"],
        operation_id: params[5] === null ? null : String(params[5]),
      }));
      return { changes: 1 };
    }

    if (source.includes("UPDATE hoid_conversation_history_generation_v1")) {
      if (source.includes("SET generation = ?, state = 'fenced'")) {
        const partitionId = String(params[2]);
        const current = this.state.fences.get(partitionId);
        if (
          !current ||
          current.generation !== Number(params[3]) ||
          current.state !== String(params[4])
        ) return { changes: 0 };
        this.state.fences.set(partitionId, Object.freeze({
          ...current,
          generation: Number(params[0]),
          state: "fenced",
          operation_id: String(params[1]),
        }));
        return { changes: 1 };
      }
      if (source.includes("SET state = 'active'")) {
        const partitionId = String(params[0]);
        const current = this.state.fences.get(partitionId);
        if (
          !current ||
          current.generation !== Number(params[1]) ||
          current.state !== "fenced" ||
          current.operation_id !== String(params[2])
        ) return { changes: 0 };
        this.state.fences.set(partitionId, Object.freeze({
          ...current,
          state: "active",
        }));
        return { changes: 1 };
      }
    }

    if (source.includes("INSERT INTO hoid_conversation_history_v1")) {
      const key = String(params[0]) + "\u0000" + String(params[1]);
      if (this.state.history.has(key)) return { changes: 0 };
      this.state.history.set(key, Object.freeze({
        schema_version: Number(params[2]),
        storage_revision: Number(params[3]),
        payload_ciphertext: String(params[4]),
      }));
      return { changes: 1 };
    }

    if (source.includes("UPDATE hoid_conversation_history_v1")) {
      const key = String(params[3]) + "\u0000" + String(params[4]);
      const current = this.state.history.get(key);
      if (!current || current.storage_revision !== Number(params[5])) {
        return { changes: 0 };
      }
      this.state.history.set(key, Object.freeze({
        schema_version: Number(params[0]),
        storage_revision: Number(params[1]),
        payload_ciphertext: String(params[2]),
      }));
      return { changes: 1 };
    }

    throw new Error("Unexpected SQL write: " + source);
  }
}

class MemoryDatabase implements HoidSqliteDatabasePort {
  private state: MemoryState = { history: new Map(), fences: new Map() };
  private queue: Promise<void> = Promise.resolve();

  get history(): ReadonlyMap<string, StoredHistoryRow> {
    return this.state.history;
  }

  get fences(): ReadonlyMap<string, StoredFenceRow> {
    return this.state.fences;
  }

  async execAsync(_source: string): Promise<void> {}

  async getFirstAsync<T>(
    source: string,
    ...params: HoidSqliteBindValue[]
  ): Promise<T | null> {
    return new MemoryTransaction(this.state).getFirstAsync<T>(source, ...params);
  }

  async runAsync(
    source: string,
    ...params: HoidSqliteBindValue[]
  ): Promise<HoidSqliteRunResult> {
    return new MemoryTransaction(this.state).runAsync(source, ...params);
  }

  withExclusiveTransactionAsync(
    task: (transaction: HoidSqliteTransactionPort) => Promise<void>,
  ): Promise<void> {
    const operation = this.queue.then(async () => {
      const draft: MemoryState = {
        history: new Map(this.state.history),
        fences: new Map(this.state.fences),
      };
      await task(new MemoryTransaction(draft));
      this.state = draft;
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }
}

function makeAdapter(
  database: MemoryDatabase,
  role: "source" | "target" = "source",
  initialGeneration = 0,
): HoidExpoSqliteHoidConversationHistoryFencedAdapter {
  const adapter = createExpoSqliteHoidConversationHistoryFencedAdapter(
    database,
    protector,
    {
      partitionId: PARTITION,
      storageKey: KEY_A,
      role,
      initialGeneration,
      storeGeneration: role === "source" ? initialGeneration : initialGeneration + 1,
    },
  );
  if (!adapter) throw new Error("Could not create fenced SQLite adapter");
  return adapter;
}

async function saved(adapter: HoidExpoSqliteHoidConversationHistoryFencedAdapter) {
  return saveHoidConversationHistory(
    adapter.store,
    KEY_A,
    null,
    snapshot(),
    SCOPE,
  );
}

describe("Expo SQLite conversation history generation fence", () => {
  it("allows a source store to read and write only at its bound active generation", async () => {
    const database = new MemoryDatabase();
    const adapter = makeAdapter(database);

    await expect(loadHoidConversationHistory(adapter.store, KEY_A, SCOPE))
      .resolves.toEqual({ status: "not-found" });
    await expect(saved(adapter)).resolves.toEqual({
      status: "saved",
      storageRevision: 1,
    });
    expect(database.fences.get(PARTITION)).toMatchObject({
      generation: 0,
      state: "active",
    });
  });

  it("fences the source in the same database transaction boundary used by history writes", async () => {
    const database = new MemoryDatabase();
    const adapter = makeAdapter(database);
    await saved(adapter);

    await expect(adapter.participant.fence({
      partitionId: PARTITION,
      expectedGeneration: 0,
      nextGeneration: 1,
      operationId: "migration-304-01",
    })).resolves.toBe("fenced");

    await expect(loadHoidConversationHistory(adapter.store, KEY_A, SCOPE))
      .resolves.toMatchObject({ status: "invalid-record" });
    await expect(saveHoidConversationHistory(
      adapter.store,
      KEY_A,
      1,
      snapshot(),
      SCOPE,
    )).resolves.toEqual({ status: "conflict" });
    expect(database.history.get(historyKey(KEY_A))?.storage_revision).toBe(1);
  });

  it("keeps an old source instance stale after reactivation at a newer generation", async () => {
    const database = new MemoryDatabase();
    const oldAdapter = makeAdapter(database);
    await saved(oldAdapter);
    await oldAdapter.participant.fence({
      partitionId: PARTITION,
      expectedGeneration: 0,
      nextGeneration: 1,
      operationId: "migration-304-02",
    });
    await expect(oldAdapter.participant.activate({
      partitionId: PARTITION,
      generation: 1,
      operationId: "migration-304-02",
    })).resolves.toBe("activated");

    await expect(loadHoidConversationHistory(oldAdapter.store, KEY_A, SCOPE))
      .resolves.toMatchObject({ status: "invalid-record" });

    const freshAdapter = makeAdapter(database, "source", 1);
    await expect(loadHoidConversationHistory(freshAdapter.store, KEY_A, SCOPE))
      .resolves.toMatchObject({ status: "ready", storageRevision: 1 });
  });

  it("keeps a target store unavailable until it is fenced and activated at its next generation", async () => {
    const database = new MemoryDatabase();
    const target = makeAdapter(database, "target", 0);

    await expect(loadHoidConversationHistory(target.store, KEY_A, SCOPE))
      .resolves.toMatchObject({ status: "invalid-record" });
    await expect(target.participant.fence({
      partitionId: PARTITION,
      expectedGeneration: 0,
      nextGeneration: 1,
      operationId: "migration-304-03",
    })).resolves.toBe("fenced");
    await expect(target.participant.activate({
      partitionId: PARTITION,
      generation: 1,
      operationId: "migration-304-03",
    })).resolves.toBe("activated");

    await expect(loadHoidConversationHistory(target.store, KEY_A, SCOPE))
      .resolves.toEqual({ status: "not-found" });
    await expect(saved(target)).resolves.toEqual({
      status: "saved",
      storageRevision: 1,
    });
  });

  it("makes fence and activation idempotent for the same operation", async () => {
    const database = new MemoryDatabase();
    const adapter = makeAdapter(database);
    const input = {
      partitionId: PARTITION,
      expectedGeneration: 0,
      nextGeneration: 1,
      operationId: "migration-304-04",
    };

    await expect(adapter.participant.fence(input)).resolves.toBe("fenced");
    await expect(adapter.participant.fence(input)).resolves.toBe("fenced");
    await expect(adapter.participant.activate({
      partitionId: PARTITION,
      generation: 1,
      operationId: input.operationId,
    })).resolves.toBe("activated");
    await expect(adapter.participant.activate({
      partitionId: PARTITION,
      generation: 1,
      operationId: input.operationId,
    })).resolves.toBe("already-active");
  });

  it("rejects another conversation key even when it shares the same database", async () => {
    const database = new MemoryDatabase();
    const adapter = makeAdapter(database);

    await expect(loadHoidConversationHistory(adapter.store, KEY_B, SCOPE))
      .resolves.toMatchObject({ status: "invalid-record" });
    const otherSnapshot = snapshot();
    const result = await saveHoidConversationHistory(
      adapter.store,
      KEY_B,
      null,
      otherSnapshot,
      SCOPE,
    );
    expect(result).toEqual({ status: "conflict" });
    expect(database.history.size).toBe(0);
  });

  it("does not allow a target participant to fence an already-active backend", async () => {
    const database = new MemoryDatabase();
    const source = makeAdapter(database);
    await loadHoidConversationHistory(source.store, KEY_A, SCOPE);

    const target = makeAdapter(database, "target", 0);
    await expect(target.participant.fence({
      partitionId: PARTITION,
      expectedGeneration: 0,
      nextGeneration: 1,
      operationId: "migration-304-05",
    })).resolves.toBe("conflict");
  });

  it("rejects malformed generations, operation identifiers and partition bindings", async () => {
    const database = new MemoryDatabase();
    expect(createExpoSqliteHoidConversationHistoryFencedAdapter(database, protector, {
      partitionId: PARTITION,
      storageKey: KEY_A,
      role: "source",
      initialGeneration: 0,
      storeGeneration: 1,
    })).toBeNull();

    const adapter = makeAdapter(database);
    await expect(adapter.participant.fence({
      partitionId: "another-partition",
      expectedGeneration: 0,
      nextGeneration: 1,
      operationId: "migration-304-06",
    })).resolves.toBe("blocked");
    await expect(adapter.participant.fence({
      partitionId: PARTITION,
      expectedGeneration: 0,
      nextGeneration: 2,
      operationId: "migration-304-06",
    })).resolves.toBe("blocked");
    await expect(adapter.participant.activate({
      partitionId: PARTITION,
      generation: 1,
      operationId: "invalid operation id",
    })).resolves.toBe("blocked");
  });

  it("serializes a concurrent write and fence so no write can commit after fencing", async () => {
    const database = new MemoryDatabase();
    const adapter = makeAdapter(database);
    const writePromise = saved(adapter);
    const fencePromise = adapter.participant.fence({
      partitionId: PARTITION,
      expectedGeneration: 0,
      nextGeneration: 1,
      operationId: "migration-304-07",
    });

    const [write, fence] = await Promise.all([writePromise, fencePromise]);
    expect(["saved", "conflict"]).toContain(write.status);
    expect(fence).toBe("fenced");

    const before = database.history.get(historyKey(KEY_A))?.storage_revision ?? 0;
    await expect(saveHoidConversationHistory(
      adapter.store,
      KEY_A,
      before === 0 ? null : before,
      snapshot(),
      SCOPE,
    )).resolves.toEqual({ status: "conflict" });
    expect(database.history.get(historyKey(KEY_A))?.storage_revision ?? 0).toBe(before);
  });
});
