import {
  type HoidHistoryAuthorityJournalCoordinator,
  type HoidHistoryAuthorityJournalRecord,
  type HoidHistoryBackendKind,
  type HoidHistoryFencingParticipantPort,
} from "./conversationHistoryAuthorityJournal";

export const HOID_HISTORY_MIGRATION_SNAPSHOT_SCHEMA_VERSION = 1 as const;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA256_HEX = /^[a-f0-9]{64}$/u;
const MAX_COUNTER = Number.MAX_SAFE_INTEGER - 1;

export type HoidHistoryMigrationTransferPort = Readonly<{
  /**
   * Copies one canonical, allow-listed history snapshot from source to target.
   * The adapter owns export/import codecs and must make this operation
   * idempotent by partitionId + operationId + generation.
   */
  copy: (input: Readonly<{
    partitionId: string;
    operationId: string;
    generation: number;
    sourceBackend: HoidHistoryBackendKind;
    targetBackend: HoidHistoryBackendKind;
  }>) => Promise<unknown>;
  /**
   * Re-reads the target after copy and returns its durable revision and digest.
   * It must not merely echo the values returned by copy().
   */
  verify: (input: Readonly<{
    partitionId: string;
    operationId: string;
    generation: number;
    sourceBackend: HoidHistoryBackendKind;
    targetBackend: HoidHistoryBackendKind;
    sourceRevision: number;
    targetRevision: number;
    sourceDigest: string;
    targetDigest: string;
  }>) => Promise<unknown>;
}>;

export type HoidHistoryMigrationRunnerBlockedReason =
  | "invalid-input"
  | "journal-unavailable"
  | "journal-not-initialized"
  | "invalid-journal"
  | "wrong-operation"
  | "participant-unavailable"
  | "participant-conflict"
  | "participant-blocked"
  | "transfer-failed"
  | "invalid-transfer-result"
  | "snapshot-mismatch"
  | "activation-blocked"
  | "invalid-transition"
  | "step-limit"
  | "internal-error";

export type HoidHistoryMigrationRunnerResult =
  | Readonly<{ status: "idle" }>
  | Readonly<{
      status: "completed";
      operationId: string;
      activeBackend: HoidHistoryBackendKind;
      generation: number;
    }>
  | Readonly<{
      status: "aborted";
      operationId: string;
      activeBackend: HoidHistoryBackendKind;
      generation: number;
    }>
  | Readonly<{ status: "conflict" }>
  | Readonly<{
      status: "blocked";
      reason: HoidHistoryMigrationRunnerBlockedReason;
    }>;

export type HoidHistoryMigrationRunner = Readonly<{
  start: (
    operationId: string,
    targetBackend: HoidHistoryBackendKind,
  ) => Promise<HoidHistoryMigrationRunnerResult>;
  resume: (operationId: string) => Promise<HoidHistoryMigrationRunnerResult>;
  abort: (operationId: string) => Promise<HoidHistoryMigrationRunnerResult>;
}>;

type DataRecord = Record<string, unknown>;
type ReadView =
  | Readonly<{ status: "empty" }>
  | Readonly<{ status: "blocked" }>
  | Readonly<{ status: "ready"; record: HoidHistoryAuthorityJournalRecord }>;

function exactDataRecord(value: unknown, keys: readonly string[]): DataRecord | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some(key => typeof key !== "string" || !keys.includes(key))
    ) return null;

    const result = Object.create(null) as DataRecord;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function validCounter(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_COUNTER;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_ID.test(value);
}

function validBackend(value: unknown): value is HoidHistoryBackendKind {
  return value === "sqlite-history-v1" || value === "vault-history-v1";
}

function canonicalJournalRecord(
  value: unknown,
  partitionId: string,
): HoidHistoryAuthorityJournalRecord | null {
  const record = exactDataRecord(value, [
    "schemaVersion",
    "kind",
    "partitionId",
    "journalRevision",
    "generation",
    "activeBackend",
    "migration",
    "lastOperationId",
    "lastOutcome",
  ]);
  if (
    !record ||
    record.schemaVersion !== 1 ||
    record.kind !== "hoid-history-authority-journal" ||
    record.partitionId !== partitionId ||
    !validCounter(record.journalRevision) ||
    !validCounter(record.generation) ||
    !validBackend(record.activeBackend) ||
    !(record.lastOperationId === null || validId(record.lastOperationId)) ||
    !(record.lastOutcome === null || record.lastOutcome === "committed" || record.lastOutcome === "aborted") ||
    ((record.lastOperationId === null) !== (record.lastOutcome === null))
  ) return null;

  let migration: HoidHistoryAuthorityJournalRecord["migration"] = null;
  if (record.migration !== null) {
    const raw = exactDataRecord(record.migration, [
      "operationId",
      "sourceBackend",
      "targetBackend",
      "generation",
      "phase",
      "sourceFenced",
      "targetFenced",
      "sourceRevision",
      "targetRevision",
      "sourceDigest",
      "targetDigest",
    ]);
    if (
      !raw ||
      !validId(raw.operationId) ||
      !validBackend(raw.sourceBackend) ||
      !validBackend(raw.targetBackend) ||
      raw.sourceBackend === raw.targetBackend ||
      !validCounter(raw.generation) ||
      (raw.phase !== "fencing" &&
        raw.phase !== "copying" &&
        raw.phase !== "copied" &&
        raw.phase !== "verified" &&
        raw.phase !== "activating" &&
        raw.phase !== "aborting") ||
      typeof raw.sourceFenced !== "boolean" ||
      typeof raw.targetFenced !== "boolean" ||
      !(raw.sourceRevision === null || validCounter(raw.sourceRevision)) ||
      !(raw.targetRevision === null || validCounter(raw.targetRevision)) ||
      !(raw.sourceDigest === null || (typeof raw.sourceDigest === "string" && SHA256_HEX.test(raw.sourceDigest))) ||
      !(raw.targetDigest === null || (typeof raw.targetDigest === "string" && SHA256_HEX.test(raw.targetDigest)))
    ) return null;

    migration = Object.freeze({
      operationId: raw.operationId,
      sourceBackend: raw.sourceBackend,
      targetBackend: raw.targetBackend,
      generation: raw.generation,
      phase: raw.phase,
      sourceFenced: raw.sourceFenced,
      targetFenced: raw.targetFenced,
      sourceRevision: raw.sourceRevision,
      targetRevision: raw.targetRevision,
      sourceDigest: raw.sourceDigest,
      targetDigest: raw.targetDigest,
    });
  }

  return Object.freeze({
    schemaVersion: 1,
    kind: "hoid-history-authority-journal",
    partitionId,
    journalRevision: record.journalRevision,
    generation: record.generation,
    activeBackend: record.activeBackend,
    migration,
    lastOperationId: record.lastOperationId,
    lastOutcome: record.lastOutcome,
  });
}

function canonicalRead(value: unknown, partitionId: string): ReadView {
  const empty = exactDataRecord(value, ["status"]);
  if (empty?.status === "empty") return Object.freeze({ status: "empty" });

  const blocked = exactDataRecord(value, ["status", "reason"]);
  if (blocked?.status === "blocked") return Object.freeze({ status: "blocked" });

  const ready = exactDataRecord(value, ["status", "record"]);
  if (ready?.status !== "ready") return Object.freeze({ status: "blocked" });
  const record = canonicalJournalRecord(ready.record, partitionId);
  return record
    ? Object.freeze({ status: "ready", record })
    : Object.freeze({ status: "blocked" });
}

type WriteOutcome = "ok" | "conflict" | "blocked" | "invalid";

function writeOutcome(value: unknown): WriteOutcome {
  const success = exactDataRecord(value, ["status", "record"]);
  if (success?.status === "saved" || success?.status === "already-applied") return "ok";
  const conflict = exactDataRecord(value, ["status"]);
  if (conflict?.status === "conflict") return "conflict";
  const blocked = exactDataRecord(value, ["status", "reason"]);
  if (blocked?.status === "blocked") return "blocked";
  return "invalid";
}

function canonicalJournal(value: unknown): HoidHistoryAuthorityJournalCoordinator | null {
  const record = exactDataRecord(value, [
    "read",
    "initialize",
    "begin",
    "acknowledgeFence",
    "recordCopy",
    "verifyCopy",
    "commit",
    "completeActivation",
    "beginAbort",
    "completeAbort",
  ]);
  if (!record || Object.values(record).some(method => typeof method !== "function")) return null;

  const read = record.read as HoidHistoryAuthorityJournalCoordinator["read"];
  const initialize = record.initialize as HoidHistoryAuthorityJournalCoordinator["initialize"];
  const begin = record.begin as HoidHistoryAuthorityJournalCoordinator["begin"];
  const acknowledgeFence = record.acknowledgeFence as HoidHistoryAuthorityJournalCoordinator["acknowledgeFence"];
  const recordCopy = record.recordCopy as HoidHistoryAuthorityJournalCoordinator["recordCopy"];
  const verifyCopy = record.verifyCopy as HoidHistoryAuthorityJournalCoordinator["verifyCopy"];
  const commit = record.commit as HoidHistoryAuthorityJournalCoordinator["commit"];
  const completeActivation = record.completeActivation as HoidHistoryAuthorityJournalCoordinator["completeActivation"];
  const beginAbort = record.beginAbort as HoidHistoryAuthorityJournalCoordinator["beginAbort"];
  const completeAbort = record.completeAbort as HoidHistoryAuthorityJournalCoordinator["completeAbort"];

  return Object.freeze({
    read: () => read.call(value),
    initialize: backend => initialize.call(value, backend),
    begin: (operationId, targetBackend) => begin.call(value, operationId, targetBackend),
    acknowledgeFence: (actor, generation) => acknowledgeFence.call(value, actor, generation),
    recordCopy: input => recordCopy.call(value, input),
    verifyCopy: (operationId, digest) => verifyCopy.call(value, operationId, digest),
    commit: operationId => commit.call(value, operationId),
    completeActivation: operationId => completeActivation.call(value, operationId),
    beginAbort: operationId => beginAbort.call(value, operationId),
    completeAbort: operationId => completeAbort.call(value, operationId),
  });
}

function canonicalParticipant(value: unknown): HoidHistoryFencingParticipantPort | null {
  const record = exactDataRecord(value, ["kind", "fence", "activate"]);
  if (
    !record ||
    !validBackend(record.kind) ||
    typeof record.fence !== "function" ||
    typeof record.activate !== "function"
  ) return null;

  const fence = record.fence as HoidHistoryFencingParticipantPort["fence"];
  const activate = record.activate as HoidHistoryFencingParticipantPort["activate"];
  return Object.freeze({
    kind: record.kind,
    fence: input => fence.call(value, input),
    activate: input => activate.call(value, input),
  });
}

function canonicalParticipants(value: unknown): readonly HoidHistoryFencingParticipantPort[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    if (Reflect.ownKeys(value).length !== 3 || value.length !== 2) return null;
    const first = Object.getOwnPropertyDescriptor(value, "0");
    const second = Object.getOwnPropertyDescriptor(value, "1");
    const length = Object.getOwnPropertyDescriptor(value, "length");
    if (
      !first ||
      !second ||
      !length ||
      !Object.prototype.hasOwnProperty.call(first, "value") ||
      !Object.prototype.hasOwnProperty.call(second, "value") ||
      first.enumerable !== true ||
      second.enumerable !== true
    ) return null;
    const left = canonicalParticipant(first.value);
    const right = canonicalParticipant(second.value);
    if (!left || !right || left.kind === right.kind) return null;
    return Object.freeze([left, right]);
  } catch {
    return null;
  }
}

function canonicalTransfer(value: unknown): HoidHistoryMigrationTransferPort | null {
  const record = exactDataRecord(value, ["copy", "verify"]);
  if (!record || typeof record.copy !== "function" || typeof record.verify !== "function") return null;
  const copy = record.copy as HoidHistoryMigrationTransferPort["copy"];
  const verify = record.verify as HoidHistoryMigrationTransferPort["verify"];
  return Object.freeze({
    copy: input => copy.call(value, input),
    verify: input => verify.call(value, input),
  });
}

function blocked(reason: HoidHistoryMigrationRunnerBlockedReason): HoidHistoryMigrationRunnerResult {
  return Object.freeze({ status: "blocked", reason });
}

function writeResult(value: unknown): HoidHistoryMigrationRunnerResult | null {
  const outcome = writeOutcome(value);
  if (outcome === "ok") return null;
  if (outcome === "conflict") return Object.freeze({ status: "conflict" });
  return blocked(outcome === "blocked" ? "invalid-transition" : "journal-unavailable");
}

function canonicalCopyResult(value: unknown): Readonly<{
  sourceRevision: number;
  targetRevision: number;
  sourceDigest: string;
  targetDigest: string;
}> | null {
  const record = exactDataRecord(value, [
    "schemaVersion",
    "sourceRevision",
    "targetRevision",
    "sourceDigest",
    "targetDigest",
  ]);
  if (
    !record ||
    record.schemaVersion !== HOID_HISTORY_MIGRATION_SNAPSHOT_SCHEMA_VERSION ||
    !validCounter(record.sourceRevision) ||
    !validCounter(record.targetRevision) ||
    typeof record.sourceDigest !== "string" ||
    !SHA256_HEX.test(record.sourceDigest) ||
    typeof record.targetDigest !== "string" ||
    !SHA256_HEX.test(record.targetDigest)
  ) return null;
  return Object.freeze({
    sourceRevision: record.sourceRevision,
    targetRevision: record.targetRevision,
    sourceDigest: record.sourceDigest,
    targetDigest: record.targetDigest,
  });
}

function canonicalVerifyResult(value: unknown): Readonly<{
  targetRevision: number;
  targetDigest: string;
}> | null {
  const record = exactDataRecord(value, ["schemaVersion", "targetRevision", "targetDigest"]);
  if (
    !record ||
    record.schemaVersion !== HOID_HISTORY_MIGRATION_SNAPSHOT_SCHEMA_VERSION ||
    !validCounter(record.targetRevision) ||
    typeof record.targetDigest !== "string" ||
    !SHA256_HEX.test(record.targetDigest)
  ) return null;
  return Object.freeze({
    targetRevision: record.targetRevision,
    targetDigest: record.targetDigest,
  });
}

export function createHoidHistoryMigrationRunner(
  input: unknown,
): HoidHistoryMigrationRunner | null {
  const config = exactDataRecord(input, ["partitionId", "journal", "participants", "transfer"]);
  if (!config || !validId(config.partitionId)) return null;

  const partitionId = config.partitionId;
  const journal = canonicalJournal(config.journal);
  const participants = canonicalParticipants(config.participants);
  const transfer = canonicalTransfer(config.transfer);
  if (!journal || !participants || !transfer) return null;

  const participantFor = (kind: HoidHistoryBackendKind) =>
    participants.find(participant => participant.kind === kind) ?? null;

  let tail: Promise<void> = Promise.resolve();
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const task = tail.then(operation, operation);
    tail = task.then(() => undefined, () => undefined);
    return task;
  };

  const readJournal = async (): Promise<ReadView> => {
    try {
      return canonicalRead(await journal.read(), partitionId);
    } catch {
      return Object.freeze({ status: "blocked" });
    }
  };

  const drive = async (operationId: string): Promise<HoidHistoryMigrationRunnerResult> => {
    for (let step = 0; step < 10; step += 1) {
      const loaded = await readJournal();
      if (loaded.status === "empty") return Object.freeze({ status: "idle" });
      if (loaded.status === "blocked") return blocked("journal-unavailable");

      const record = loaded.record;
      const migration = record.migration;
      if (!migration) {
        if (record.lastOperationId === operationId && record.lastOutcome === "committed") {
          return Object.freeze({
            status: "completed",
            operationId,
            activeBackend: record.activeBackend,
            generation: record.generation,
          });
        }
        if (record.lastOperationId === operationId && record.lastOutcome === "aborted") {
          return Object.freeze({
            status: "aborted",
            operationId,
            activeBackend: record.activeBackend,
            generation: record.generation,
          });
        }
        if (record.lastOperationId !== null && record.lastOperationId !== operationId) {
          return blocked("wrong-operation");
        }
        return Object.freeze({ status: "idle" });
      }
      if (migration.operationId !== operationId) return blocked("wrong-operation");

      const source = participantFor(migration.sourceBackend);
      const target = participantFor(migration.targetBackend);
      if (!source || !target) return blocked("participant-unavailable");

      if (migration.phase === "fencing") {
        if (!migration.sourceFenced) {
          let result: unknown;
          try {
            result = await source.fence({
              partitionId,
              expectedGeneration: record.generation,
              nextGeneration: migration.generation,
              operationId,
            });
          } catch {
            return blocked("participant-blocked");
          }
          if (result === "conflict") return Object.freeze({ status: "conflict" });
          if (result !== "fenced") return blocked("participant-blocked");
          const acknowledged = await journal.acknowledgeFence("source", migration.generation);
          const outcome = writeResult(acknowledged);
          if (outcome) return outcome;
          continue;
        }

        if (!migration.targetFenced) {
          let result: unknown;
          try {
            result = await target.fence({
              partitionId,
              expectedGeneration: record.generation,
              nextGeneration: migration.generation,
              operationId,
            });
          } catch {
            return blocked("participant-blocked");
          }
          if (result === "conflict") return Object.freeze({ status: "conflict" });
          if (result !== "fenced") return blocked("participant-blocked");
          const acknowledged = await journal.acknowledgeFence("target", migration.generation);
          const outcome = writeResult(acknowledged);
          if (outcome) return outcome;
          continue;
        }

        return blocked("invalid-transition");
      }

      if (migration.phase === "copying") {
        let raw: unknown;
        try {
          raw = await transfer.copy({
            partitionId,
            operationId,
            generation: migration.generation,
            sourceBackend: migration.sourceBackend,
            targetBackend: migration.targetBackend,
          });
        } catch {
          return blocked("transfer-failed");
        }
        const copied = canonicalCopyResult(raw);
        if (!copied) return blocked("invalid-transfer-result");
        const persisted = await journal.recordCopy({
          operationId,
          sourceRevision: copied.sourceRevision,
          targetRevision: copied.targetRevision,
          sourceDigest: copied.sourceDigest,
          targetDigest: copied.targetDigest,
        });
        const outcome = writeResult(persisted);
        if (outcome) return outcome;
        continue;
      }

      if (migration.phase === "copied") {
        if (
          migration.sourceRevision === null ||
          migration.targetRevision === null ||
          migration.sourceDigest === null ||
          migration.targetDigest === null
        ) return blocked("invalid-journal");

        let raw: unknown;
        try {
          raw = await transfer.verify({
            partitionId,
            operationId,
            generation: migration.generation,
            sourceBackend: migration.sourceBackend,
            targetBackend: migration.targetBackend,
            sourceRevision: migration.sourceRevision,
            targetRevision: migration.targetRevision,
            sourceDigest: migration.sourceDigest,
            targetDigest: migration.targetDigest,
          });
        } catch {
          return blocked("transfer-failed");
        }
        const verified = canonicalVerifyResult(raw);
        if (!verified) return blocked("invalid-transfer-result");
        if (verified.targetRevision !== migration.targetRevision) {
          return blocked("snapshot-mismatch");
        }
        const persisted = await journal.verifyCopy(operationId, verified.targetDigest);
        const outcome = writeResult(persisted);
        if (outcome) {
          if (outcome.status === "blocked") return blocked("snapshot-mismatch");
          return outcome;
        }
        continue;
      }

      if (migration.phase === "verified") {
        const committed = await journal.commit(operationId);
        const outcome = writeResult(committed);
        if (outcome) return outcome;
        continue;
      }

      if (migration.phase === "activating") {
        let result: unknown;
        try {
          result = await target.activate({
            partitionId,
            generation: migration.generation,
            operationId,
          });
        } catch {
          return blocked("activation-blocked");
        }
        if (result !== "activated" && result !== "already-active") {
          return blocked("activation-blocked");
        }
        const completed = await journal.completeActivation(operationId);
        const outcome = writeResult(completed);
        if (outcome) return outcome;
        continue;
      }

      if (migration.phase === "aborting") {
        let result: unknown;
        try {
          result = await source.activate({
            partitionId,
            generation: migration.generation,
            operationId,
          });
        } catch {
          return blocked("activation-blocked");
        }
        if (result !== "activated" && result !== "already-active") {
          return blocked("activation-blocked");
        }
        const completed = await journal.completeAbort(operationId);
        const outcome = writeResult(completed);
        if (outcome) return outcome;
        continue;
      }

      return blocked("invalid-journal");
    }

    return blocked("step-limit");
  };

  const start = (
    operationId: string,
    targetBackend: HoidHistoryBackendKind,
  ): Promise<HoidHistoryMigrationRunnerResult> => enqueue(async () => {
    if (!validId(operationId) || !validBackend(targetBackend)) return blocked("invalid-input");
    try {
      const begun = await journal.begin(operationId, targetBackend);
      const outcome = writeResult(begun);
      if (outcome) return outcome;
      return await drive(operationId);
    } catch {
      return blocked("internal-error");
    }
  });

  const resume = (operationId: string): Promise<HoidHistoryMigrationRunnerResult> =>
    enqueue(async () => {
      if (!validId(operationId)) return blocked("invalid-input");
      try {
        return await drive(operationId);
      } catch {
        return blocked("internal-error");
      }
    });

  const abort = (operationId: string): Promise<HoidHistoryMigrationRunnerResult> =>
    enqueue(async () => {
      if (!validId(operationId)) return blocked("invalid-input");
      try {
        const loaded = await readJournal();
        if (loaded.status === "empty") return Object.freeze({ status: "idle" });
        if (loaded.status === "blocked") return blocked("journal-unavailable");
        const migration = loaded.record.migration;
        if (!migration) {
          return await drive(operationId);
        }
        if (migration.operationId !== operationId) return blocked("wrong-operation");
        const begun = await journal.beginAbort(operationId);
        const outcome = writeResult(begun);
        if (outcome) return outcome;
        return await drive(operationId);
      } catch {
        return blocked("internal-error");
      }
    });

  return Object.freeze({ start, resume, abort });
}
