import { describe, expect, it, vi } from "vitest";
import {
  createHoidConversationHistoryAuthority,
  createHoidSqliteConversationHistoryAuthorityBackend,
  createHoidVaultConversationHistoryAuthorityBackend,
  type HoidConversationHistoryAuthorityBackendPort,
} from "./conversationHistoryAuthority";
import {
  HOID_STATIC_GREETING_ID,
  HOID_STATIC_GREETING_KIND,
  HOID_STATIC_GREETING_TEXT,
} from "./conversationHistoryPolicy";
import type {
  HoidConversationHistoryStorePort,
  HoidConversationStorageKey,
  HoidConversationStorageRecord,
} from "./conversationHistoryStorePort";
import type { HoidConversationVaultHistoryBridge } from "./conversationVaultHistoryBridge";

const scopeA = Object.freeze({ revision: 31, fingerprint: "a".repeat(64) });
const scopeB = Object.freeze({ revision: 32, fingerprint: "b".repeat(64) });
const key = Object.freeze({
  principalId: "profile-local-01",
  conversationId: "conversation-01",
});
const authorityId = "profile-local-01:conversation-01";

function messages() {
  return Object.freeze([
    Object.freeze({
      id: HOID_STATIC_GREETING_ID,
      emisor: "hoid" as const,
      kind: HOID_STATIC_GREETING_KIND,
      texto: HOID_STATIC_GREETING_TEXT,
    }),
    Object.freeze({
      id: "user-1",
      emisor: "usuario" as const,
      texto: "¿Qué ha ocurrido en este capítulo?",
    }),
    Object.freeze({
      id: "answer-1",
      emisor: "hoid" as const,
      texto: "Explicación autorizada para el progreso actual",
      progressScope: scopeA,
    }),
  ]);
}

function makeSqliteStore() {
  let current: HoidConversationStorageRecord | null = null;
  const read = vi.fn(async (_key: HoidConversationStorageKey) => current);
  const compareAndSwap = vi.fn(async (
    _key: HoidConversationStorageKey,
    expected: number | null,
    next: HoidConversationStorageRecord,
  ): Promise<"saved" | "conflict"> => {
    const actual = current?.storageRevision ?? null;
    if (actual !== expected) return "conflict";
    current = next;
    return "saved";
  });
  const port: HoidConversationHistoryStorePort = Object.freeze({ read, compareAndSwap });
  return {
    port,
    read,
    compareAndSwap,
    get current() {
      return current;
    },
  };
}

function makeVaultBridge(overrides: Partial<HoidConversationVaultHistoryBridge> = {}) {
  const bridge: HoidConversationVaultHistoryBridge = Object.freeze({
    restore: async () => Object.freeze({ status: "empty" as const, revision: 0 }),
    save: async (revision: number) =>
      Object.freeze({ status: "saved" as const, revision: revision + 1 }),
    clear: async (revision: number) =>
      Object.freeze({ status: "cleared" as const, revision: revision + 1 }),
    ...overrides,
  });
  return bridge;
}

function makeSqliteBackend(
  store: HoidConversationHistoryStorePort,
  storageKey: HoidConversationStorageKey,
) {
  const backend = createHoidSqliteConversationHistoryAuthorityBackend(store, storageKey);
  if (!backend) throw new Error("SQLite backend fixture could not be created");
  return backend;
}

function makeAuthority(backend: HoidConversationHistoryAuthorityBackendPort, id = authorityId) {
  const authority = createHoidConversationHistoryAuthority({ authorityId: id, backend });
  if (!authority) throw new Error("Authority fixture could not be created");
  return authority;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => {
    resolve = accept;
  });
  return { promise, resolve };
}

describe("Hoid single-writer conversation history authority", () => {
  it("adapts SQLite create-only revision zero to its null CAS revision", async () => {
    const store = makeSqliteStore();
    const backend = makeSqliteBackend(store.port, key);
    const authority = makeAuthority(backend, "sqlite-create-only");

    await expect(authority.save(0, messages(), scopeA)).resolves.toEqual({
      status: "saved",
      revision: 1,
    });
    expect(store.compareAndSwap).toHaveBeenCalledTimes(1);
    expect(store.compareAndSwap.mock.calls[0][1]).toBeNull();
    expect(store.current?.storageRevision).toBe(1);

    authority.dispose();
  });

  it("pins the SQLite partition key when the adapter is created", async () => {
    const store = makeSqliteStore();
    const mutableKey: { principalId: string; conversationId: string } = {
      principalId: key.principalId,
      conversationId: key.conversationId,
    };
    const backend = createHoidSqliteConversationHistoryAuthorityBackend(store.port, mutableKey);
    if (!backend) throw new Error("SQLite backend fixture could not be created");
    mutableKey.conversationId = "conversation-02";
    const authority = makeAuthority(backend, "sqlite-pinned-partition");

    await authority.save(0, messages(), scopeA);
    expect(store.compareAndSwap.mock.calls[0][0]).toEqual(key);
    authority.dispose();
  });

  it("restores SQLite history through the selected backend and filters stale assistant prose", async () => {
    const store = makeSqliteStore();
    const backend = makeSqliteBackend(store.port, key);
    const authority = makeAuthority(backend, "sqlite-stale-progress");

    await authority.save(0, messages(), scopeA);
    await expect(authority.restore(scopeA)).resolves.toMatchObject({
      status: "ready",
      revision: 1,
    });
    const stale = await authority.restore(scopeB);
    expect(stale.status).toBe("stale");
    if (stale.status === "stale") {
      expect(stale.messages.map(message => message.id)).toEqual([
        HOID_STATIC_GREETING_ID,
        "user-1",
      ]);
      expect(stale.droppedAssistantCount).toBe(1);
    }

    expect(store.read).toHaveBeenCalledTimes(2);
    authority.dispose();
  });

  it("does not simulate SQLite deletion when its schema has no tombstone", async () => {
    const store = makeSqliteStore();
    const authority = makeAuthority(
      makeSqliteBackend(store.port, key),
      "sqlite-clear-unsupported",
    );

    await expect(authority.clear(0)).resolves.toEqual({
      status: "unsupported",
      reason: "backend-does-not-support-tombstone",
    });
    expect(store.compareAndSwap).not.toHaveBeenCalled();
    authority.dispose();
  });

  it("adapts only the supplied vault bridge and never falls back to SQLite", async () => {
    const bridge = makeVaultBridge({
      restore: vi.fn(async () => Object.freeze({ status: "empty" as const, revision: 0 })),
    });
    const backend = createHoidVaultConversationHistoryAuthorityBackend(bridge);
    expect(backend?.kind).toBe("vault-history-v1");
    if (!backend) return;
    const authority = makeAuthority(backend, "vault-only-partition");

    await expect(authority.restore(scopeA)).resolves.toEqual({
      status: "empty",
      revision: 0,
    });
    expect(bridge.restore).toHaveBeenCalledTimes(1);
    authority.dispose();
  });

  it("rejects a composition that attempts to supply a second backend", () => {
    const store = makeSqliteStore();
    const backend = makeSqliteBackend(store.port, key);
    expect(createHoidConversationHistoryAuthority({
      authorityId,
      backend,
      vaultBackend: makeVaultBridge(),
    })).toBeNull();
    expect(createHoidConversationHistoryAuthority({
      authorityId,
      backend: {
        kind: "sqlite-history-v1",
        restore: async () => ({ status: "not-found" }),
        save: async () => ({ status: "saved", storageRevision: 1 }),
        clear: async () => ({ status: "unsupported" }),
      },
    })).toBeNull();
  });

  it("rejects accessor-backed bridge methods without invoking getters", () => {
    let invoked = false;
    const hostile = Object.defineProperties({}, {
      restore: { enumerable: true, get: () => { invoked = true; return async () => ({ status: "empty", revision: 0 }); } },
      save: { enumerable: true, value: async () => ({ status: "conflict" }) },
      clear: { enumerable: true, value: async () => ({ status: "conflict" }) },
    });
    expect(createHoidVaultConversationHistoryAuthorityBackend(hostile)).toBeNull();
    expect(invoked).toBe(false);
  });

  it("allows only one live authority for an opaque partition in this runtime", async () => {
    const backend = makeSqliteBackend(makeSqliteStore().port, key);
    const first = makeAuthority(backend, "exclusive-partition");
    expect(createHoidConversationHistoryAuthority({
      authorityId: "exclusive-partition",
      backend,
    })).toBeNull();

    first.dispose();
    await Promise.resolve();
    await Promise.resolve();

    const second = createHoidConversationHistoryAuthority({
      authorityId: "exclusive-partition",
      backend,
    });
    expect(second).not.toBeNull();
    second?.dispose();
  });

  it("serializes overlapping writes through the selected backend", async () => {
    const firstWrite = deferred<Awaited<ReturnType<HoidConversationVaultHistoryBridge["save"]>>>();
    const calls: number[] = [];
    const bridge = makeVaultBridge({
      save: (revision: number) => {
        calls.push(revision);
        return calls.length === 1
          ? firstWrite.promise
          : Promise.resolve(Object.freeze({ status: "conflict" as const, revision: 1 }));
      },
    });
    const backend = createHoidVaultConversationHistoryAuthorityBackend(bridge);
    if (!backend) throw new Error("Vault backend fixture could not be created");
    const authority = makeAuthority(backend, "serialized-partition");

    const first = authority.save(0, messages(), scopeA);
    await Promise.resolve();
    const second = authority.save(0, messages(), scopeA);
    await Promise.resolve();

    expect(calls).toEqual([0]);
    firstWrite.resolve(Object.freeze({ status: "saved", revision: 1 }));
    await expect(first).resolves.toEqual({ status: "saved", revision: 1 });
    await expect(second).resolves.toEqual({ status: "conflict" });
    expect(calls).toEqual([0, 0]);

    authority.dispose();
  });

  it("maps a selected backend exception to blocked and performs no fallback", async () => {
    const restore = vi.fn(async () => {
      throw new Error("vault unavailable");
    });
    const backend = createHoidVaultConversationHistoryAuthorityBackend(makeVaultBridge({ restore }));
    if (!backend) throw new Error("Vault backend fixture could not be created");
    const authority = makeAuthority(backend, "failing-vault-partition");

    await expect(authority.restore(scopeA)).resolves.toEqual({
      status: "blocked",
      reason: "backend-failed",
    });
    expect(restore).toHaveBeenCalledTimes(1);
    authority.dispose();
  });

  it("rejects unsafe revisions before invoking the backend", async () => {
    const save = vi.fn(async (revision: number) =>
      Object.freeze({ status: "saved" as const, revision: revision + 1 }));
    const backend = createHoidVaultConversationHistoryAuthorityBackend(makeVaultBridge({ save }));
    if (!backend) throw new Error("Vault backend fixture could not be created");
    const authority = makeAuthority(backend, "revision-validation-partition");

    await expect(authority.save(Number.MAX_SAFE_INTEGER, messages(), scopeA)).resolves.toEqual({
      status: "invalid-input",
      reason: "invalid-revision",
    });
    await expect(authority.clear(-1)).resolves.toEqual({
      status: "invalid-input",
      reason: "invalid-revision",
    });
    expect(save).not.toHaveBeenCalled();
    authority.dispose();
  });

  it("drops a late result and skips queued work after disposal", async () => {
    const pending = deferred<Awaited<ReturnType<HoidConversationVaultHistoryBridge["restore"]>>>();
    const restore = vi.fn(() => pending.promise);
    const save = vi.fn(async (revision: number) =>
      Object.freeze({ status: "saved" as const, revision: revision + 1 }));
    const backend = createHoidVaultConversationHistoryAuthorityBackend(
      makeVaultBridge({ restore, save }),
    );
    if (!backend) throw new Error("Vault backend fixture could not be created");
    const authority = makeAuthority(backend, "disposed-partition");

    const first = authority.restore(scopeA);
    await Promise.resolve();
    const queued = authority.save(0, messages(), scopeA);
    authority.dispose();
    pending.resolve(Object.freeze({ status: "empty", revision: 0 }));

    await expect(first).resolves.toEqual({
      status: "blocked",
      reason: "authority-disposed",
    });
    await expect(queued).resolves.toEqual({
      status: "blocked",
      reason: "authority-disposed",
    });
    expect(restore).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects malformed and personally identifying authority identifiers", () => {
    const backend = makeSqliteBackend(makeSqliteStore().port, key);
    expect(createHoidConversationHistoryAuthority({ authorityId: "", backend })).toBeNull();
    expect(createHoidConversationHistoryAuthority({ authorityId: "name@example.com", backend })).toBeNull();
    expect(createHoidConversationHistoryAuthority({ authorityId: "../conversation", backend })).toBeNull();
  });
});
