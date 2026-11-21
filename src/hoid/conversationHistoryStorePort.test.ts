import { describe, expect, it } from "vitest";
import {
  HOID_STATIC_GREETING_ID,
  HOID_STATIC_GREETING_KIND,
  HOID_STATIC_GREETING_TEXT,
} from "./conversationHistoryPolicy";
import {
  HOID_CONVERSATION_STORAGE_RECORD_KIND,
  HOID_CONVERSATION_STORAGE_SCHEMA_VERSION,
  loadHoidConversationHistory,
  saveHoidConversationHistory,
  type HoidConversationHistoryStorePort,
  type HoidConversationStorageKey,
} from "./conversationHistoryStorePort";
import {
  createHoidConversationHistorySnapshot,
  type HoidConversationHistorySnapshot,
} from "./conversationHistoryHydration";

const scopeA = Object.freeze({ revision: 31, fingerprint: "a".repeat(64) });
const scopeB = Object.freeze({ revision: 32, fingerprint: "b".repeat(64) });
const key = Object.freeze({ principalId: "profile-local-01", conversationId: "conversation-01" });

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

function snapshot(messages: unknown = [greeting(), userMessage(), assistantMessage()]): HoidConversationHistorySnapshot {
  const result = createHoidConversationHistorySnapshot(messages, scopeA);
  if (result.status !== "ready") throw new Error("Invalid test fixture");
  return result.snapshot;
}

function makeStore(initial: unknown | null = null) {
  let current = initial;
  let writes = 0;
  let reads = 0;
  const port: HoidConversationHistoryStorePort = Object.freeze({
    read: async (_key: HoidConversationStorageKey) => {
      reads += 1;
      return current;
    },
    compareAndSwap: async (
      _key: HoidConversationStorageKey,
      expected: number | null,
      next: unknown,
    ) => {
      const currentRevision = current !== null &&
        typeof current === "object" &&
        !Array.isArray(current) &&
        typeof (current as { storageRevision?: unknown }).storageRevision === "number"
        ? (current as { storageRevision: number }).storageRevision
        : null;
      if (currentRevision !== expected) return "conflict";
      current = next;
      writes += 1;
      return "saved";
    },
  });
  return {
    port,
    get current() { return current; },
    get writes() { return writes; },
    get reads() { return reads; },
  };
}

function recordFor(
  recordKey: HoidConversationStorageKey = key,
  progress = scopeA,
  messages: unknown = [greeting(), userMessage(), assistantMessage()],
  storageRevision = 1,
) {
  return {
    schemaVersion: HOID_CONVERSATION_STORAGE_SCHEMA_VERSION,
    kind: HOID_CONVERSATION_STORAGE_RECORD_KIND,
    principalId: recordKey.principalId,
    conversationId: recordKey.conversationId,
    storageRevision,
    snapshot: snapshot(messages),
  };
}

describe("provider-neutral Hoid conversation history storage port", () => {
  it("creates a partitioned record with the first storage revision", async () => {
    const store = makeStore();
    const result = await saveHoidConversationHistory(
      store.port, key, null, snapshot(), scopeA,
    );
    expect(result).toEqual({ status: "saved", storageRevision: 1 });
    expect(store.writes).toBe(1);
    expect(store.current).toMatchObject({
      schemaVersion: 1,
      kind: HOID_CONVERSATION_STORAGE_RECORD_KIND,
      principalId: key.principalId,
      conversationId: key.conversationId,
      storageRevision: 1,
    });
  });

  it("loads a complete history only for the exact current progress identity", async () => {
    const store = makeStore(recordFor());
    const result = await loadHoidConversationHistory(store.port, key, scopeA);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.storageRevision).toBe(1);
    expect(result.messages.map(message => message.id)).toEqual([
      HOID_STATIC_GREETING_ID, "user-1", "answer-1",
    ]);
  });

  it("returns only user messages and the static greeting when progress is stale", async () => {
    const store = makeStore(recordFor());
    const result = await loadHoidConversationHistory(store.port, key, scopeB);
    expect(result.status).toBe("stale");
    if (result.status !== "stale") return;
    expect(result.messages.map(message => message.id)).toEqual([
      HOID_STATIC_GREETING_ID, "user-1",
    ]);
    expect(result.droppedAssistantCount).toBe(1);
    expect(result.requiresRewrite).toBe(true);
    expect(store.writes).toBe(0);
  });

  it("does not write when a snapshot belongs to a different live progress scope", async () => {
    const store = makeStore();
    const result = await saveHoidConversationHistory(
      store.port, key, null, snapshot(), scopeB,
    );
    expect(result).toEqual({ status: "stale-progress" });
    expect(store.writes).toBe(0);
  });

  it("rejects malformed snapshots without invoking compare-and-swap", async () => {
    const store = makeStore();
    const result = await saveHoidConversationHistory(
      store.port, key, null, { schemaVersion: 1 }, scopeA,
    );
    expect(result).toEqual({ status: "invalid-snapshot" });
    expect(store.writes).toBe(0);
  });

  it("uses compare-and-swap revisions to prevent lost updates", async () => {
    const store = makeStore(recordFor(key, scopeA, [userMessage()], 4));
    const result = await saveHoidConversationHistory(
      store.port, key, 3, snapshot([userMessage("new-user")]), scopeA,
    );
    expect(result).toEqual({ status: "conflict" });
    expect(store.writes).toBe(0);
  });

  it("increments the storage revision after a successful replacement", async () => {
    const store = makeStore(recordFor(key, scopeA, [userMessage()], 4));
    const result = await saveHoidConversationHistory(
      store.port, key, 4, snapshot([userMessage("new-user")]), scopeA,
    );
    expect(result).toEqual({ status: "saved", storageRevision: 5 });
  });

  it("returns not-found only when the adapter returns null", async () => {
    const store = makeStore(null);
    expect(await loadHoidConversationHistory(store.port, key, scopeA))
      .toEqual({ status: "not-found" });
  });

  it("rejects records belonging to another principal", async () => {
    const otherKey = Object.freeze({ principalId: "profile-other", conversationId: key.conversationId });
    const store = makeStore(recordFor(otherKey));
    expect(await loadHoidConversationHistory(store.port, key, scopeA))
      .toEqual({ status: "invalid-record" });
  });

  it("rejects records belonging to another conversation", async () => {
    const otherKey = Object.freeze({ principalId: key.principalId, conversationId: "conversation-other" });
    const store = makeStore(recordFor(otherKey));
    expect(await loadHoidConversationHistory(store.port, key, scopeA))
      .toEqual({ status: "invalid-record" });
  });

  it("rejects unknown storage schema versions", async () => {
    const store = makeStore({ ...recordFor(), schemaVersion: 2 });
    expect(await loadHoidConversationHistory(store.port, key, scopeA))
      .toEqual({ status: "invalid-record" });
  });

  it("rejects malformed storage revisions", async () => {
    const store = makeStore({ ...recordFor(), storageRevision: 0 });
    expect(await loadHoidConversationHistory(store.port, key, scopeA))
      .toEqual({ status: "invalid-record" });
  });

  it("rejects storage records with unexpected fields", async () => {
    const store = makeStore({ ...recordFor(), providerPayload: "must not persist" });
    expect(await loadHoidConversationHistory(store.port, key, scopeA))
      .toEqual({ status: "invalid-record" });
  });

  it("rejects an invalid opaque key and does not call the adapter", async () => {
    const store = makeStore();
    const invalidKey = { principalId: "reader@example.com", conversationId: "conversation-01" };
    expect(await loadHoidConversationHistory(store.port, invalidKey, scopeA))
      .toEqual({ status: "invalid-input", reason: "invalid-key" });
    expect(store.reads).toBe(0);
  });

  it("rejects accessor-backed keys without invoking getters", async () => {
    let invoked = false;
    const hostileKey = Object.defineProperties({}, {
      principalId: { enumerable: true, get: () => { invoked = true; return "profile-1"; } },
      conversationId: { enumerable: true, value: "conversation-1" },
    });
    const store = makeStore();
    expect(await loadHoidConversationHistory(store.port, hostileKey, scopeA))
      .toEqual({ status: "invalid-input", reason: "invalid-key" });
    expect(invoked).toBe(false);
  });

  it("rejects accessor-backed store methods without invoking getters", async () => {
    let invoked = false;
    const hostileStore = Object.defineProperties({}, {
      read: { enumerable: true, get: () => { invoked = true; return async () => null; } },
      compareAndSwap: { enumerable: true, value: async () => "saved" },
    });
    expect(await loadHoidConversationHistory(hostileStore, key, scopeA))
      .toEqual({ status: "invalid-input", reason: "invalid-store" });
    expect(invoked).toBe(false);
  });

  it("fails closed when the adapter throws", async () => {
    const failing = Object.freeze({
      read: async () => { throw new Error("storage unavailable"); },
      compareAndSwap: async () => { throw new Error("storage unavailable"); },
    });
    expect(await loadHoidConversationHistory(failing, key, scopeA))
      .toEqual({ status: "unavailable" });
    expect(await saveHoidConversationHistory(failing, key, null, snapshot(), scopeA))
      .toEqual({ status: "unavailable" });
  });

  it("does not accept unknown compare-and-swap outcomes", async () => {
    const invalidOutcome = Object.freeze({
      read: async () => null,
      compareAndSwap: async () => "maybe",
    });
    expect(await saveHoidConversationHistory(
      invalidOutcome, key, null, snapshot(), scopeA,
    )).toEqual({ status: "unavailable" });
  });

  it("rejects invalid expected storage revisions", async () => {
    const store = makeStore();
    expect(await saveHoidConversationHistory(
      store.port, key, 0, snapshot(), scopeA,
    )).toEqual({ status: "invalid-input", reason: "invalid-storage-revision" });
    expect(await saveHoidConversationHistory(
      store.port, key, Number.MAX_SAFE_INTEGER - 1, snapshot(), scopeA,
    )).toEqual({ status: "invalid-input", reason: "invalid-storage-revision" });
    expect(store.writes).toBe(0);
  });

  it("does not mutate the stored record when loading", async () => {
    const initial = recordFor();
    const store = makeStore(initial);
    await loadHoidConversationHistory(store.port, key, scopeB);
    expect(store.current).toBe(initial);
    expect(store.writes).toBe(0);
  });
});
