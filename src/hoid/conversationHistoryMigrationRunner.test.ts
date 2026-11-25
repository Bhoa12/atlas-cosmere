import { describe, expect, it, vi } from "vitest";
import {
  createHoidHistoryAuthorityJournalCoordinator,
  type HoidHistoryAuthorityJournalRecord,
  type HoidHistoryAuthorityJournalStorePort,
  type HoidHistoryFencingParticipantPort,
} from "./conversationHistoryAuthorityJournal";
import {
  createHoidHistoryMigrationRunner,
  type HoidHistoryMigrationTransferPort,
} from "./conversationHistoryMigrationRunner";

const PARTITION = "profile-local-01:conversation-01";
const OPERATION = "migration-303-001";
const DIGEST = "a".repeat(64);
const OTHER_DIGEST = "b".repeat(64);

function makeJournalStore() {
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
  };
}

function makeParticipants() {
  let sourceGeneration = 0;
  let targetGeneration = 0;
  let sourceActive = true;
  let targetActive = false;
  let sourceFenced = false;
  let targetFenced = false;

  const source = Object.freeze({
    kind: "sqlite-history-v1",
    fence: vi.fn(async (input: Readonly<{
      partitionId: string;
      expectedGeneration: number;
      nextGeneration: number;
      operationId: string;
    }>) => {
      if (input.partitionId !== PARTITION || input.operationId !== OPERATION) return "blocked" as const;
      if (sourceFenced && sourceGeneration === input.nextGeneration) return "fenced" as const;
      if (sourceGeneration !== input.expectedGeneration || input.nextGeneration !== input.expectedGeneration + 1) {
        return "conflict" as const;
      }
      sourceGeneration = input.nextGeneration;
      sourceFenced = true;
      sourceActive = false;
      return "fenced" as const;
    }),
    activate: vi.fn(async (input: Readonly<{
      partitionId: string;
      generation: number;
      operationId: string;
    }>) => {
      if (input.partitionId !== PARTITION || input.operationId !== OPERATION) return "blocked" as const;
      if (sourceGeneration !== input.generation) return "blocked" as const;
      if (sourceActive && !sourceFenced) return "already-active" as const;
      sourceActive = true;
      sourceFenced = false;
      return "activated" as const;
    }),
  }) satisfies HoidHistoryFencingParticipantPort;

  const target = Object.freeze({
    kind: "vault-history-v1",
    fence: vi.fn(async (input: Readonly<{
      partitionId: string;
      expectedGeneration: number;
      nextGeneration: number;
      operationId: string;
    }>) => {
      if (input.partitionId !== PARTITION || input.operationId !== OPERATION) return "blocked" as const;
      if (targetFenced && targetGeneration === input.nextGeneration) return "fenced" as const;
      if (targetGeneration !== input.expectedGeneration || input.nextGeneration !== input.expectedGeneration + 1) {
        return "conflict" as const;
      }
      targetGeneration = input.nextGeneration;
      targetFenced = true;
      targetActive = false;
      return "fenced" as const;
    }),
    activate: vi.fn(async (input: Readonly<{
      partitionId: string;
      generation: number;
      operationId: string;
    }>) => {
      if (input.partitionId !== PARTITION || input.operationId !== OPERATION) return "blocked" as const;
      if (targetGeneration !== input.generation) return "blocked" as const;
      if (targetActive && !targetFenced) return "already-active" as const;
      targetActive = true;
      targetFenced = false;
      return "activated" as const;
    }),
  }) satisfies HoidHistoryFencingParticipantPort;

  return {
    source,
    target,
    get state() {
      return {
        sourceGeneration,
        targetGeneration,
        sourceActive,
        targetActive,
        sourceFenced,
        targetFenced,
      };
    },
  };
}

function makeTransfer() {
  const copy = vi.fn(async () => ({
    schemaVersion: 1,
    sourceRevision: 7,
    targetRevision: 1,
    sourceDigest: DIGEST,
    targetDigest: DIGEST,
  }));
  const verify = vi.fn(async () => ({
    schemaVersion: 1,
    targetRevision: 1,
    targetDigest: DIGEST,
  }));
  const port: HoidHistoryMigrationTransferPort = Object.freeze({ copy, verify });
  return { port, copy, verify };
}

async function makeRunner() {
  const store = makeJournalStore();
  const journal = createHoidHistoryAuthorityJournalCoordinator(store.port, PARTITION);
  if (!journal) throw new Error("Journal fixture could not be created");
  await journal.initialize("sqlite-history-v1");

  const participants = makeParticipants();
  const transfer = makeTransfer();
  const runner = createHoidHistoryMigrationRunner({
    partitionId: PARTITION,
    journal,
    participants: [participants.source, participants.target],
    transfer: transfer.port,
  });
  if (!runner) throw new Error("Migration runner fixture could not be created");
  return { store, journal, participants, transfer, runner };
}

describe("Hoid history migration runner", () => {
  it("fences both participants, copies, verifies, commits and activates the target", async () => {
    const { journal, participants, transfer, runner } = await makeRunner();

    await expect(runner.start(OPERATION, "vault-history-v1")).resolves.toEqual({
      status: "completed",
      operationId: OPERATION,
      activeBackend: "vault-history-v1",
      generation: 1,
    });

    const read = await journal.read();
    expect(read).toMatchObject({
      status: "ready",
      record: {
        activeBackend: "vault-history-v1",
        generation: 1,
        migration: null,
        lastOperationId: OPERATION,
        lastOutcome: "committed",
      },
    });
    expect(participants.state).toEqual({
      sourceGeneration: 1,
      targetGeneration: 1,
      sourceActive: false,
      targetActive: true,
      sourceFenced: true,
      targetFenced: false,
    });
    expect(transfer.copy).toHaveBeenCalledTimes(1);
    expect(transfer.verify).toHaveBeenCalledTimes(1);
    expect(participants.source.fence.mock.invocationCallOrder[0])
      .toBeLessThan(participants.target.fence.mock.invocationCallOrder[0]);
    expect(participants.target.fence.mock.invocationCallOrder[0])
      .toBeLessThan(transfer.copy.mock.invocationCallOrder[0]);
  });

  it("does not copy until both participants acknowledge fencing", async () => {
    const { journal, participants, transfer, runner } = await makeRunner();
    participants.target.fence.mockImplementationOnce(async () => "blocked");

    await expect(runner.start(OPERATION, "vault-history-v1")).resolves.toEqual({
      status: "blocked",
      reason: "participant-blocked",
    });
    expect(transfer.copy).not.toHaveBeenCalled();
    await expect(journal.read()).resolves.toMatchObject({
      status: "ready",
      record: {
        migration: {
          phase: "fencing",
          sourceFenced: true,
          targetFenced: false,
        },
      },
    });
  });

  it("resumes a partial fencing phase without fencing the source twice", async () => {
    const { participants, transfer, runner } = await makeRunner();
    participants.target.fence.mockImplementationOnce(async () => "blocked");

    await runner.start(OPERATION, "vault-history-v1");
    await expect(runner.resume(OPERATION)).resolves.toMatchObject({ status: "completed" });
    expect(participants.source.fence).toHaveBeenCalledTimes(1);
    expect(participants.target.fence).toHaveBeenCalledTimes(2);
    expect(transfer.copy).toHaveBeenCalledTimes(1);
  });

  it("leaves copying durable after a transfer failure and resumes idempotently", async () => {
    const { journal, transfer, runner } = await makeRunner();
    transfer.copy.mockRejectedValueOnce(new Error("temporary adapter failure"));

    await expect(runner.start(OPERATION, "vault-history-v1")).resolves.toEqual({
      status: "blocked",
      reason: "transfer-failed",
    });
    await expect(journal.read()).resolves.toMatchObject({
      status: "ready",
      record: { migration: { phase: "copying" } },
    });
    await expect(runner.resume(OPERATION)).resolves.toMatchObject({ status: "completed" });
    expect(transfer.copy).toHaveBeenCalledTimes(2);
  });

  it("rejects transfer results with additional properties", async () => {
    const { journal, transfer, runner } = await makeRunner();
    transfer.copy.mockResolvedValueOnce({
      schemaVersion: 1,
      sourceRevision: 7,
      targetRevision: 1,
      sourceDigest: DIGEST,
      targetDigest: DIGEST,
      providerPayload: "must not cross the migration contract",
    });

    await runner.start(OPERATION, "vault-history-v1");
    await expect(journal.read()).resolves.toMatchObject({
      status: "ready",
      record: { migration: { phase: "copying" } },
    });
    expect(transfer.verify).not.toHaveBeenCalled();
  });

  it("records a digest mismatch but never commits the target", async () => {
    const { journal, transfer, runner } = await makeRunner();
    transfer.copy.mockResolvedValueOnce({
      schemaVersion: 1,
      sourceRevision: 7,
      targetRevision: 1,
      sourceDigest: DIGEST,
      targetDigest: OTHER_DIGEST,
    });
    transfer.verify.mockResolvedValueOnce({
      schemaVersion: 1,
      targetRevision: 1,
      targetDigest: OTHER_DIGEST,
    });

    await expect(runner.start(OPERATION, "vault-history-v1")).resolves.toEqual({
      status: "blocked",
      reason: "snapshot-mismatch",
    });
    await expect(journal.read()).resolves.toMatchObject({
      status: "ready",
      record: {
        activeBackend: "sqlite-history-v1",
        migration: { phase: "copied", sourceDigest: DIGEST, targetDigest: OTHER_DIGEST },
      },
    });
  });

  it("rejects a target revision that changes between copy and verification", async () => {
    const { journal, transfer, runner } = await makeRunner();
    transfer.verify.mockResolvedValueOnce({
      schemaVersion: 1,
      targetRevision: 2,
      targetDigest: DIGEST,
    });

    await expect(runner.start(OPERATION, "vault-history-v1")).resolves.toEqual({
      status: "blocked",
      reason: "snapshot-mismatch",
    });
    await expect(journal.read()).resolves.toMatchObject({
      status: "ready",
      record: { activeBackend: "sqlite-history-v1", migration: { phase: "copied" } },
    });
  });

  it("does not fall back when target activation fails after the authority commit", async () => {
    const { journal, participants, runner } = await makeRunner();
    participants.target.activate.mockImplementationOnce(async () => "blocked");

    await expect(runner.start(OPERATION, "vault-history-v1")).resolves.toEqual({
      status: "blocked",
      reason: "activation-blocked",
    });
    await expect(journal.read()).resolves.toMatchObject({
      status: "ready",
      record: {
        activeBackend: "vault-history-v1",
        migration: { phase: "activating" },
      },
    });
    await expect(runner.abort(OPERATION)).resolves.toEqual({
      status: "blocked",
      reason: "invalid-transition",
    });
    await expect(runner.resume(OPERATION)).resolves.toMatchObject({ status: "completed" });
    expect(participants.source.activate).not.toHaveBeenCalled();
  });

  it("can abort before commit and reactivates only the source at the advanced generation", async () => {
    const { journal, participants, transfer, runner } = await makeRunner();
    transfer.copy.mockRejectedValueOnce(new Error("pause before import"));

    await runner.start(OPERATION, "vault-history-v1");
    await expect(runner.abort(OPERATION)).resolves.toEqual({
      status: "aborted",
      operationId: OPERATION,
      activeBackend: "sqlite-history-v1",
      generation: 1,
    });
    await expect(journal.read()).resolves.toMatchObject({
      status: "ready",
      record: {
        activeBackend: "sqlite-history-v1",
        generation: 1,
        migration: null,
        lastOutcome: "aborted",
      },
    });
    expect(participants.state.sourceActive).toBe(true);
    expect(participants.state.sourceGeneration).toBe(1);
    expect(participants.state.targetFenced).toBe(true);
    expect(participants.state.targetActive).toBe(false);
  });

  it("accepts revision zero for a new, empty source partition", async () => {
    const { transfer, runner } = await makeRunner();
    transfer.copy.mockResolvedValueOnce({
      schemaVersion: 1,
      sourceRevision: 0,
      targetRevision: 0,
      sourceDigest: DIGEST,
      targetDigest: DIGEST,
    });
    transfer.verify.mockResolvedValueOnce({
      schemaVersion: 1,
      targetRevision: 0,
      targetDigest: DIGEST,
    });

    await expect(runner.start(OPERATION, "vault-history-v1")).resolves.toMatchObject({
      status: "completed",
      generation: 1,
    });
  });

  it("serializes overlapping start and resume calls for one runner instance", async () => {
    const { transfer, runner } = await makeRunner();
    const start = runner.start(OPERATION, "vault-history-v1");
    const resume = runner.resume(OPERATION);
    const [first, second] = await Promise.all([start, resume]);

    expect(first.status).toBe("completed");
    expect(second.status).toBe("completed");
    expect(transfer.copy).toHaveBeenCalledTimes(1);
  });

  it("rejects a resume request for a different operation", async () => {
    const { runner } = await makeRunner();
    await runner.start(OPERATION, "vault-history-v1");
    await expect(runner.resume("migration-other")).resolves.toEqual({
      status: "blocked",
      reason: "wrong-operation",
    });
  });

  it("returns idle when no journal has been initialized", async () => {
    const store = makeJournalStore();
    const journal = createHoidHistoryAuthorityJournalCoordinator(store.port, PARTITION);
    if (!journal) throw new Error("Journal fixture could not be created");
    const participants = makeParticipants();
    const transfer = makeTransfer();
    const runner = createHoidHistoryMigrationRunner({
      partitionId: PARTITION,
      journal,
      participants: [participants.source, participants.target],
      transfer: transfer.port,
    });
    if (!runner) throw new Error("Migration runner fixture could not be created");

    await expect(runner.resume(OPERATION)).resolves.toEqual({ status: "idle" });
    expect(transfer.copy).not.toHaveBeenCalled();
  });

  it("rejects ports with getters without invoking them", () => {
    let invoked = false;
    const transfer = Object.defineProperties({}, {
      copy: { enumerable: true, get: () => { invoked = true; return async () => null; } },
      verify: { enumerable: true, value: async () => null },
    });
    const store = makeJournalStore();
    const journal = createHoidHistoryAuthorityJournalCoordinator(store.port, PARTITION);
    const participants = makeParticipants();

    expect(createHoidHistoryMigrationRunner({
      partitionId: PARTITION,
      journal,
      participants: [participants.source, participants.target],
      transfer,
    })).toBeNull();
    expect(invoked).toBe(false);
  });

  it("rejects duplicate backend participants", () => {
    const store = makeJournalStore();
    const journal = createHoidHistoryAuthorityJournalCoordinator(store.port, PARTITION);
    const participants = makeParticipants();

    expect(createHoidHistoryMigrationRunner({
      partitionId: PARTITION,
      journal,
      participants: [participants.source, participants.source],
      transfer: makeTransfer().port,
    })).toBeNull();
  });
});
