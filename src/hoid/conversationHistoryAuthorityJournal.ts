export const HOID_HISTORY_AUTHORITY_JOURNAL_SCHEMA_VERSION = 1 as const;
export const HOID_HISTORY_AUTHORITY_JOURNAL_KIND =
  "hoid-history-authority-journal" as const;

const MAX_COUNTER = Number.MAX_SAFE_INTEGER - 1;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA256_HEX = /^[a-f0-9]{64}$/u;

export type HoidHistoryBackendKind = "sqlite-history-v1" | "vault-history-v1";
export type HoidHistoryMigrationPhase =
  | "fencing"
  | "copying"
  | "copied"
  | "verified"
  | "activating"
  | "aborting";

export type HoidHistoryAuthorityJournalMigration = Readonly<{
  operationId: string;
  sourceBackend: HoidHistoryBackendKind;
  targetBackend: HoidHistoryBackendKind;
  generation: number;
  phase: HoidHistoryMigrationPhase;
  sourceFenced: boolean;
  targetFenced: boolean;
  sourceRevision: number | null;
  targetRevision: number | null;
  sourceDigest: string | null;
  targetDigest: string | null;
}>;

export type HoidHistoryAuthorityJournalRecord = Readonly<{
  schemaVersion: typeof HOID_HISTORY_AUTHORITY_JOURNAL_SCHEMA_VERSION;
  kind: typeof HOID_HISTORY_AUTHORITY_JOURNAL_KIND;
  partitionId: string;
  journalRevision: number;
  generation: number;
  activeBackend: HoidHistoryBackendKind;
  migration: HoidHistoryAuthorityJournalMigration | null;
  lastOperationId: string | null;
  lastOutcome: "committed" | "aborted" | null;
}>;

/**
 * This port is deliberately stronger than an ordinary database CAS.
 * Implementations must persist atomically across process crashes and anchor
 * the monotonic revision/generation outside rollback-restorable application
 * storage. SQLite or AsyncStorage alone do not satisfy this contract.
 */
export type HoidHistoryAuthorityJournalStorePort = Readonly<{
  durability: "rollback-resistant-monotonic-cas-v1";
  read: (partitionId: string) => Promise<unknown | null>;
  compareAndSwap: (
    partitionId: string,
    expectedJournalRevision: number | null,
    next: HoidHistoryAuthorityJournalRecord,
  ) => Promise<unknown>;
}>;

/**
 * Contract required from each future storage adapter. Every normal read and
 * write must also enforce the current generation atomically; implementing
 * fence()/activate() without generation checks on ordinary operations is not
 * sufficient. Neither existing history adapter implements this contract yet.
 */
export type HoidHistoryFencingParticipantPort = Readonly<{
  kind: HoidHistoryBackendKind;
  fence: (input: Readonly<{
    partitionId: string;
    expectedGeneration: number;
    nextGeneration: number;
    operationId: string;
  }>) => Promise<"fenced" | "conflict" | "blocked">;
  activate: (input: Readonly<{
    partitionId: string;
    generation: number;
    operationId: string;
  }>) => Promise<"activated" | "already-active" | "blocked">;
}>;

export type HoidHistoryAuthorityJournalReadResult =
  | Readonly<{ status: "empty" }>
  | Readonly<{ status: "ready"; record: HoidHistoryAuthorityJournalRecord }>
  | Readonly<{ status: "blocked"; reason: HoidHistoryAuthorityJournalBlockedReason }>;

export type HoidHistoryAuthorityJournalBlockedReason =
  | "journal-unavailable"
  | "journal-not-initialized"
  | "invalid-journal"
  | "invalid-input"
  | "invalid-transition"
  | "revision-exhausted"
  | "generation-exhausted"
  | "snapshot-mismatch"
  | "journal-result-invalid";

export type HoidHistoryAuthorityJournalWriteResult =
  | Readonly<{ status: "saved"; record: HoidHistoryAuthorityJournalRecord }>
  | Readonly<{ status: "already-applied"; record: HoidHistoryAuthorityJournalRecord }>
  | Readonly<{ status: "conflict" }>
  | Readonly<{ status: "blocked"; reason: HoidHistoryAuthorityJournalBlockedReason }>;

export type HoidHistoryAuthorityJournalCoordinator = Readonly<{
  read: () => Promise<HoidHistoryAuthorityJournalReadResult>;
  initialize: (
    activeBackend: HoidHistoryBackendKind,
  ) => Promise<HoidHistoryAuthorityJournalWriteResult>;
  begin: (
    operationId: string,
    targetBackend: HoidHistoryBackendKind,
  ) => Promise<HoidHistoryAuthorityJournalWriteResult>;
  acknowledgeFence: (
    actor: "source" | "target",
    generation: number,
  ) => Promise<HoidHistoryAuthorityJournalWriteResult>;
  recordCopy: (input: Readonly<{
    operationId: string;
    sourceRevision: number;
    targetRevision: number;
    sourceDigest: string;
    targetDigest: string;
  }>) => Promise<HoidHistoryAuthorityJournalWriteResult>;
  verifyCopy: (
    operationId: string,
    targetDigest: string,
  ) => Promise<HoidHistoryAuthorityJournalWriteResult>;
  commit: (operationId: string) => Promise<HoidHistoryAuthorityJournalWriteResult>;
  completeActivation: (operationId: string) => Promise<HoidHistoryAuthorityJournalWriteResult>;
  beginAbort: (operationId: string) => Promise<HoidHistoryAuthorityJournalWriteResult>;
  completeAbort: (operationId: string) => Promise<HoidHistoryAuthorityJournalWriteResult>;
}>;

type DataRecord = Record<string, unknown>;
type JournalBase = Omit<HoidHistoryAuthorityJournalRecord, "migration">;

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

    const output = Object.create(null) as DataRecord;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      output[key] = descriptor.value;
    }
    return output;
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

function validRevision(value: unknown): value is number {
  return validCounter(value);
}

function validBackend(value: unknown): value is HoidHistoryBackendKind {
  return value === "sqlite-history-v1" || value === "vault-history-v1";
}

function validOpaqueId(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_ID.test(value);
}

function canonicalMigration(
  value: unknown,
  journal: Pick<JournalBase, "generation" | "activeBackend">,
): HoidHistoryAuthorityJournalMigration | null {
  const record = exactDataRecord(value, [
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
    !record ||
    !validOpaqueId(record.operationId) ||
    !validBackend(record.sourceBackend) ||
    !validBackend(record.targetBackend) ||
    record.sourceBackend === record.targetBackend ||
    !validCounter(record.generation) ||
    typeof record.sourceFenced !== "boolean" ||
    typeof record.targetFenced !== "boolean" ||
    !(record.sourceRevision === null || validRevision(record.sourceRevision)) ||
    !(record.targetRevision === null || validRevision(record.targetRevision)) ||
    !(record.sourceDigest === null || (typeof record.sourceDigest === "string" && SHA256_HEX.test(record.sourceDigest))) ||
    !(record.targetDigest === null || (typeof record.targetDigest === "string" && SHA256_HEX.test(record.targetDigest)))
  ) return null;

  const phase = record.phase;
  if (
    phase !== "fencing" &&
    phase !== "copying" &&
    phase !== "copied" &&
    phase !== "verified" &&
    phase !== "activating" &&
    phase !== "aborting"
  ) return null;

  const sourceRevision = record.sourceRevision as number | null;
  const targetRevision = record.targetRevision as number | null;
  const sourceDigest = record.sourceDigest as string | null;
  const targetDigest = record.targetDigest as string | null;
  const sourceFenced = record.sourceFenced as boolean;
  const targetFenced = record.targetFenced as boolean;
  const generation = record.generation as number;
  const sourceBackend = record.sourceBackend as HoidHistoryBackendKind;
  const targetBackend = record.targetBackend as HoidHistoryBackendKind;

  if (phase === "fencing" || phase === "copying" || phase === "copied" || phase === "verified") {
    if (
      journal.activeBackend !== sourceBackend ||
      journal.generation >= MAX_COUNTER ||
      generation !== journal.generation + 1
    ) return null;
  } else if (
    journal.generation !== generation ||
    journal.activeBackend !== (phase === "activating" ? targetBackend : sourceBackend)
  ) {
    return null;
  }

  if (phase === "fencing") {
    if (sourceRevision !== null || targetRevision !== null || sourceDigest !== null || targetDigest !== null) return null;
    if (sourceFenced && targetFenced) return null;
  }
  if (phase === "copying") {
    if (!sourceFenced || !targetFenced || sourceRevision !== null || targetRevision !== null || sourceDigest !== null || targetDigest !== null) return null;
  }
  if (phase === "copied" || phase === "verified" || phase === "activating") {
    if (
      !sourceFenced ||
      !targetFenced ||
      sourceRevision === null ||
      targetRevision === null ||
      sourceDigest === null ||
      targetDigest === null
    ) return null;
  }
  if (phase === "verified" || phase === "activating") {
    if (sourceDigest !== targetDigest) return null;
  }
  if (phase === "aborting" && (!sourceFenced || !targetFenced)) return null;

  return Object.freeze({
    operationId: record.operationId as string,
    sourceBackend,
    targetBackend,
    generation,
    phase,
    sourceFenced,
    targetFenced,
    sourceRevision,
    targetRevision,
    sourceDigest,
    targetDigest,
  });
}

function canonicalJournal(value: unknown): HoidHistoryAuthorityJournalRecord | null {
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
    record.schemaVersion !== HOID_HISTORY_AUTHORITY_JOURNAL_SCHEMA_VERSION ||
    record.kind !== HOID_HISTORY_AUTHORITY_JOURNAL_KIND ||
    !validOpaqueId(record.partitionId) ||
    !validCounter(record.journalRevision) ||
    !validCounter(record.generation) ||
    !validBackend(record.activeBackend) ||
    !(record.lastOperationId === null || validOpaqueId(record.lastOperationId)) ||
    !(record.lastOutcome === null || record.lastOutcome === "committed" || record.lastOutcome === "aborted") ||
    ((record.lastOperationId === null) !== (record.lastOutcome === null))
  ) return null;

  const base = {
    generation: record.generation as number,
    activeBackend: record.activeBackend as HoidHistoryBackendKind,
  };
  const migration = record.migration === null ? null : canonicalMigration(record.migration, base);
  if (record.migration !== null && migration === null) return null;

  return Object.freeze({
    schemaVersion: HOID_HISTORY_AUTHORITY_JOURNAL_SCHEMA_VERSION,
    kind: HOID_HISTORY_AUTHORITY_JOURNAL_KIND,
    partitionId: record.partitionId as string,
    journalRevision: record.journalRevision as number,
    generation: record.generation as number,
    activeBackend: record.activeBackend as HoidHistoryBackendKind,
    migration,
    lastOperationId: record.lastOperationId as string | null,
    lastOutcome: record.lastOutcome as "committed" | "aborted" | null,
  });
}

function canonicalStore(value: unknown): HoidHistoryAuthorityJournalStorePort | null {
  const record = exactDataRecord(value, ["durability", "read", "compareAndSwap"]);
  if (
    !record ||
    record.durability !== "rollback-resistant-monotonic-cas-v1" ||
    typeof record.read !== "function" ||
    typeof record.compareAndSwap !== "function"
  ) return null;
  const readMethod = record.read as HoidHistoryAuthorityJournalStorePort["read"];
  const compareAndSwapMethod = record.compareAndSwap as HoidHistoryAuthorityJournalStorePort["compareAndSwap"];
  return Object.freeze({
    durability: "rollback-resistant-monotonic-cas-v1",
    read: (partitionId: string) => readMethod.call(value, partitionId),
    compareAndSwap: (partitionId: string, expected: number | null, next: HoidHistoryAuthorityJournalRecord) =>
      compareAndSwapMethod.call(value, partitionId, expected, next),
  });
}

function blocked(reason: HoidHistoryAuthorityJournalBlockedReason): HoidHistoryAuthorityJournalWriteResult {
  return Object.freeze({ status: "blocked", reason });
}

function withRevision(
  current: HoidHistoryAuthorityJournalRecord,
  next: Omit<HoidHistoryAuthorityJournalRecord, "journalRevision">,
): HoidHistoryAuthorityJournalRecord | null {
  if (current.journalRevision >= MAX_COUNTER) return null;
  return canonicalJournal({ ...next, journalRevision: current.journalRevision + 1 });
}

export function createHoidHistoryAuthorityJournalCoordinator(
  storeInput: unknown,
  partitionIdInput: string,
): HoidHistoryAuthorityJournalCoordinator | null {
  const store = canonicalStore(storeInput);
  if (!store || !validOpaqueId(partitionIdInput)) return null;

  const partitionId = partitionIdInput;
  let tail: Promise<void> = Promise.resolve();

  const enqueue = <T>(operation: () => Promise<T>, failure: T): Promise<T> => {
    const task = tail.then(async () => {
      try {
        return await operation();
      } catch {
        return failure;
      }
    });
    tail = task.then(() => undefined, () => undefined);
    return task;
  };

  const readCurrent = async (): Promise<
    | Readonly<{ status: "empty" }>
    | Readonly<{ status: "ready"; record: HoidHistoryAuthorityJournalRecord }>
    | Readonly<{ status: "blocked"; reason: HoidHistoryAuthorityJournalBlockedReason }>
  > => {
    let raw: unknown | null;
    try {
      raw = await store.read(partitionId);
    } catch {
      return Object.freeze({ status: "blocked", reason: "journal-unavailable" });
    }
    if (raw === null) return Object.freeze({ status: "empty" });
    const record = canonicalJournal(raw);
    if (!record || record.partitionId !== partitionId) {
      return Object.freeze({ status: "blocked", reason: "invalid-journal" });
    }
    return Object.freeze({ status: "ready", record });
  };

  const persist = async (
    current: HoidHistoryAuthorityJournalRecord | null,
    next: HoidHistoryAuthorityJournalRecord,
  ): Promise<HoidHistoryAuthorityJournalWriteResult> => {
    let rawResult: unknown;
    try {
      rawResult = await store.compareAndSwap(
        partitionId,
        current === null ? null : current.journalRevision,
        next,
      );
    } catch {
      return blocked("journal-unavailable");
    }
    if (rawResult === "conflict") return Object.freeze({ status: "conflict" });
    if (rawResult !== "saved") return blocked("journal-result-invalid");
    return Object.freeze({ status: "saved", record: next });
  };

  const transact = (
    mutate: (current: HoidHistoryAuthorityJournalRecord) =>
      | Readonly<{ kind: "next"; value: Omit<HoidHistoryAuthorityJournalRecord, "journalRevision"> }>
      | Readonly<{ kind: "already" }>
      | Readonly<{ kind: "blocked"; reason: HoidHistoryAuthorityJournalBlockedReason }>,
  ): Promise<HoidHistoryAuthorityJournalWriteResult> => enqueue(async () => {
    const loaded = await readCurrent();
    if (loaded.status === "empty") return blocked("journal-not-initialized");
    if (loaded.status === "blocked") return blocked(loaded.reason);
    const decision = mutate(loaded.record);
    if (decision.kind === "blocked") return blocked(decision.reason);
    if (decision.kind === "already") {
      return Object.freeze({ status: "already-applied", record: loaded.record });
    }
    const next = withRevision(loaded.record, decision.value);
    if (!next) return blocked("revision-exhausted");
    return persist(loaded.record, next);
  }, blocked("journal-unavailable"));

  const read = (): Promise<HoidHistoryAuthorityJournalReadResult> => enqueue(async () => {
    const loaded = await readCurrent();
    if (loaded.status === "empty") return Object.freeze({ status: "empty" });
    if (loaded.status === "blocked") return Object.freeze({ status: "blocked", reason: loaded.reason });
    return Object.freeze({ status: "ready", record: loaded.record });
  }, Object.freeze({ status: "blocked", reason: "journal-unavailable" }));

  const initialize = (activeBackend: HoidHistoryBackendKind): Promise<HoidHistoryAuthorityJournalWriteResult> =>
    enqueue(async () => {
      if (!validBackend(activeBackend)) return blocked("invalid-input");
      const loaded = await readCurrent();
      if (loaded.status === "blocked") return blocked(loaded.reason);
      if (loaded.status === "ready") {
        if (
          loaded.record.activeBackend === activeBackend &&
          loaded.record.generation === 0 &&
          loaded.record.migration === null
        ) return Object.freeze({ status: "already-applied", record: loaded.record });
        return blocked("invalid-transition");
      }
      const initial = canonicalJournal({
        schemaVersion: HOID_HISTORY_AUTHORITY_JOURNAL_SCHEMA_VERSION,
        kind: HOID_HISTORY_AUTHORITY_JOURNAL_KIND,
        partitionId,
        journalRevision: 0,
        generation: 0,
        activeBackend,
        migration: null,
        lastOperationId: null,
        lastOutcome: null,
      });
      if (!initial) return blocked("invalid-journal");
      return persist(null, initial);
    }, blocked("journal-unavailable"));

  const begin = (
    operationId: string,
    targetBackend: HoidHistoryBackendKind,
  ): Promise<HoidHistoryAuthorityJournalWriteResult> => transact(current => {
    if (!validOpaqueId(operationId) || !validBackend(targetBackend)) {
      return { kind: "blocked", reason: "invalid-input" };
    }
    if (
      current.migration !== null ||
      current.activeBackend === targetBackend ||
      current.lastOperationId === operationId
    ) return { kind: "blocked", reason: "invalid-transition" };
    if (current.generation >= MAX_COUNTER) return { kind: "blocked", reason: "generation-exhausted" };
    const migration: HoidHistoryAuthorityJournalMigration = Object.freeze({
      operationId,
      sourceBackend: current.activeBackend,
      targetBackend,
      generation: current.generation + 1,
      phase: "fencing",
      sourceFenced: false,
      targetFenced: false,
      sourceRevision: null,
      targetRevision: null,
      sourceDigest: null,
      targetDigest: null,
    });
    return {
      kind: "next",
      value: { ...current, migration },
    };
  });

  const acknowledgeFence = (
    actor: "source" | "target",
    generation: number,
  ): Promise<HoidHistoryAuthorityJournalWriteResult> => transact(current => {
    const migration = current.migration;
    if (!migration || migration.generation !== generation) {
      return { kind: "blocked", reason: "invalid-transition" };
    }
    const alreadyFenced = actor === "source" ? migration.sourceFenced : migration.targetFenced;
    if (alreadyFenced) return { kind: "already" };
    if (migration.phase !== "fencing" || (actor !== "source" && actor !== "target")) {
      return { kind: "blocked", reason: "invalid-transition" };
    }
    const sourceFenced = actor === "source" || migration.sourceFenced;
    const targetFenced = actor === "target" || migration.targetFenced;
    const nextMigration: HoidHistoryAuthorityJournalMigration = Object.freeze({
      ...migration,
      sourceFenced,
      targetFenced,
      phase: sourceFenced && targetFenced ? "copying" : "fencing",
    });
    return { kind: "next", value: { ...current, migration: nextMigration } };
  });

  const recordCopy = (input: Readonly<{
    operationId: string;
    sourceRevision: number;
    targetRevision: number;
    sourceDigest: string;
    targetDigest: string;
  }>): Promise<HoidHistoryAuthorityJournalWriteResult> => transact(current => {
    const migration = current.migration;
    if (
      !migration ||
      migration.operationId !== input.operationId ||
      !validRevision(input.sourceRevision) ||
      !validRevision(input.targetRevision) ||
      typeof input.sourceDigest !== "string" ||
      !SHA256_HEX.test(input.sourceDigest) ||
      typeof input.targetDigest !== "string" ||
      !SHA256_HEX.test(input.targetDigest)
    ) return { kind: "blocked", reason: "invalid-input" };
    if (
      (migration.phase === "copied" || migration.phase === "verified") &&
      migration.sourceRevision === input.sourceRevision &&
      migration.targetRevision === input.targetRevision &&
      migration.sourceDigest === input.sourceDigest &&
      migration.targetDigest === input.targetDigest
    ) return { kind: "already" };
    if (migration.phase !== "copying" || !migration.sourceFenced || !migration.targetFenced) {
      return { kind: "blocked", reason: "invalid-transition" };
    }
    const nextMigration: HoidHistoryAuthorityJournalMigration = Object.freeze({
      ...migration,
      phase: "copied",
      sourceRevision: input.sourceRevision,
      targetRevision: input.targetRevision,
      sourceDigest: input.sourceDigest,
      targetDigest: input.targetDigest,
    });
    return { kind: "next", value: { ...current, migration: nextMigration } };
  });

  const verifyCopy = (
    operationId: string,
    targetDigest: string,
  ): Promise<HoidHistoryAuthorityJournalWriteResult> => transact(current => {
    const migration = current.migration;
    if (!migration || migration.operationId !== operationId) {
      return { kind: "blocked", reason: "invalid-transition" };
    }
    if (migration.phase === "verified" && migration.targetDigest === targetDigest) {
      return { kind: "already" };
    }
    if (migration.phase !== "copied") return { kind: "blocked", reason: "invalid-transition" };
    if (
      typeof targetDigest !== "string" ||
      !SHA256_HEX.test(targetDigest) ||
      migration.sourceDigest !== targetDigest ||
      migration.targetDigest !== targetDigest
    ) return { kind: "blocked", reason: "snapshot-mismatch" };
    const nextMigration: HoidHistoryAuthorityJournalMigration = Object.freeze({
      ...migration,
      phase: "verified",
    });
    return { kind: "next", value: { ...current, migration: nextMigration } };
  });

  const commit = (operationId: string): Promise<HoidHistoryAuthorityJournalWriteResult> =>
    transact(current => {
      const migration = current.migration;
      if (!migration || migration.operationId !== operationId) {
        return { kind: "blocked", reason: "invalid-transition" };
      }
      if (migration.phase === "activating") return { kind: "already" };
      if (migration.phase !== "verified") return { kind: "blocked", reason: "invalid-transition" };
      const nextMigration: HoidHistoryAuthorityJournalMigration = Object.freeze({
        ...migration,
        phase: "activating",
      });
      return {
        kind: "next",
        value: {
          ...current,
          generation: migration.generation,
          activeBackend: migration.targetBackend,
          migration: nextMigration,
        },
      };
    });

  const completeActivation = (operationId: string): Promise<HoidHistoryAuthorityJournalWriteResult> =>
    transact(current => {
      const migration = current.migration;
      if (
        migration === null &&
        current.lastOperationId === operationId &&
        current.lastOutcome === "committed"
      ) return { kind: "already" };
      if (
        !migration ||
        migration.operationId !== operationId ||
        migration.phase !== "activating" ||
        current.activeBackend !== migration.targetBackend ||
        current.generation !== migration.generation
      ) return { kind: "blocked", reason: "invalid-transition" };
      return {
        kind: "next",
        value: {
          ...current,
          migration: null,
          lastOperationId: operationId,
          lastOutcome: "committed",
        },
      };
    });

  const beginAbort = (operationId: string): Promise<HoidHistoryAuthorityJournalWriteResult> =>
    transact(current => {
      const migration = current.migration;
      if (!migration || migration.operationId !== operationId) {
        return { kind: "blocked", reason: "invalid-transition" };
      }
      if (migration.phase === "aborting") return { kind: "already" };
      if (
        migration.phase !== "copying" &&
        migration.phase !== "copied" &&
        migration.phase !== "verified"
      ) return { kind: "blocked", reason: "invalid-transition" };
      if (!migration.sourceFenced || !migration.targetFenced) {
        return { kind: "blocked", reason: "invalid-transition" };
      }
      const nextMigration: HoidHistoryAuthorityJournalMigration = Object.freeze({
        ...migration,
        phase: "aborting",
      });
      return {
        kind: "next",
        value: {
          ...current,
          generation: migration.generation,
          activeBackend: migration.sourceBackend,
          migration: nextMigration,
        },
      };
    });

  const completeAbort = (operationId: string): Promise<HoidHistoryAuthorityJournalWriteResult> =>
    transact(current => {
      const migration = current.migration;
      if (
        migration === null &&
        current.lastOperationId === operationId &&
        current.lastOutcome === "aborted"
      ) return { kind: "already" };
      if (
        !migration ||
        migration.operationId !== operationId ||
        migration.phase !== "aborting" ||
        current.activeBackend !== migration.sourceBackend ||
        current.generation !== migration.generation
      ) return { kind: "blocked", reason: "invalid-transition" };
      return {
        kind: "next",
        value: {
          ...current,
          migration: null,
          lastOperationId: operationId,
          lastOutcome: "aborted",
        },
      };
    });

  return Object.freeze({
    read,
    initialize,
    begin,
    acknowledgeFence,
    recordCopy,
    verifyCopy,
    commit,
    completeActivation,
    beginAbort,
    completeAbort,
  });
}
