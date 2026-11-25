import {
  createExpoSqliteHoidConversationHistoryStore,
} from "./expoSqliteConversationHistoryStore";
import {
  HOID_CONVERSATION_STORAGE_RECORD_KIND,
  HOID_CONVERSATION_STORAGE_SCHEMA_VERSION,
  type HoidConversationHistoryStorePort,
  type HoidConversationStorageKey,
  type HoidConversationStorageRecord,
} from "./conversationHistoryStorePort";
import type {
  HoidHistoryFencingParticipantPort,
} from "./conversationHistoryAuthorityJournal";
import type { HoidHistoryMigrationSnapshotPort } from "./conversationHistoryMigrationSnapshotPort";
import type {
  HoidSqliteBindValue,
  HoidSqliteDatabasePort,
  HoidSqliteRunResult,
  HoidSqliteTransactionPort,
} from "./sqliteProgressStore";

export const HOID_SQLITE_CONVERSATION_GENERATION_TABLE =
  "hoid_conversation_history_generation_v1" as const;

const MAX_COUNTER = Number.MAX_SAFE_INTEGER - 1;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const HISTORY_TABLE = "hoid_conversation_history_v1";
const BLOCKED_ROW = Object.freeze({ invalidGenerationFence: true });

type FenceRole = "source" | "target";
type FenceState = "active" | "inactive" | "fenced";

type FenceRow = Readonly<{
  partition_id: string;
  principal_id: string;
  conversation_id: string;
  generation: number;
  state: FenceState;
  operation_id: string | null;
}>;

type FenceBinding = Readonly<{
  partitionId: string;
  storageKey: HoidConversationStorageKey;
  role: FenceRole;
  initialGeneration: number;
  storeGeneration: number;
}>;

export type HoidExpoSqliteHoidConversationHistoryFencedAdapter = Readonly<{
  store: HoidConversationHistoryStorePort;
  participant: HoidHistoryFencingParticipantPort;
  migration: HoidHistoryMigrationSnapshotPort;
}>;

const CREATE_FENCE_TABLE_SQL = [
  "CREATE TABLE IF NOT EXISTS hoid_conversation_history_generation_v1 (",
  "partition_id TEXT PRIMARY KEY NOT NULL CHECK(length(partition_id) BETWEEN 1 AND 128),",
  "principal_id TEXT NOT NULL CHECK(length(principal_id) BETWEEN 1 AND 128),",
  "conversation_id TEXT NOT NULL CHECK(length(conversation_id) BETWEEN 1 AND 128),",
  "generation INTEGER NOT NULL CHECK(generation >= 0),",
  "state TEXT NOT NULL CHECK(state IN ('active', 'inactive', 'fenced')),",
  "operation_id TEXT NULL CHECK(operation_id IS NULL OR length(operation_id) BETWEEN 1 AND 128)",
  ")",
].join(" ");

const INSERT_FENCE_IF_ABSENT_SQL = [
  "INSERT OR IGNORE INTO hoid_conversation_history_generation_v1",
  "(partition_id, principal_id, conversation_id, generation, state, operation_id)",
  "VALUES (?, ?, ?, ?, ?, ?)",
].join(" ");

const SELECT_FENCE_SQL = [
  "SELECT partition_id, principal_id, conversation_id, generation, state, operation_id",
  "FROM hoid_conversation_history_generation_v1",
  "WHERE partition_id = ?",
].join(" ");

const UPDATE_FENCE_SQL = [
  "UPDATE hoid_conversation_history_generation_v1",
  "SET generation = ?, state = 'fenced', operation_id = ?",
  "WHERE partition_id = ? AND generation = ? AND state = ?",
].join(" ");

const ACTIVATE_FENCE_SQL = [
  "UPDATE hoid_conversation_history_generation_v1",
  "SET state = 'active'",
  "WHERE partition_id = ? AND generation = ? AND state = 'fenced' AND operation_id = ?",
].join(" ");

function exactDataRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some(key => typeof key !== "string" || !keys.includes(key))
    ) return null;
    const output = Object.create(null) as Record<string, unknown>;
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

function canonicalStorageKey(value: unknown): HoidConversationStorageKey | null {
  const record = exactDataRecord(value, ["principalId", "conversationId"]);
  if (
    !record ||
    typeof record.principalId !== "string" ||
    typeof record.conversationId !== "string" ||
    !OPAQUE_ID.test(record.principalId) ||
    !OPAQUE_ID.test(record.conversationId)
  ) return null;
  return Object.freeze({
    principalId: record.principalId,
    conversationId: record.conversationId,
  });
}

function validCounter(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_COUNTER;
}

function canonicalBinding(value: unknown): FenceBinding | null {
  const record = exactDataRecord(value, [
    "partitionId",
    "storageKey",
    "role",
    "initialGeneration",
    "storeGeneration",
  ]);
  if (
    !record ||
    typeof record.partitionId !== "string" ||
    !OPAQUE_ID.test(record.partitionId) ||
    (record.role !== "source" && record.role !== "target") ||
    !validCounter(record.initialGeneration) ||
    !validCounter(record.storeGeneration) ||
    record.initialGeneration >= MAX_COUNTER
  ) return null;

  const storageKey = canonicalStorageKey(record.storageKey);
  if (!storageKey) return null;
  const expectedStoreGeneration = record.role === "source"
    ? record.initialGeneration
    : record.initialGeneration + 1;
  if (record.storeGeneration !== expectedStoreGeneration) return null;

  return Object.freeze({
    partitionId: record.partitionId,
    storageKey,
    role: record.role,
    initialGeneration: record.initialGeneration,
    storeGeneration: record.storeGeneration,
  });
}

function canonicalFenceRow(value: unknown): FenceRow | null {
  const record = exactDataRecord(value, [
    "partition_id",
    "principal_id",
    "conversation_id",
    "generation",
    "state",
    "operation_id",
  ]);
  if (
    !record ||
    typeof record.partition_id !== "string" ||
    !OPAQUE_ID.test(record.partition_id) ||
    typeof record.principal_id !== "string" ||
    !OPAQUE_ID.test(record.principal_id) ||
    typeof record.conversation_id !== "string" ||
    !OPAQUE_ID.test(record.conversation_id) ||
    !validCounter(record.generation) ||
    (record.state !== "active" && record.state !== "inactive" && record.state !== "fenced") ||
    !(record.operation_id === null ||
      (typeof record.operation_id === "string" && OPAQUE_ID.test(record.operation_id)))
  ) return null;
  return Object.freeze({
    partition_id: record.partition_id,
    principal_id: record.principal_id,
    conversation_id: record.conversation_id,
    generation: record.generation,
    state: record.state,
    operation_id: record.operation_id,
  });
}

function rowMatchesBinding(row: FenceRow, binding: FenceBinding): boolean {
  return row.partition_id === binding.partitionId &&
    row.principal_id === binding.storageKey.principalId &&
    row.conversation_id === binding.storageKey.conversationId;
}

function historyTableReferenced(sql: string): boolean {
  return new RegExp("\\b" + HISTORY_TABLE + "\\b", "iu").test(sql);
}

function historyStatementMatchesBoundKey(
  sql: string,
  params: readonly HoidSqliteBindValue[],
  binding: FenceBinding,
): boolean {
  const normalized = sql.replace(/\s+/gu, " ").trim().toUpperCase();
  let principalIndex: number;
  let conversationIndex: number;
  if (
    normalized.startsWith("SELECT ") &&
    normalized.includes(" FROM " + HISTORY_TABLE.toUpperCase() + " ")
  ) {
    principalIndex = 0;
    conversationIndex = 1;
  } else if (
    normalized.startsWith("INSERT INTO " + HISTORY_TABLE.toUpperCase() + " ")
  ) {
    principalIndex = 0;
    conversationIndex = 1;
  } else if (
    normalized.startsWith("UPDATE " + HISTORY_TABLE.toUpperCase() + " ")
  ) {
    principalIndex = 3;
    conversationIndex = 4;
  } else {
    return false;
  }
  return params[principalIndex] === binding.storageKey.principalId &&
    params[conversationIndex] === binding.storageKey.conversationId;
}

function validParticipantFenceInput(value: unknown, binding: FenceBinding): Readonly<{
  partitionId: string;
  expectedGeneration: number;
  nextGeneration: number;
  operationId: string;
}> | null {
  const record = exactDataRecord(value, [
    "partitionId",
    "expectedGeneration",
    "nextGeneration",
    "operationId",
  ]);
  if (
    !record ||
    record.partitionId !== binding.partitionId ||
    !validCounter(record.expectedGeneration) ||
    !validCounter(record.nextGeneration) ||
    record.expectedGeneration >= MAX_COUNTER ||
    record.nextGeneration !== record.expectedGeneration + 1 ||
    typeof record.operationId !== "string" ||
    !OPAQUE_ID.test(record.operationId)
  ) return null;
  return Object.freeze({
    partitionId: record.partitionId,
    expectedGeneration: record.expectedGeneration,
    nextGeneration: record.nextGeneration,
    operationId: record.operationId,
  });
}

function validParticipantActivateInput(value: unknown, binding: FenceBinding): Readonly<{
  partitionId: string;
  generation: number;
  operationId: string;
}> | null {
  const record = exactDataRecord(value, ["partitionId", "generation", "operationId"]);
  if (
    !record ||
    record.partitionId !== binding.partitionId ||
    !validCounter(record.generation) ||
    typeof record.operationId !== "string" ||
    !OPAQUE_ID.test(record.operationId)
  ) return null;
  return Object.freeze({
    partitionId: record.partitionId,
    generation: record.generation,
    operationId: record.operationId,
  });
}

/**
 * Creates a SQLite-backed generation fence for exactly one conversation
 * partition. The history store is wrapped so every history SELECT and
 * INSERT/UPDATE is checked against the fence row inside the same exclusive
 * SQLite transaction as the operation.
 *
 * This is process/cross-connection fencing while the database file remains
 * intact. The fence row is stored in the same rollback-restorable SQLite
 * database and is NOT an anti-rollback anchor. A hardware-backed monotonic
 * journal must still be checked by the host before production use.
 */
export function createExpoSqliteHoidConversationHistoryFencedAdapter(
  database: HoidSqliteDatabasePort,
  protectorInput: unknown,
  bindingInput: unknown,
): HoidExpoSqliteHoidConversationHistoryFencedAdapter | null {
  const binding = canonicalBinding(bindingInput);
  if (
    !binding ||
    !database ||
    typeof database.withExclusiveTransactionAsync !== "function" ||
    typeof database.getFirstAsync !== "function" ||
    typeof database.runAsync !== "function" ||
    typeof database.execAsync !== "function"
  ) return null;

  let initialization: Promise<void> | null = null;

  const ensureInitialized = (): Promise<void> => {
    if (initialization) return initialization;
    const initialState: FenceState = binding.role === "source" ? "active" : "inactive";
    initialization = database.withExclusiveTransactionAsync(async transaction => {
      await transaction.execAsync(CREATE_FENCE_TABLE_SQL);
      await transaction.runAsync(
        INSERT_FENCE_IF_ABSENT_SQL,
        binding.partitionId,
        binding.storageKey.principalId,
        binding.storageKey.conversationId,
        binding.initialGeneration,
        initialState,
        null,
      );
      const raw = await transaction.getFirstAsync<unknown>(
        SELECT_FENCE_SQL,
        binding.partitionId,
      );
      const row = canonicalFenceRow(raw);
      if (!row || !rowMatchesBinding(row, binding)) {
        throw new Error("SQLite history generation fence is missing or mismatched");
      }
    }).catch(error => {
      initialization = null;
      throw error;
    });
    return initialization;
  };

  const isActive = async (transaction: HoidSqliteTransactionPort): Promise<boolean> => {
    const raw = await transaction.getFirstAsync<unknown>(
      SELECT_FENCE_SQL,
      binding.partitionId,
    );
    const row = canonicalFenceRow(raw);
    return row !== null &&
      rowMatchesBinding(row, binding) &&
      row.generation === binding.storeGeneration &&
      row.state === "active";
  };

  const guardedDatabase: HoidSqliteDatabasePort = Object.freeze({
    execAsync: (source: string) => database.execAsync(source),
    getFirstAsync: async <T>(
      source: string,
      ...params: HoidSqliteBindValue[]
    ): Promise<T | null> => {
      if (!historyTableReferenced(source)) {
        return database.getFirstAsync<T>(source, ...params);
      }
      if (!historyStatementMatchesBoundKey(source, params, binding)) {
        return BLOCKED_ROW as unknown as T;
      }
      await ensureInitialized();
      let blocked = false;
      let result: T | null = null;
      await database.withExclusiveTransactionAsync(async transaction => {
        if (!await isActive(transaction)) {
          blocked = true;
          return;
        }
        result = await transaction.getFirstAsync<T>(source, ...params);
      });
      return blocked ? BLOCKED_ROW as unknown as T : result;
    },
    runAsync: async (
      source: string,
      ...params: HoidSqliteBindValue[]
    ): Promise<HoidSqliteRunResult> => {
      if (!historyTableReferenced(source)) {
        return database.runAsync(source, ...params);
      }
      if (!historyStatementMatchesBoundKey(source, params, binding)) {
        return Object.freeze({ changes: 0 });
      }
      await ensureInitialized();
      let result: HoidSqliteRunResult = Object.freeze({ changes: 0 });
      await database.withExclusiveTransactionAsync(async transaction => {
        if (!await isActive(transaction)) return;
        result = await transaction.runAsync(source, ...params);
      });
      return result;
    },
    withExclusiveTransactionAsync: async (
      task: (transaction: HoidSqliteTransactionPort) => Promise<void>,
    ): Promise<void> => {
      await ensureInitialized();
      await database.withExclusiveTransactionAsync(async transaction => {
        const guardedTransaction: HoidSqliteTransactionPort = Object.freeze({
          execAsync: async (source: string): Promise<void> => {
            if (
              historyTableReferenced(source) &&
              !/^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+hoid_conversation_history_v1\b/iu.test(source)
            ) throw new Error("Unapproved SQL against Hoid conversation history");
            await transaction.execAsync(source);
          },
          getFirstAsync: async <T>(
            source: string,
            ...params: HoidSqliteBindValue[]
          ): Promise<T | null> => {
            if (!historyTableReferenced(source)) {
              return transaction.getFirstAsync<T>(source, ...params);
            }
            if (
              !historyStatementMatchesBoundKey(source, params, binding) ||
              !await isActive(transaction)
            ) return BLOCKED_ROW as unknown as T;
            return transaction.getFirstAsync<T>(source, ...params);
          },
          runAsync: async (
            source: string,
            ...params: HoidSqliteBindValue[]
          ): Promise<HoidSqliteRunResult> => {
            if (!historyTableReferenced(source)) {
              return transaction.runAsync(source, ...params);
            }
            if (
              !historyStatementMatchesBoundKey(source, params, binding) ||
              !await isActive(transaction)
            ) return Object.freeze({ changes: 0 });
            return transaction.runAsync(source, ...params);
          },
        });
        await task(guardedTransaction);
      });
    },
  });

  let store: HoidConversationHistoryStorePort;
  try {
    store = createExpoSqliteHoidConversationHistoryStore(
      guardedDatabase,
      protectorInput,
    );
  } catch {
    return null;
  }

  const participant: HoidHistoryFencingParticipantPort = Object.freeze({
    kind: "sqlite-history-v1" as const,
    fence: async (input: Readonly<{
      partitionId: string;
      expectedGeneration: number;
      nextGeneration: number;
      operationId: string;
    }>): Promise<"fenced" | "conflict" | "blocked"> => {
      const canonical = validParticipantFenceInput(input, binding);
      if (!canonical) return "blocked";
      try {
        await ensureInitialized();
        let result: "fenced" | "conflict" | "blocked" = "blocked";
        await database.withExclusiveTransactionAsync(async transaction => {
          const raw = await transaction.getFirstAsync<unknown>(
            SELECT_FENCE_SQL,
            binding.partitionId,
          );
          const row = canonicalFenceRow(raw);
          if (!row || !rowMatchesBinding(row, binding)) return;

          if (
            row.generation === canonical.nextGeneration &&
            row.state === "fenced" &&
            row.operation_id === canonical.operationId
          ) {
            result = "fenced";
            return;
          }

          const allowedState = binding.role === "source"
            ? row.state === "active"
            : row.state === "inactive" || row.state === "fenced";
          if (
            row.generation !== canonical.expectedGeneration ||
            !allowedState
          ) {
            result = "conflict";
            return;
          }

          const updated = await transaction.runAsync(
            UPDATE_FENCE_SQL,
            canonical.nextGeneration,
            canonical.operationId,
            binding.partitionId,
            canonical.expectedGeneration,
            row.state,
          );
          result = updated.changes === 1 ? "fenced" : "conflict";
        });
        return result;
      } catch {
        return "blocked";
      }
    },
    activate: async (input: Readonly<{
      partitionId: string;
      generation: number;
      operationId: string;
    }>): Promise<"activated" | "already-active" | "blocked"> => {
      const canonical = validParticipantActivateInput(input, binding);
      if (!canonical) return "blocked";
      try {
        await ensureInitialized();
        let result: "activated" | "already-active" | "blocked" = "blocked";
        await database.withExclusiveTransactionAsync(async transaction => {
          const raw = await transaction.getFirstAsync<unknown>(
            SELECT_FENCE_SQL,
            binding.partitionId,
          );
          const row = canonicalFenceRow(raw);
          if (
            !row ||
            !rowMatchesBinding(row, binding) ||
            row.generation !== canonical.generation ||
            row.operation_id !== canonical.operationId
          ) return;

          if (row.state === "active") {
            result = "already-active";
            return;
          }
          if (row.state !== "fenced") return;

          const updated = await transaction.runAsync(
            ACTIVATE_FENCE_SQL,
            binding.partitionId,
            canonical.generation,
            canonical.operationId,
          );
          result = updated.changes === 1 ? "activated" : "blocked";
        });
        return result;
      } catch {
        return "blocked";
      }
    },
  });

  const withMigrationGate = async (
    operationIdInput: unknown,
    generationInput: unknown,
    write: boolean,
    task: (migrationStore: HoidConversationHistoryStorePort) => Promise<unknown>,
  ): Promise<unknown> => {
    if (
      typeof operationIdInput !== "string" ||
      !OPAQUE_ID.test(operationIdInput) ||
      !validCounter(generationInput) ||
      generationInput !== binding.initialGeneration + 1 ||
      (write && binding.role !== "target")
    ) return Object.freeze({ status: "blocked", reason: "generation-fenced" });

    try {
      await ensureInitialized();
      let result: unknown = Object.freeze({
        status: "blocked",
        reason: "generation-fence-unavailable",
      });
      await database.withExclusiveTransactionAsync(async transaction => {
        const rawFence = await transaction.getFirstAsync<unknown>(
          SELECT_FENCE_SQL,
          binding.partitionId,
        );
        const row = canonicalFenceRow(rawFence);
        if (
          !row ||
          !rowMatchesBinding(row, binding) ||
          row.generation !== generationInput ||
          row.state !== "fenced" ||
          row.operation_id !== operationIdInput
        ) {
          result = Object.freeze({ status: "blocked", reason: "generation-fenced" });
          return;
        }

        const transactionDatabase: HoidSqliteDatabasePort = Object.freeze({
          execAsync: (source: string) => transaction.execAsync(source),
          runAsync: (
            source: string,
            ...params: HoidSqliteBindValue[]
          ) => transaction.runAsync(source, ...params),
          getFirstAsync: <T>(
            source: string,
            ...params: HoidSqliteBindValue[]
          ) => transaction.getFirstAsync<T>(source, ...params),
          withExclusiveTransactionAsync: async (
            nestedTask: (nested: HoidSqliteTransactionPort) => Promise<void>,
          ) => {
            // Reuse the already-held native transaction; never open a nested one.
            await nestedTask(transaction);
          },
        });

        try {
          const migrationStore = createExpoSqliteHoidConversationHistoryStore(
            transactionDatabase,
            protectorInput,
          );
          result = await task(migrationStore);
        } catch {
          result = Object.freeze({ status: "blocked", reason: "generation-fence-unavailable" });
        }
      });
      return result;
    } catch {
      return Object.freeze({ status: "blocked", reason: "generation-fence-unavailable" });
    }
  };

  const migration: HoidHistoryMigrationSnapshotPort = Object.freeze({
    kind: "sqlite-history-v1" as const,
    read: async input => {
      const canonical = exactDataRecord(input, ["operationId", "generation"]);
      if (
        !canonical ||
        typeof canonical.operationId !== "string" ||
        !OPAQUE_ID.test(canonical.operationId) ||
        !validCounter(canonical.generation)
      ) return Object.freeze({ status: "blocked", reason: "generation-fence-unavailable" });

      return withMigrationGate(
        canonical.operationId,
        canonical.generation,
        false,
        async migrationStore => {
          const raw = await migrationStore.read(binding.storageKey);
          if (raw === null) return Object.freeze({ status: "empty", revision: 0 });
          const record = exactDataRecord(raw, [
            "schemaVersion",
            "kind",
            "principalId",
            "conversationId",
            "storageRevision",
            "snapshot",
          ]);
          if (
            !record ||
            record.schemaVersion !== HOID_CONVERSATION_STORAGE_SCHEMA_VERSION ||
            record.kind !== HOID_CONVERSATION_STORAGE_RECORD_KIND ||
            record.principalId !== binding.storageKey.principalId ||
            record.conversationId !== binding.storageKey.conversationId ||
            !validCounter(record.storageRevision) ||
            record.storageRevision < 1
          ) return Object.freeze({ status: "blocked", reason: "generation-fence-unavailable" });
          return Object.freeze({
            status: "ready",
            revision: record.storageRevision,
            snapshot: record.snapshot,
          });
        },
      );
    },
    replace: async input => {
      const canonical = exactDataRecord(input, [
        "operationId",
        "generation",
        "expectedRevision",
        "snapshot",
      ]);
      if (
        !canonical ||
        typeof canonical.operationId !== "string" ||
        !OPAQUE_ID.test(canonical.operationId) ||
        !validCounter(canonical.generation) ||
        !validCounter(canonical.expectedRevision) ||
        canonical.expectedRevision >= MAX_COUNTER
      ) return Object.freeze({ status: "blocked", reason: "generation-fence-unavailable" });

      return withMigrationGate(
        canonical.operationId,
        canonical.generation,
        true,
        async migrationStore => {
          const nextRevision = (canonical.expectedRevision as number) + 1;
          const nextRecord = Object.freeze({
            schemaVersion: HOID_CONVERSATION_STORAGE_SCHEMA_VERSION,
            kind: HOID_CONVERSATION_STORAGE_RECORD_KIND,
            principalId: binding.storageKey.principalId,
            conversationId: binding.storageKey.conversationId,
            storageRevision: nextRevision,
            snapshot: canonical.snapshot,
          }) as HoidConversationStorageRecord;
          const outcome = await migrationStore.compareAndSwap(
            binding.storageKey,
            canonical.expectedRevision as number === 0
              ? null
              : canonical.expectedRevision as number,
            nextRecord,
          );
          return outcome === "saved"
            ? Object.freeze({ status: "saved", revision: nextRevision })
            : outcome === "conflict"
              ? Object.freeze({ status: "conflict", revision: null })
              : Object.freeze({ status: "blocked", reason: "generation-fence-unavailable" });
        },
      );
    },
    clear: async input => {
      const canonical = exactDataRecord(input, [
        "operationId",
        "generation",
        "expectedRevision",
      ]);
      if (
        !canonical ||
        typeof canonical.operationId !== "string" ||
        !OPAQUE_ID.test(canonical.operationId) ||
        !validCounter(canonical.generation) ||
        !validCounter(canonical.expectedRevision) ||
        canonical.expectedRevision >= MAX_COUNTER
      ) return Object.freeze({ status: "blocked", reason: "generation-fence-unavailable" });

      return withMigrationGate(
        canonical.operationId,
        canonical.generation,
        true,
        async migrationStore => {
          const raw = await migrationStore.read(binding.storageKey);
          if (raw === null) {
            return canonical.expectedRevision === 0
              ? Object.freeze({ status: "cleared", revision: 0 })
              : Object.freeze({ status: "conflict", revision: 0 });
          }
          const record = exactDataRecord(raw, [
            "schemaVersion",
            "kind",
            "principalId",
            "conversationId",
            "storageRevision",
            "snapshot",
          ]);
          if (
            !record ||
            record.schemaVersion !== HOID_CONVERSATION_STORAGE_SCHEMA_VERSION ||
            record.kind !== HOID_CONVERSATION_STORAGE_RECORD_KIND ||
            record.principalId !== binding.storageKey.principalId ||
            record.conversationId !== binding.storageKey.conversationId ||
            !validCounter(record.storageRevision) ||
            record.storageRevision < 1
          ) return Object.freeze({ status: "blocked", reason: "generation-fence-unavailable" });
          if (record.storageRevision !== canonical.expectedRevision) {
            return Object.freeze({ status: "conflict", revision: record.storageRevision });
          }
          // SQLite v1 has no tombstone/delete contract; never fake a clear.
          return Object.freeze({ status: "blocked", reason: "sqlite-tombstone-unsupported" });
        },
      );
    },
  });

  return Object.freeze({ store, participant, migration });
}
