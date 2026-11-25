import { describe, expect, it } from "vitest";
import {
  createHoidConversationHistorySnapshot,
} from "./conversationHistoryHydration";
import {
  HOID_STATIC_GREETING_ID,
  HOID_STATIC_GREETING_KIND,
  HOID_STATIC_GREETING_TEXT,
} from "./conversationHistoryPolicy";
import { createHoidConversationHistorySnapshotCodec } from "./conversationHistorySnapshotCodec";
import {
  createHoidHistoryMigrationSnapshotTransferAdapter,
  getHoidEmptyHistoryMigrationDigest,
} from "./conversationHistoryMigrationTransferAdapter";
import type { HoidHistoryBackendKind } from "./conversationHistoryAuthorityJournal";
import type { HoidHistoryMigrationSnapshotPort } from "./conversationHistoryMigrationSnapshotPort";

const PARTITION = "profile-local-01:conversation-01";
const OPERATION = "migration-run-307";
const GENERATION = 1;
const SCOPE = Object.freeze({ revision: 41, fingerprint: "c".repeat(64) });

function snapshot(text = "Respuesta ligada al progreso") {
  const created = createHoidConversationHistorySnapshot([
    {
      id: HOID_STATIC_GREETING_ID,
      emisor: "hoid" as const,
      kind: HOID_STATIC_GREETING_KIND,
      texto: HOID_STATIC_GREETING_TEXT,
    },
    { id: "user-1", emisor: "usuario" as const, texto: "Pregunta" },
    {
      id: "answer-1",
      emisor: "hoid" as const,
      texto: text,
      progressScope: SCOPE,
    },
  ], SCOPE);
  if (created.status !== "ready") throw new Error("Invalid fixture snapshot");
  return created.snapshot;
}

function makeBackend(
  kind: HoidHistoryBackendKind,
  initial: Readonly<{ revision: number; snapshot: unknown | null }> = {
    revision: 0,
    snapshot: null,
  },
  role: "source" | "target" = kind === "sqlite-history-v1" ? "source" : "target",
) {
  let revision = initial.revision;
  let current = initial.snapshot;
  let writes = 0;
  let clears = 0;
  let reads = 0;

  const port: HoidHistoryMigrationSnapshotPort = Object.freeze({
    partitionId: PARTITION,
    kind,
    role,
    read: async input => {
      if (input.operationId !== OPERATION || input.generation !== GENERATION) {
        return Object.freeze({ status: "blocked", reason: "wrong-generation" });
      }
      reads += 1;
      return current === null
        ? Object.freeze({ status: "empty", revision })
        : Object.freeze({ status: "ready", revision, snapshot: current });
    },
    replace: async input => {
      if (input.operationId !== OPERATION || input.generation !== GENERATION) {
        return Object.freeze({ status: "blocked", reason: "wrong-generation" });
      }
      if (input.expectedRevision !== revision) {
        return Object.freeze({ status: "conflict", revision });
      }
      revision += 1;
      current = input.snapshot;
      writes += 1;
      return Object.freeze({ status: "saved", revision });
    },
    clear: async input => {
      if (input.operationId !== OPERATION || input.generation !== GENERATION) {
        return Object.freeze({ status: "blocked", reason: "wrong-generation" });
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
    port,
    inspect: () => Object.freeze({ revision, snapshot: current, writes, clears, reads }),
    replaceOutOfBand: (next: unknown) => { current = next; revision += 1; },
  });
}

function makeTransfer(sqlite: HoidHistoryMigrationSnapshotPort, vault: HoidHistoryMigrationSnapshotPort) {
  const transfer = createHoidHistoryMigrationSnapshotTransferAdapter({
    partitionId: PARTITION,
    sqlite,
    vault,
    codec: createHoidConversationHistorySnapshotCodec(),
  });
  if (!transfer) throw new Error("Transfer adapter did not initialize");
  return transfer;
}

function copyInput(
  sourceBackend: HoidHistoryBackendKind,
  targetBackend: HoidHistoryBackendKind,
) {
  return Object.freeze({
    partitionId: PARTITION,
    operationId: OPERATION,
    generation: GENERATION,
    sourceBackend,
    targetBackend,
  });
}

describe("Hoid fenced canonical history migration transfer", () => {
  it("copies SQLite to Vault and independently verifies the target", async () => {
    const original = snapshot();
    const sqlite = makeBackend("sqlite-history-v1", { revision: 7, snapshot: original });
    const vault = makeBackend("vault-history-v1");
    const transfer = makeTransfer(sqlite.port, vault.port);

    const copied = await transfer.copy(copyInput("sqlite-history-v1", "vault-history-v1"));
    expect(copied).toMatchObject({
      schemaVersion: 1,
      sourceRevision: 7,
      targetRevision: 1,
    });
    expect(vault.inspect().snapshot).toEqual(original);
    expect(vault.inspect().writes).toBe(1);

    const verified = await transfer.verify({
      ...copyInput("sqlite-history-v1", "vault-history-v1"),
      sourceRevision: 7,
      targetRevision: 1,
      sourceDigest: (copied as { sourceDigest: string }).sourceDigest,
      targetDigest: (copied as { targetDigest: string }).targetDigest,
    });
    expect(verified).toMatchObject({ targetRevision: 1 });
    expect(sqlite.inspect().reads).toBeGreaterThanOrEqual(2);
    expect(vault.inspect().reads).toBeGreaterThanOrEqual(3);
  });

  it("supports the reverse Vault to SQLite direction", async () => {
    const original = snapshot("Explicación original");
    const sqlite = makeBackend("sqlite-history-v1", { revision: 0, snapshot: null }, "target");
    const vault = makeBackend("vault-history-v1", { revision: 4, snapshot: original }, "source");
    const transfer = makeTransfer(sqlite.port, vault.port);

    const copied = await transfer.copy(copyInput("vault-history-v1", "sqlite-history-v1"));
    expect(copied).toMatchObject({ sourceRevision: 4, targetRevision: 1 });
    expect(sqlite.inspect().snapshot).toEqual(original);
  });

  it("is idempotent when the target write succeeded but the journal acknowledgement was interrupted", async () => {
    const original = snapshot();
    const sqlite = makeBackend("sqlite-history-v1", { revision: 2, snapshot: original });
    const vault = makeBackend("vault-history-v1");
    const transfer = makeTransfer(sqlite.port, vault.port);
    const input = copyInput("sqlite-history-v1", "vault-history-v1");

    const first = await transfer.copy(input);
    const second = await transfer.copy(input);
    expect(second).toEqual(first);
    expect(vault.inspect().writes).toBe(1);
  });

  it("preserves an empty source without inventing a synthetic progress scope", async () => {
    const sqlite = makeBackend("sqlite-history-v1");
    const vault = makeBackend("vault-history-v1");
    const transfer = makeTransfer(sqlite.port, vault.port);

    const copied = await transfer.copy(copyInput("sqlite-history-v1", "vault-history-v1"));
    expect(copied).toMatchObject({
      sourceRevision: 0,
      targetRevision: 0,
      sourceDigest: getHoidEmptyHistoryMigrationDigest(),
      targetDigest: getHoidEmptyHistoryMigrationDigest(),
    });
    expect(vault.inspect().writes).toBe(0);
  });

  it("clears a previous Vault snapshot when the source is empty", async () => {
    const sqlite = makeBackend("sqlite-history-v1");
    const vault = makeBackend("vault-history-v1", { revision: 3, snapshot: snapshot() });
    const transfer = makeTransfer(sqlite.port, vault.port);

    const copied = await transfer.copy(copyInput("sqlite-history-v1", "vault-history-v1"));
    expect(copied).toMatchObject({ sourceRevision: 0, targetRevision: 4 });
    expect(vault.inspect()).toMatchObject({ snapshot: null, clears: 1 });
  });

  it("fails closed instead of pretending SQLite v1 can tombstone a non-empty target", async () => {
    const sqliteTarget = makeBackend("sqlite-history-v1", { revision: 2, snapshot: snapshot() }, "target");
    const vaultSource = makeBackend("vault-history-v1", { revision: 0, snapshot: null }, "source");
    const transfer = makeTransfer(sqliteTarget.port, vaultSource.port);

    await expect(transfer.copy(copyInput("vault-history-v1", "sqlite-history-v1"))).rejects.toThrow();
    expect(sqliteTarget.inspect().snapshot).not.toBeNull();
    expect(sqliteTarget.inspect().writes).toBe(0);
  });

  it("detects target mutation between copy and verification", async () => {
    const sqlite = makeBackend("sqlite-history-v1", { revision: 1, snapshot: snapshot() });
    const vault = makeBackend("vault-history-v1");
    const transfer = makeTransfer(sqlite.port, vault.port);
    const copied = await transfer.copy(copyInput("sqlite-history-v1", "vault-history-v1"));
    vault.replaceOutOfBand(snapshot("Mutación inesperada"));

    await expect(transfer.verify({
      ...copyInput("sqlite-history-v1", "vault-history-v1"),
      sourceRevision: 1,
      targetRevision: (copied as { targetRevision: number }).targetRevision,
      sourceDigest: (copied as { sourceDigest: string }).sourceDigest,
      targetDigest: (copied as { targetDigest: string }).targetDigest,
    })).rejects.toThrow();
  });

  it("rejects malformed progress-scoped snapshots", async () => {
    const sqlite = makeBackend("sqlite-history-v1", {
      revision: 1,
      snapshot: {
        schemaVersion: 1,
        kind: "hoid-conversation-history",
        progressScope: SCOPE,
        messages: [{ id: "unscoped-answer", emisor: "hoid", texto: "No progress scope" }],
      },
    });
    const vault = makeBackend("vault-history-v1");
    const transfer = makeTransfer(sqlite.port, vault.port);

    await expect(transfer.copy(copyInput("sqlite-history-v1", "vault-history-v1"))).rejects.toThrow();
    expect(vault.inspect().writes).toBe(0);
  });

  it("rejects an operation bound to another partition", async () => {
    const sqlite = makeBackend("sqlite-history-v1");
    const vault = makeBackend("vault-history-v1");
    const transfer = makeTransfer(sqlite.port, vault.port);

    await expect(transfer.copy({
      ...copyInput("sqlite-history-v1", "vault-history-v1"),
      partitionId: "another-partition",
    })).rejects.toThrow();
  });

  it("rejects a transfer without exactly one adapter for each backend", () => {
    const sqlite = makeBackend("sqlite-history-v1");
    expect(createHoidHistoryMigrationSnapshotTransferAdapter({
      partitionId: PARTITION,
      sqlite: sqlite.port,
      vault: sqlite.port,
      codec: createHoidConversationHistorySnapshotCodec(),
    })).toBeNull();
  });

  it("rejects capabilities bound to a different partition", () => {
    const sqlite = makeBackend("sqlite-history-v1");
    const vault = makeBackend("vault-history-v1");
    const wrongPartition = Object.freeze({
      ...vault.port,
      partitionId: "another-partition",
    });
    expect(createHoidHistoryMigrationSnapshotTransferAdapter({
      partitionId: PARTITION,
      sqlite: sqlite.port,
      vault: wrongPartition,
      codec: createHoidConversationHistorySnapshotCodec(),
    })).toBeNull();
  });

  it("rejects a capability whose role does not match the requested direction", async () => {
    const sqlite = makeBackend("sqlite-history-v1", { revision: 0, snapshot: null }, "target");
    const vault = makeBackend("vault-history-v1", { revision: 0, snapshot: null }, "target");
    const transfer = makeTransfer(sqlite.port, vault.port);
    await expect(transfer.copy(copyInput("sqlite-history-v1", "vault-history-v1"))).rejects.toThrow();
  });

});
