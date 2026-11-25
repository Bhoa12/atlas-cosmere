import { describe, expect, it, vi } from "vitest";
import {
  createHoidHistoryAuthorityJournalCoordinator,
  type HoidHistoryAuthorityJournalRecord,
  type HoidHistoryAuthorityJournalStorePort,
} from "./conversationHistoryAuthorityJournal";

const PARTITION = "profile-local-01:conversation-01";
const DIGEST = "a".repeat(64);

function makeStore() {
  let record: HoidHistoryAuthorityJournalRecord | null = null;
  const read = vi.fn(async (_partitionId: string) => record);
  const compareAndSwap = vi.fn(async (
    partitionId: string,
    expected: number | null,
    next: HoidHistoryAuthorityJournalRecord,
  ): Promise<"saved" | "conflict"> => {
    if (partitionId !== PARTITION) return "conflict";
    const actual = record?.journalRevision ?? null;
    if (actual !== expected) return "conflict";
    record = next;
    return "saved";
  });
  const port: HoidHistoryAuthorityJournalStorePort = Object.freeze({
    durability: "rollback-resistant-monotonic-cas-v1",
    read,
    compareAndSwap,
  });
  return {
    port,
    read,
    compareAndSwap,
    get record() {
      return record;
    },
    setRecord(value: HoidHistoryAuthorityJournalRecord | null) {
      record = value;
    },
  };
}

function makeCoordinator() {
  const store = makeStore();
  const coordinator = createHoidHistoryAuthorityJournalCoordinator(store.port, PARTITION);
  if (!coordinator) throw new Error("Journal coordinator fixture could not be created");
  return { store, coordinator };
}

async function beginCopying(coordinator: ReturnType<typeof makeCoordinator>["coordinator"]) {
  await coordinator.initialize("sqlite-history-v1");
  const started = await coordinator.begin("migration-001", "vault-history-v1");
  expect(started.status).toBe("saved");
  await coordinator.acknowledgeFence("source", 1);
  await coordinator.acknowledgeFence("target", 1);
}

describe("Hoid durable authority journal protocol", () => {
  it("initializes with an atomic create-only journal write", async () => {
    const { store, coordinator } = makeCoordinator();
    await expect(coordinator.initialize("sqlite-history-v1")).resolves.toMatchObject({
      status: "saved",
      record: {
        journalRevision: 0,
        generation: 0,
        activeBackend: "sqlite-history-v1",
        migration: null,
      },
    });
    await expect(coordinator.initialize("sqlite-history-v1")).resolves.toMatchObject({
      status: "already-applied",
    });
    expect(store.compareAndSwap).toHaveBeenCalledTimes(1);
    expect(store.compareAndSwap.mock.calls[0][1]).toBeNull();
  });

  it("increments the fencing generation before any participant acknowledgement", async () => {
    const { coordinator } = makeCoordinator();
    await coordinator.initialize("sqlite-history-v1");
    const started = await coordinator.begin("migration-001", "vault-history-v1");
    expect(started).toMatchObject({
      status: "saved",
      record: {
        generation: 0,
        migration: {
          generation: 1,
          phase: "fencing",
          sourceFenced: false,
          targetFenced: false,
        },
      },
    });
  });

  it("does not enter copying until both source and target are fenced", async () => {
    const { coordinator } = makeCoordinator();
    await coordinator.initialize("sqlite-history-v1");
    await coordinator.begin("migration-001", "vault-history-v1");
    await expect(coordinator.acknowledgeFence("source", 1)).resolves.toMatchObject({
      status: "saved",
      record: { migration: { phase: "fencing", sourceFenced: true, targetFenced: false } },
    });
    await expect(coordinator.acknowledgeFence("target", 1)).resolves.toMatchObject({
      status: "saved",
      record: { migration: { phase: "copying", sourceFenced: true, targetFenced: true } },
    });
  });

  it("rejects stale fence generations and duplicate migration ownership", async () => {
    const { coordinator } = makeCoordinator();
    await coordinator.initialize("sqlite-history-v1");
    await coordinator.begin("migration-001", "vault-history-v1");
    await expect(coordinator.acknowledgeFence("source", 0)).resolves.toEqual({
      status: "blocked",
      reason: "invalid-transition",
    });
    await expect(coordinator.begin("migration-002", "vault-history-v1")).resolves.toEqual({
      status: "blocked",
      reason: "invalid-transition",
    });
  });

  it("accepts revision zero for an empty snapshot and validates SHA-256 digests", async () => {
    const { coordinator } = makeCoordinator();
    await coordinator.initialize("sqlite-history-v1");
    await beginCopying(coordinator);
    await expect(coordinator.recordCopy({
      operationId: "migration-001",
      sourceRevision: -1,
      targetRevision: 1,
      sourceDigest: DIGEST,
      targetDigest: DIGEST,
    })).resolves.toEqual({ status: "blocked", reason: "invalid-input" });
    await expect(coordinator.recordCopy({
      operationId: "migration-001",
      sourceRevision: 7,
      targetRevision: 1,
      sourceDigest: "not-a-digest",
      targetDigest: DIGEST,
    })).resolves.toEqual({ status: "blocked", reason: "invalid-input" });
  });

  it("accepts revision zero for an empty source and target partition", async () => {
    const { coordinator } = makeCoordinator();
    await coordinator.initialize("sqlite-history-v1");
    await beginCopying(coordinator);
    await expect(coordinator.recordCopy({
      operationId: "migration-001",
      sourceRevision: 0,
      targetRevision: 0,
      sourceDigest: DIGEST,
      targetDigest: DIGEST,
    })).resolves.toMatchObject({
      status: "saved",
      record: {
        migration: {
          phase: "copied",
          sourceRevision: 0,
          targetRevision: 0,
        },
      },
    });
  });

  it("refuses to verify a copy whose target digest differs", async () => {
    const { coordinator } = makeCoordinator();
    await coordinator.initialize("sqlite-history-v1");
    await beginCopying(coordinator);
    await coordinator.recordCopy({
      operationId: "migration-001",
      sourceRevision: 7,
      targetRevision: 1,
      sourceDigest: DIGEST,
      targetDigest: "b".repeat(64),
    });
    await expect(coordinator.verifyCopy("migration-001", "b".repeat(64))).resolves.toEqual({
      status: "blocked",
      reason: "snapshot-mismatch",
    });
  });

  it("requires a verified digest match before committing the authority switch", async () => {
    const { coordinator } = makeCoordinator();
    await coordinator.initialize("sqlite-history-v1");
    await beginCopying(coordinator);
    await coordinator.recordCopy({
      operationId: "migration-001",
      sourceRevision: 7,
      targetRevision: 1,
      sourceDigest: DIGEST,
      targetDigest: DIGEST,
    });
    await expect(coordinator.commit("migration-001")).resolves.toEqual({
      status: "blocked",
      reason: "invalid-transition",
    });
    await coordinator.verifyCopy("migration-001", DIGEST);
    await expect(coordinator.commit("migration-001")).resolves.toMatchObject({
      status: "saved",
      record: {
        generation: 1,
        activeBackend: "vault-history-v1",
        migration: { phase: "activating", generation: 1 },
      },
    });
  });

  it("keeps the journal in activating until the target reports activation", async () => {
    const { coordinator } = makeCoordinator();
    await coordinator.initialize("sqlite-history-v1");
    await beginCopying(coordinator);
    await coordinator.recordCopy({
      operationId: "migration-001",
      sourceRevision: 7,
      targetRevision: 1,
      sourceDigest: DIGEST,
      targetDigest: DIGEST,
    });
    await coordinator.verifyCopy("migration-001", DIGEST);
    await coordinator.commit("migration-001");
    await expect(coordinator.read()).resolves.toMatchObject({
      status: "ready",
      record: { activeBackend: "vault-history-v1", migration: { phase: "activating" } },
    });
    await expect(coordinator.completeActivation("migration-001")).resolves.toMatchObject({
      status: "saved",
      record: {
        activeBackend: "vault-history-v1",
        migration: null,
        lastOperationId: "migration-001",
        lastOutcome: "committed",
      },
    });
    await expect(coordinator.completeActivation("migration-001")).resolves.toMatchObject({
      status: "already-applied",
    });
  });

  it("allows abort only after both backends are fenced and never decrements generation", async () => {
    const { coordinator } = makeCoordinator();
    await coordinator.initialize("sqlite-history-v1");
    await beginCopying(coordinator);
    await expect(coordinator.beginAbort("migration-001")).resolves.toMatchObject({
      status: "saved",
      record: {
        generation: 1,
        activeBackend: "sqlite-history-v1",
        migration: { phase: "aborting", generation: 1 },
      },
    });
    await expect(coordinator.completeAbort("migration-001")).resolves.toMatchObject({
      status: "saved",
      record: {
        generation: 1,
        activeBackend: "sqlite-history-v1",
        migration: null,
        lastOutcome: "aborted",
      },
    });
    await expect(coordinator.begin("migration-002", "vault-history-v1")).resolves.toMatchObject({
      status: "saved",
      record: { migration: { generation: 2 } },
    });
  });

  it("does not allow abort while only one participant is fenced", async () => {
    const { coordinator } = makeCoordinator();
    await coordinator.initialize("sqlite-history-v1");
    await coordinator.begin("migration-001", "vault-history-v1");
    await coordinator.acknowledgeFence("source", 1);
    await expect(coordinator.beginAbort("migration-001")).resolves.toEqual({
      status: "blocked",
      reason: "invalid-transition",
    });
  });

  it("returns conflict instead of retrying a stale cross-runtime journal write", async () => {
    const { store, coordinator } = makeCoordinator();
    await coordinator.initialize("sqlite-history-v1");
    store.compareAndSwap.mockImplementationOnce(async () => "conflict");
    await expect(coordinator.begin("migration-001", "vault-history-v1")).resolves.toEqual({
      status: "conflict",
    });
  });

  it("blocks malformed persisted journals and does not invoke accessors", async () => {
    const { store, coordinator } = makeCoordinator();
    let invoked = false;
    const hostile = Object.defineProperties({}, {
      schemaVersion: { enumerable: true, value: 1 },
      kind: { enumerable: true, value: "hoid-history-authority-journal" },
      partitionId: { enumerable: true, value: PARTITION },
      journalRevision: { enumerable: true, value: 0 },
      generation: { enumerable: true, value: 0 },
      activeBackend: { enumerable: true, value: "sqlite-history-v1" },
      migration: { enumerable: true, get: () => { invoked = true; return null; } },
      lastOperationId: { enumerable: true, value: null },
      lastOutcome: { enumerable: true, value: null },
    });
    store.setRecord(hostile as unknown as HoidHistoryAuthorityJournalRecord);
    await expect(coordinator.read()).resolves.toEqual({
      status: "blocked",
      reason: "invalid-journal",
    });
    expect(invoked).toBe(false);
  });

  it("rejects a store without the rollback-resistant monotonic CAS declaration", () => {
    const invalid = {
      durability: "ordinary-database-cas",
      read: async () => null,
      compareAndSwap: async () => "saved",
    };
    expect(createHoidHistoryAuthorityJournalCoordinator(invalid, PARTITION)).toBeNull();
  });

  it("serializes local operations and preserves monotonic journal revisions", async () => {
    const { store, coordinator } = makeCoordinator();
    await coordinator.initialize("sqlite-history-v1");
    const first = coordinator.begin("migration-001", "vault-history-v1");
    const second = coordinator.read();
    const [write, read] = await Promise.all([first, second]);
    expect(write.status).toBe("saved");
    expect(read).toMatchObject({
      status: "ready",
      record: { journalRevision: 1, migration: { phase: "fencing" } },
    });
    expect(store.record?.journalRevision).toBe(1);
  });
});
