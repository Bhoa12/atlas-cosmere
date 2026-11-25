import { describe, expect, it } from "vitest";
import {
  createHoidConversationHistorySnapshot,
  hydrateHoidConversationHistorySnapshot,
} from "./conversationHistoryHydration";
import {
  HOID_STATIC_GREETING_ID,
  HOID_STATIC_GREETING_KIND,
  HOID_STATIC_GREETING_TEXT,
} from "./conversationHistoryPolicy";
import {
  createHoidConversationHistorySnapshotCodec,
} from "./conversationHistorySnapshotCodec";
import {
  createHoidHistoryMigrationRuntime,
} from "./conversationHistoryMigrationRuntime";
import {
  HOID_HISTORY_AUTHORITY_JOURNAL_KIND,
  HOID_HISTORY_AUTHORITY_JOURNAL_SCHEMA_VERSION,
  type HoidHistoryAuthorityJournalRecord,
  type HoidHistoryAuthorityJournalStorePort,
  type HoidHistoryBackendKind,
  type HoidHistoryFencingParticipantPort,
} from "./conversationHistoryAuthorityJournal";
import type { HoidHistoryMigrationSnapshotPort } from "./conversationHistoryMigrationSnapshotPort";

const PARTITION = "profile-local-01:conversation-01";
const SCOPE = Object.freeze({ revision: 41, fingerprint: "c".repeat(64) });
const OPERATION = "migration-run-308";

function makeSnapshot(answer = "Respuesta vinculada al capítulo actual") {
  const result = createHoidConversationHistorySnapshot([
    {
      id: HOID_STATIC_GREETING_ID,
      emisor: "hoid",
      kind: HOID_STATIC_GREETING_KIND,
      texto: HOID_STATIC_GREETING_TEXT,
    },
    { id: "user-1", emisor: "usuario", texto: "¿Qué significa esta escena?" },
    {
      id: "answer-1",
      emisor: "hoid",
      texto: answer,
      progressScope: SCOPE,
    },
  ], SCOPE);
  if (result.status !== "ready") throw new Error("Snapshot fixture is invalid");
  return result.snapshot;
}

function makeJournalStore() {
  let record: HoidHistoryAuthorityJournalRecord | null = null;
  const port: HoidHistoryAuthorityJournalStorePort = Object.freeze({
    durability: "rollback-resistant-monotonic-cas-v1",
    read: async (partitionId: string) => partitionId === PARTITION ? record : null,
    compareAndSwap: async (
      partitionId: string,
      expectedRevision: number | null,
      next: HoidHistoryAuthorityJournalRecord,
    ): Promise<"saved" | "conflict"> => {
      if (partitionId !== PARTITION) return "conflict";
      const currentRevision = record?.journalRevision ?? null;
      if (currentRevision !== expectedRevision) return "conflict";
      record = next;
      return "saved";
    },
  });
  return Object.freeze({
    port,
    inspect: () => record,
  });
}

type BackendFixture = Readonly<{
  participant: HoidHistoryFencingParticipantPort;
  migration: HoidHistoryMigrationSnapshotPort;
  inspect: () => Readonly<{
    generation: number;
    state: "active" | "inactive" | "fenced";
    operationId: string | null;
    revision: number;
    snapshot: unknown | null;
    writes: number;
    clears: number;
  }>;
  failNextRead: () => void;
  failAfterNextWrite: () => void;
}>;

function makeBackend(
  kind: HoidHistoryBackendKind,
  role: "source" | "target",
  initialSnapshot: unknown | null = null,
  initialRevision = initialSnapshot === null ? 0 : 1,
): BackendFixture {
  let generation = 0;
  let state: "active" | "inactive" | "fenced" = role === "source" ? "active" : "inactive";
  let operationId: string | null = null;
  let revision = initialRevision;
  let current = initialSnapshot;
  let writes = 0;
  let clears = 0;
  let failRead = false;
  let failAfterWrite = false;

  const participant: HoidHistoryFencingParticipantPort = Object.freeze({
    kind,
    fence: async input => {
      if (
        input.partitionId !== PARTITION ||
        !Number.isSafeInteger(input.expectedGeneration) ||
        input.expectedGeneration !== generation ||
        input.nextGeneration !== generation + 1
      ) return "blocked";
      if (
        state === "fenced" &&
        generation === input.nextGeneration &&
        operationId === input.operationId
      ) return "fenced";
      const expectedState = role === "source" ? "active" : "inactive";
      if (state !== expectedState || operationId !== null) return "conflict";
      generation = input.nextGeneration;
      state = "fenced";
      operationId = input.operationId;
      return "fenced";
    },
    activate: async input => {
      if (
        input.partitionId !== PARTITION ||
        input.generation !== generation ||
        input.operationId !== operationId
      ) return "blocked";
      if (state === "active") return "already-active";
      if (state !== "fenced") return "blocked";
      state = "active";
      return "activated";
    },
  });

  const isFenced = (input: Readonly<{ operationId: string; generation: number }>) =>
    state === "fenced" &&
    input.operationId === operationId &&
    input.generation === generation;

  const migration: HoidHistoryMigrationSnapshotPort = Object.freeze({
    partitionId: PARTITION,
    kind,
    role,
    read: async input => {
      if (!isFenced(input)) return Object.freeze({ status: "blocked", reason: "generation-fenced" });
      if (failRead) {
        failRead = false;
        return Object.freeze({ status: "blocked", reason: "storage-unavailable" });
      }
      return current === null
        ? Object.freeze({ status: "empty", revision })
        : Object.freeze({ status: "ready", revision, snapshot: current });
    },
    replace: async input => {
      if (role !== "target" || !isFenced(input)) {
        return Object.freeze({ status: "blocked", reason: "generation-fenced" });
      }
      if (input.expectedRevision !== revision) {
        return Object.freeze({ status: "conflict", revision });
      }
      revision += 1;
      current = input.snapshot;
      writes += 1;
      if (failAfterWrite) {
        failAfterWrite = false;
        throw new Error("simulated lost acknowledgement after durable write");
      }
      return Object.freeze({ status: "saved", revision });
    },
    clear: async input => {
      if (role !== "target" || !isFenced(input)) {
        return Object.freeze({ status: "blocked", reason: "generation-fenced" });
      }
      if (input.expectedRevision !== revision) {
        return Object.freeze({ status: "conflict", revision });
      }
      if (kind === "sqlite-history-v1" && current !== null) {
        return Object.freeze({ status: "blocked", reason: "sqlite-tombstone-unsupported" });
      }
      if (current !== null) {
        revision += 1;
        current = null;
        clears += 1;
      }
      return Object.freeze({ status: "cleared", revision });
    },
  });

  return Object.freeze({
    participant,
    migration,
    inspect: () => Object.freeze({
      generation, state, operationId, revision, snapshot: current, writes, clears,
    }),
    failNextRead: () => { failRead = true; },
    failAfterNextWrite: () => { failAfterWrite = true; },
  });
}

function makeRuntime(
  sqlite: BackendFixture,
  vault: BackendFixture,
) {
  const journal = makeJournalStore();
  const runtime = createHoidHistoryMigrationRuntime({
    partitionId: PARTITION,
    journalStore: journal.port,
    sqlite: {
      participant: sqlite.participant,
      migration: sqlite.migration,
    },
    vault: {
      participant: vault.participant,
      migration: vault.migration,
    },
    codec: createHoidConversationHistorySnapshotCodec(),
  });
  if (!runtime) throw new Error("Migration runtime fixture could not be created");
  return Object.freeze({ runtime, journal });
}

describe("Hoid history migration runtime integration", () => {
  it("migrates SQLite to Vault through the journal, fences and canonical transfer", async () => {
    const original = makeSnapshot();
    const sqlite = makeBackend("sqlite-history-v1", "source", original, 7);
    const vault = makeBackend("vault-history-v1", "target");
    const { runtime, journal } = makeRuntime(sqlite, vault);

    await expect(runtime.initialize("sqlite-history-v1")).resolves.toMatchObject({
      status: "saved",
    });
    await expect(runtime.start(OPERATION, "vault-history-v1")).resolves.toEqual({
      status: "completed",
      operationId: OPERATION,
      activeBackend: "vault-history-v1",
      generation: 1,
    });

    expect(sqlite.inspect()).toMatchObject({ generation: 1, state: "fenced" });
    expect(vault.inspect()).toMatchObject({
      generation: 1,
      state: "active",
      revision: 1,
      writes: 1,
    });
    expect(vault.inspect().snapshot).toEqual(original);
    expect(journal.inspect()).toMatchObject({
      kind: HOID_HISTORY_AUTHORITY_JOURNAL_KIND,
      schemaVersion: HOID_HISTORY_AUTHORITY_JOURNAL_SCHEMA_VERSION,
      activeBackend: "vault-history-v1",
      generation: 1,
      migration: null,
      lastOperationId: OPERATION,
      lastOutcome: "committed",
    });

    const rehydrated = hydrateHoidConversationHistorySnapshot(
      vault.inspect().snapshot,
      Object.freeze({ revision: 42, fingerprint: "d".repeat(64) }),
    );
    expect(rehydrated.status).toBe("ready");
    if (rehydrated.status === "ready") {
      expect(rehydrated.messages.some(message => message.texto === "Respuesta vinculada al capítulo actual"))
        .toBe(false);
      expect(rehydrated.messages.some(message => message.texto === "¿Qué significa esta escena?"))
        .toBe(true);
    }
  });

  it("supports the reverse Vault to SQLite direction with the same runtime", async () => {
    const original = makeSnapshot("Explicación original del lector");
    const sqlite = makeBackend("sqlite-history-v1", "target");
    const vault = makeBackend("vault-history-v1", "source", original, 4);
    const { runtime, journal } = makeRuntime(sqlite, vault);

    await expect(runtime.initialize("vault-history-v1")).resolves.toMatchObject({
      status: "saved",
    });
    await expect(runtime.start(OPERATION, "sqlite-history-v1")).resolves.toMatchObject({
      status: "completed",
      activeBackend: "sqlite-history-v1",
      generation: 1,
    });
    expect(sqlite.inspect()).toMatchObject({
      generation: 1,
      state: "active",
      revision: 1,
      writes: 1,
    });
    expect(sqlite.inspect().snapshot).toEqual(original);
    expect(journal.inspect()).toMatchObject({
      activeBackend: "sqlite-history-v1",
      lastOutcome: "committed",
    });
  });

  it("resumes idempotently when the target write commits but its acknowledgement is lost", async () => {
    const original = makeSnapshot();
    const sqlite = makeBackend("sqlite-history-v1", "source", original, 3);
    const vault = makeBackend("vault-history-v1", "target");
    vault.failAfterNextWrite();
    const { runtime, journal } = makeRuntime(sqlite, vault);

    await runtime.initialize("sqlite-history-v1");
    await expect(runtime.start(OPERATION, "vault-history-v1")).resolves.toEqual({
      status: "blocked",
      reason: "transfer-failed",
    });
    expect(journal.inspect()?.migration?.phase).toBe("copying");
    expect(vault.inspect().writes).toBe(1);

    await expect(runtime.resume(OPERATION)).resolves.toMatchObject({
      status: "completed",
      activeBackend: "vault-history-v1",
    });
    expect(vault.inspect().writes).toBe(1);
    expect(journal.inspect()).toMatchObject({
      migration: null,
      lastOutcome: "committed",
    });
  });

  it("aborts safely before authority commit and reactivates only the source", async () => {
    const sqlite = makeBackend("sqlite-history-v1", "source", makeSnapshot(), 2);
    const vault = makeBackend("vault-history-v1", "target");
    sqlite.failNextRead();
    const { runtime, journal } = makeRuntime(sqlite, vault);

    await runtime.initialize("sqlite-history-v1");
    await expect(runtime.start(OPERATION, "vault-history-v1")).resolves.toEqual({
      status: "blocked",
      reason: "transfer-failed",
    });
    expect(journal.inspect()?.migration?.phase).toBe("copying");

    await expect(runtime.abort(OPERATION)).resolves.toEqual({
      status: "aborted",
      operationId: OPERATION,
      activeBackend: "sqlite-history-v1",
      generation: 1,
    });
    expect(sqlite.inspect()).toMatchObject({ generation: 1, state: "active" });
    expect(vault.inspect()).toMatchObject({ generation: 1, state: "fenced" });
    expect(journal.inspect()).toMatchObject({
      activeBackend: "sqlite-history-v1",
      migration: null,
      lastOutcome: "aborted",
    });
  });

  it("rejects adapters with the same role and refuses initialization on the wrong backend", async () => {
    const sqlite = makeBackend("sqlite-history-v1", "source");
    const vault = makeBackend("vault-history-v1", "source");
    const journal = makeJournalStore();
    expect(createHoidHistoryMigrationRuntime({
      partitionId: PARTITION,
      journalStore: journal.port,
      sqlite: { participant: sqlite.participant, migration: sqlite.migration },
      vault: { participant: vault.participant, migration: vault.migration },
      codec: createHoidConversationHistorySnapshotCodec(),
    })).toBeNull();

    const targetVault = makeBackend("vault-history-v1", "target");
    const valid = makeRuntime(sqlite, targetVault);
    await expect(valid.runtime.initialize("vault-history-v1")).resolves.toEqual({
      status: "blocked",
      reason: "adapter-role-mismatch",
    });
    expect(valid.journal.inspect()).toBeNull();
  });

  it("rejects a target backend that does not match the bound target capability", async () => {
    const sqlite = makeBackend("sqlite-history-v1", "source");
    const vault = makeBackend("vault-history-v1", "target");
    const { runtime } = makeRuntime(sqlite, vault);
    await runtime.initialize("sqlite-history-v1");
    await expect(runtime.start(OPERATION, "sqlite-history-v1")).resolves.toEqual({
      status: "blocked",
      reason: "adapter-role-mismatch",
    });
  });

  it("returns idle on resume before initialization without touching either backend", async () => {
    const sqlite = makeBackend("sqlite-history-v1", "source");
    const vault = makeBackend("vault-history-v1", "target");
    const { runtime } = makeRuntime(sqlite, vault);
    await expect(runtime.resume(OPERATION)).resolves.toEqual({ status: "idle" });
    expect(sqlite.inspect().state).toBe("active");
    expect(vault.inspect().state).toBe("inactive");
  });
});
