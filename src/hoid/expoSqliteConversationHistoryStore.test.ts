import { describe, expect, it } from "vitest";
import { createHoidConversationHistorySnapshot } from "./conversationHistoryHydration";
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
  createExpoSqliteHoidConversationHistoryStore,
  type HoidConversationPayloadProtectionContext,
  type HoidConversationPayloadProtector,
} from "./expoSqliteConversationHistoryStore";
import type {
  HoidSqliteBindValue,
  HoidSqliteDatabasePort,
  HoidSqliteRunResult,
  HoidSqliteTransactionPort,
} from "./sqliteProgressStore";

type StoredRow = Readonly<{
  schema_version: number;
  storage_revision: number;
  payload_ciphertext: string;
}>;

type StoredState = Map<string, StoredRow>;

const scopeA = Object.freeze({ revision: 31, fingerprint: "a".repeat(64) });
const scopeB = Object.freeze({ revision: 32, fingerprint: "b".repeat(64) });
const keyA = Object.freeze({
  principalId: "profile-local-01",
  conversationId: "conversation-01",
});
const keyB = Object.freeze({
  principalId: "profile-local-02",
  conversationId: "conversation-01",
});

function partitionKey(key: HoidConversationStorageKey): string {
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

function userMessage(id = "user-1") {
  return { id, emisor: "usuario" as const, texto: "Pregunta del lector" };
}

function assistantMessage() {
  return {
    id: "answer-1",
    emisor: "hoid" as const,
    texto: "Respuesta autorizada",
    progressScope: scopeA,
  };
}

function snapshot(messages: unknown = [greeting(), userMessage(), assistantMessage()]) {
  const result = createHoidConversationHistorySnapshot(messages, scopeA);
  if (result.status !== "ready") throw new Error("Invalid conversation fixture");
  return result.snapshot;
}

const testProtector: HoidConversationPayloadProtector = Object.freeze({
  seal: async (plaintext: string, context: HoidConversationPayloadProtectionContext) =>
    "test-sealed:" +
    context.principalId + ":" +
    context.conversationId + ":" +
    String(context.storageRevision) + ":" +
    encodeURIComponent(plaintext),
  open: async (ciphertext: string, context: HoidConversationPayloadProtectionContext) => {
    const prefix = "test-sealed:" +
      context.principalId + ":" +
      context.conversationId + ":" +
      String(context.storageRevision) + ":";
    if (!ciphertext.startsWith(prefix)) throw new Error("Authentication failed");
    return decodeURIComponent(ciphertext.slice(prefix.length));
  },
});

class MemoryTransaction implements HoidSqliteTransactionPort {
  constructor(private readonly state: StoredState) {}

  async execAsync(_source: string): Promise<void> {}

  async getFirstAsync<T>(
    source: string,
    ...params: HoidSqliteBindValue[]
  ): Promise<T | null> {
    if (!source.includes("FROM hoid_conversation_history_v1")) {
      throw new Error("Unexpected SELECT");
    }
    const key = String(params[0]) + "\u0000" + String(params[1]);
    return (this.state.get(key) as unknown as T | undefined) ?? null;
  }

  async runAsync(
    source: string,
    ...params: HoidSqliteBindValue[]
  ): Promise<HoidSqliteRunResult> {
    if (source.includes("INSERT INTO hoid_conversation_history_v1")) {
      const key = String(params[0]) + "\u0000" + String(params[1]);
      if (this.state.has(key)) return { changes: 0 };
      this.state.set(key, Object.freeze({
        schema_version: Number(params[2]),
        storage_revision: Number(params[3]),
        payload_ciphertext: String(params[4]),
      }));
      return { changes: 1 };
    }

    if (source.includes("UPDATE hoid_conversation_history_v1")) {
      const key = String(params[3]) + "\u0000" + String(params[4]);
      const current = this.state.get(key);
      if (!current || current.storage_revision !== Number(params[5])) {
        return { changes: 0 };
      }
      this.state.set(key, Object.freeze({
        schema_version: Number(params[0]),
        storage_revision: Number(params[1]),
        payload_ciphertext: String(params[2]),
      }));
      return { changes: 1 };
    }

    throw new Error("Unexpected SQL write");
  }
}

class MemoryDatabase implements HoidSqliteDatabasePort {
  state: StoredState = new Map();
  busyNextTransaction = false;
  failNextRead = false;
  private queue: Promise<void> = Promise.resolve();

  async execAsync(_source: string): Promise<void> {}

  async getFirstAsync<T>(
    source: string,
    ...params: HoidSqliteBindValue[]
  ): Promise<T | null> {
    if (this.failNextRead) {
      this.failNextRead = false;
      throw new Error("simulated read failure");
    }
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
      if (this.busyNextTransaction) {
        this.busyNextTransaction = false;
        const error = new Error("database is locked");
        Object.assign(error, { code: "SQLITE_BUSY" });
        throw error;
      }
      const draft = new Map(this.state);
      await task(new MemoryTransaction(draft));
      this.state = draft;
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }
}

function createStore(database: MemoryDatabase): HoidConversationHistoryStorePort {
  return createExpoSqliteHoidConversationHistoryStore(database, testProtector);
}

describe("Expo SQLite Hoid conversation history adapter", () => {
  it("initializes the table and reports an absent partition as not-found", async () => {
    const database = new MemoryDatabase();
    const result = await loadHoidConversationHistory(createStore(database), keyA, scopeA);
    expect(result).toEqual({ status: "not-found" });
  });

  it("round-trips a canonical encrypted history record", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    const saved = await saveHoidConversationHistory(store, keyA, null, snapshot(), scopeA);
    expect(saved).toEqual({ status: "saved", storageRevision: 1 });

    const loaded = await loadHoidConversationHistory(store, keyA, scopeA);
    expect(loaded.status).toBe("ready");
    if (loaded.status !== "ready") return;
    expect(loaded.storageRevision).toBe(1);
    expect(loaded.messages.map(message => message.id)).toEqual([
      HOID_STATIC_GREETING_ID,
      "user-1",
      "answer-1",
    ]);
  });

  it("never stores the conversation plaintext in the SQLite row", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await saveHoidConversationHistory(store, keyA, null, snapshot(), scopeA);
    const row = database.state.get(partitionKey(keyA));
    expect(row).toBeDefined();
    expect(row?.payload_ciphertext).not.toContain("Respuesta autorizada");
    expect(row?.payload_ciphertext).toContain("test-sealed:");
  });

  it("uses storage revisions independently from reading progress revisions", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    const first = await saveHoidConversationHistory(store, keyA, null, snapshot(), scopeA);
    const second = await saveHoidConversationHistory(
      store,
      keyA,
      1,
      snapshot([greeting(), userMessage("user-2")]),
      scopeA,
    );
    expect(first).toEqual({ status: "saved", storageRevision: 1 });
    expect(second).toEqual({ status: "saved", storageRevision: 2 });
    const row = database.state.get(partitionKey(keyA));
    expect(row?.storage_revision).toBe(2);
    expect(scopeA.revision).toBe(31);
  });

  it("rejects stale writers without overwriting a newer conversation", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await saveHoidConversationHistory(store, keyA, null, snapshot(), scopeA);
    const stale = await saveHoidConversationHistory(
      store,
      keyA,
      null,
      snapshot([greeting(), userMessage("stale")]),
      scopeA,
    );
    expect(stale).toEqual({ status: "conflict" });
    expect(database.state.get(partitionKey(keyA))?.storage_revision).toBe(1);
  });

  it("allows only one of two concurrent create-only writers", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    const results = await Promise.all([
      saveHoidConversationHistory(store, keyA, null, snapshot(), scopeA),
      saveHoidConversationHistory(
        store,
        keyA,
        null,
        snapshot([greeting(), userMessage("second")]),
        scopeA,
      ),
    ]);
    expect(results.filter(result => result.status === "saved")).toHaveLength(1);
    expect(results.filter(result => result.status === "conflict")).toHaveLength(1);
    expect(database.state.size).toBe(1);
  });

  it("isolates records by both principal and conversation identifiers", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await saveHoidConversationHistory(store, keyA, null, snapshot(), scopeA);
    const other = await loadHoidConversationHistory(store, keyB, scopeA);
    expect(other).toEqual({ status: "not-found" });
  });

  it("isolates conversations within the same principal partition", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await saveHoidConversationHistory(store, keyA, null, snapshot(), scopeA);
    const otherConversation = Object.freeze({
      principalId: keyA.principalId,
      conversationId: "conversation-02",
    });
    const loaded = await loadHoidConversationHistory(store, otherConversation, scopeA);
    expect(loaded).toEqual({ status: "not-found" });
  });

  it("drops assistant prose when the saved reading progress is stale", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await saveHoidConversationHistory(store, keyA, null, snapshot(), scopeA);
    const loaded = await loadHoidConversationHistory(store, keyA, scopeB);
    expect(loaded.status).toBe("stale");
    if (loaded.status !== "stale") return;
    expect(loaded.messages.map(message => message.id)).toEqual([
      HOID_STATIC_GREETING_ID,
      "user-1",
    ]);
    expect(loaded.droppedAssistantCount).toBe(1);
  });

  it("returns unavailable when authenticated decryption fails", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await saveHoidConversationHistory(store, keyA, null, snapshot(), scopeA);
    const row = database.state.get(partitionKey(keyA));
    if (!row) throw new Error("Missing row");
    database.state.set(partitionKey(keyA), Object.freeze({
      ...row,
      payload_ciphertext: "tampered-ciphertext",
    }));
    expect(await loadHoidConversationHistory(store, keyA, scopeA))
      .toEqual({ status: "unavailable" });
  });

  it("rejects authenticated but malformed JSON as an invalid record", async () => {
    const database = new MemoryDatabase();
    const context: HoidConversationPayloadProtectionContext = Object.freeze({
      purpose: "hoid-conversation-history",
      schemaVersion: 1,
      principalId: keyA.principalId,
      conversationId: keyA.conversationId,
      storageRevision: 1,
    });
    database.state.set(partitionKey(keyA), Object.freeze({
      schema_version: 1,
      storage_revision: 1,
      payload_ciphertext: await testProtector.seal("{broken", context),
    }));
    const loaded = await loadHoidConversationHistory(createStore(database), keyA, scopeA);
    expect(loaded).toEqual({ status: "invalid-record" });
  });

  it("does not overwrite a corrupt existing row during compare-and-swap", async () => {
    const database = new MemoryDatabase();
    database.state.set(partitionKey(keyA), Object.freeze({
      schema_version: 1,
      storage_revision: 1,
      payload_ciphertext: "tampered",
    }));
    const before = database.state.get(partitionKey(keyA))?.payload_ciphertext;
    const result = await saveHoidConversationHistory(
      createStore(database),
      keyA,
      1,
      snapshot(),
      scopeA,
    );
    expect(result).toEqual({ status: "unavailable" });
    expect(database.state.get(partitionKey(keyA))?.payload_ciphertext).toBe(before);
  });

  it("returns conflict for SQLite busy/locked transactions", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await loadHoidConversationHistory(store, keyA, scopeA);
    database.busyNextTransaction = true;
    const result = await saveHoidConversationHistory(store, keyA, null, snapshot(), scopeA);
    expect(result).toEqual({ status: "conflict" });
  });

  it("returns unavailable when a read fails instead of treating it as empty history", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    database.failNextRead = true;
    expect(await loadHoidConversationHistory(store, keyA, scopeA))
      .toEqual({ status: "unavailable" });
  });

  it("rejects SQL injection-shaped partition identifiers before touching SQLite", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    const invalidKey = {
      principalId: "profile'; DROP TABLE hoid_conversation_history_v1;--",
      conversationId: "conversation-01",
    };
    expect(await loadHoidConversationHistory(store, invalidKey, scopeA))
      .toEqual({ status: "invalid-input", reason: "invalid-key" });
    expect(database.state.size).toBe(0);
  });

  it("rejects a protector with accessor-backed methods without invoking getters", () => {
    let invoked = false;
    const hostile = Object.defineProperties({}, {
      seal: {
        enumerable: true,
        get: () => {
          invoked = true;
          return async () => "ciphertext";
        },
      },
      open: { enumerable: true, value: async () => "{}" },
    });
    expect(() => createExpoSqliteHoidConversationHistoryStore(
      new MemoryDatabase(),
      hostile,
    )).toThrow(TypeError);
    expect(invoked).toBe(false);
  });

  it("does not overwrite a row when its SQL envelope disagrees with the encrypted record", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await saveHoidConversationHistory(store, keyA, null, snapshot(), scopeA);
    const row = database.state.get(partitionKey(keyA));
    if (!row) throw new Error("Missing row");
    database.state.set(partitionKey(keyA), Object.freeze({
      ...row,
      storage_revision: 7,
    }));
    const result = await saveHoidConversationHistory(store, keyA, 1, snapshot(), scopeA);
    expect(result).toEqual({ status: "unavailable" });
    expect(database.state.get(partitionKey(keyA))?.storage_revision).toBe(7);
  });
});
