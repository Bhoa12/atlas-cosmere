import type { HoidConversationVault, HoidConversationVaultResult } from "./conversationVault";
import type { HoidHistoryFencingParticipantPort } from "./conversationHistoryAuthorityJournal";
import type { HoidHistoryMigrationSnapshotPort } from "./conversationHistoryMigrationSnapshotPort";

const MAX_COUNTER = Number.MAX_SAFE_INTEGER - 1;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;

export const HOID_VAULT_GENERATION_FENCE_DURABILITY =
  "cross-runtime-linearizable-fence-v1" as const;

export type HoidVaultGenerationFenceState = "active" | "inactive" | "fenced";
export type HoidVaultGenerationFenceRecord = Readonly<{
  schemaVersion: 1;
  kind: "hoid-vault-generation-fence";
  partitionId: string;
  sessionId: string;
  generation: number;
  state: HoidVaultGenerationFenceState;
  operationId: string | null;
}>;

export type HoidVaultGenerationFenceTransactionPort = Readonly<{
  read: (partitionId: string) => Promise<unknown | null>;
  create: (partitionId: string, initial: HoidVaultGenerationFenceRecord) => Promise<unknown>;
  compareAndSwap: (
    partitionId: string,
    expected: Readonly<{
      generation: number;
      state: HoidVaultGenerationFenceState;
      operationId: string | null;
    }>,
    next: HoidVaultGenerationFenceRecord,
  ) => Promise<unknown>;
}>;

/**
 * This is a native coordination contract, not a JavaScript mutex. Production
 * implementations must serialize every process and adapter for a partition,
 * release safely after process death, and hold the gate across the awaited
 * Vault operation. The durable row is not itself an anti-rollback anchor:
 * the host must compare it with the rollback-resistant authority journal.
 */
export type HoidVaultGenerationFenceStorePort = Readonly<{
  durability: typeof HOID_VAULT_GENERATION_FENCE_DURABILITY;
  withExclusive: <T>(
    partitionId: string,
    task: (transaction: HoidVaultGenerationFenceTransactionPort) => Promise<T>,
  ) => Promise<T>;
}>;

type FenceRole = "source" | "target";
type FenceBinding = Readonly<{
  partitionId: string;
  sessionId: string;
  role: FenceRole;
  initialGeneration: number;
  storeGeneration: number;
}>;

export type HoidConversationVaultGenerationFencedAdapter = Readonly<{
  vault: HoidConversationVault;
  participant: HoidHistoryFencingParticipantPort;
  migration: HoidHistoryMigrationSnapshotPort;
}>;

type DataRecord = Record<string, unknown>;

function exactDataRecord(value: unknown, keys: readonly string[]): DataRecord | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length ||
      ownKeys.some(key => typeof key !== "string" || !keys.includes(key))) return null;
    const output = Object.create(null) as DataRecord;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true) return null;
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return null;
  }
}

function validCounter(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    value >= 0 && value <= MAX_COUNTER;
}

function canonicalBinding(value: unknown): FenceBinding | null {
  const record = exactDataRecord(value, [
    "partitionId", "sessionId", "role", "initialGeneration", "storeGeneration",
  ]);
  if (!record ||
    typeof record.partitionId !== "string" || !OPAQUE_ID.test(record.partitionId) ||
    typeof record.sessionId !== "string" || !SESSION_ID.test(record.sessionId) ||
    (record.role !== "source" && record.role !== "target") ||
    !validCounter(record.initialGeneration) ||
    !validCounter(record.storeGeneration) ||
    record.initialGeneration >= MAX_COUNTER) return null;
  const expected = record.role === "source"
    ? record.initialGeneration
    : record.initialGeneration + 1;
  if (record.storeGeneration !== expected) return null;
  return Object.freeze({
    partitionId: record.partitionId,
    sessionId: record.sessionId,
    role: record.role,
    initialGeneration: record.initialGeneration,
    storeGeneration: record.storeGeneration,
  });
}

function canonicalFenceRecord(value: unknown): HoidVaultGenerationFenceRecord | null {
  const record = exactDataRecord(value, [
    "schemaVersion", "kind", "partitionId", "sessionId",
    "generation", "state", "operationId",
  ]);
  if (!record ||
    record.schemaVersion !== 1 ||
    record.kind !== "hoid-vault-generation-fence" ||
    typeof record.partitionId !== "string" || !OPAQUE_ID.test(record.partitionId) ||
    typeof record.sessionId !== "string" || !SESSION_ID.test(record.sessionId) ||
    !validCounter(record.generation) ||
    (record.state !== "active" && record.state !== "inactive" && record.state !== "fenced") ||
    !(record.operationId === null ||
      (typeof record.operationId === "string" && OPAQUE_ID.test(record.operationId)))) return null;
  return Object.freeze({
    schemaVersion: 1,
    kind: "hoid-vault-generation-fence",
    partitionId: record.partitionId,
    sessionId: record.sessionId,
    generation: record.generation,
    state: record.state,
    operationId: record.operationId,
  });
}

function canonicalVault(value: unknown): HoidConversationVault | null {
  const record = exactDataRecord(value, ["restore", "save", "clear"]);
  if (!record ||
    typeof record.restore !== "function" ||
    typeof record.save !== "function" ||
    typeof record.clear !== "function") return null;
  const restore = record.restore as HoidConversationVault["restore"];
  const save = record.save as HoidConversationVault["save"];
  const clear = record.clear as HoidConversationVault["clear"];
  return Object.freeze({
    restore: sessionId => restore.call(value, sessionId),
    save: (sessionId, expectedRevision, snapshot) =>
      save.call(value, sessionId, expectedRevision, snapshot),
    clear: (sessionId, expectedRevision) => clear.call(value, sessionId, expectedRevision),
  });
}

function canonicalTransaction(value: unknown): HoidVaultGenerationFenceTransactionPort | null {
  const record = exactDataRecord(value, ["read", "create", "compareAndSwap"]);
  if (!record ||
    typeof record.read !== "function" ||
    typeof record.create !== "function" ||
    typeof record.compareAndSwap !== "function") return null;
  const read = record.read as HoidVaultGenerationFenceTransactionPort["read"];
  const create = record.create as HoidVaultGenerationFenceTransactionPort["create"];
  const compareAndSwap = record.compareAndSwap as HoidVaultGenerationFenceTransactionPort["compareAndSwap"];
  return Object.freeze({
    read: partitionId => read.call(value, partitionId),
    create: (partitionId, initial) => create.call(value, partitionId, initial),
    compareAndSwap: (partitionId, expected, next) =>
      compareAndSwap.call(value, partitionId, expected, next),
  });
}

function canonicalStore(value: unknown): HoidVaultGenerationFenceStorePort | null {
  const record = exactDataRecord(value, ["durability", "withExclusive"]);
  if (!record ||
    record.durability !== HOID_VAULT_GENERATION_FENCE_DURABILITY ||
    typeof record.withExclusive !== "function") return null;
  const withExclusive = record.withExclusive as HoidVaultGenerationFenceStorePort["withExclusive"];
  return Object.freeze({
    durability: HOID_VAULT_GENERATION_FENCE_DURABILITY,
    withExclusive: <T>(
      partitionId: string,
      task: (transaction: HoidVaultGenerationFenceTransactionPort) => Promise<T>,
    ): Promise<T> => withExclusive.call(value, partitionId, async raw => {
      const transaction = canonicalTransaction(raw);
      if (!transaction) throw new Error("Invalid Vault generation fence transaction");
      return task(transaction);
    }) as Promise<T>,
  });
}

function blocked(reason: Extract<HoidConversationVaultResult, { status: "blocked" }>["reason"]):
  HoidConversationVaultResult {
  return Object.freeze({ status: "blocked", reason });
}

function rowMatchesBinding(row: HoidVaultGenerationFenceRecord, binding: FenceBinding): boolean {
  return row.partitionId === binding.partitionId && row.sessionId === binding.sessionId;
}

function initialRecord(binding: FenceBinding): HoidVaultGenerationFenceRecord {
  return Object.freeze({
    schemaVersion: 1,
    kind: "hoid-vault-generation-fence",
    partitionId: binding.partitionId,
    sessionId: binding.sessionId,
    generation: binding.initialGeneration,
    state: binding.role === "source" ? "active" : "inactive",
    operationId: null,
  });
}

async function ensureRow(
  transaction: HoidVaultGenerationFenceTransactionPort,
  binding: FenceBinding,
): Promise<HoidVaultGenerationFenceRecord | null> {
  let raw = await transaction.read(binding.partitionId);
  if (raw === null) {
    const created = await transaction.create(binding.partitionId, initialRecord(binding));
    if (created !== "created" && created !== "conflict") return null;
    raw = await transaction.read(binding.partitionId);
  }
  const row = canonicalFenceRecord(raw);
  return row && rowMatchesBinding(row, binding) ? row : null;
}

function validFenceInput(value: unknown, binding: FenceBinding) {
  const record = exactDataRecord(value, [
    "partitionId", "expectedGeneration", "nextGeneration", "operationId",
  ]);
  if (!record ||
    record.partitionId !== binding.partitionId ||
    !validCounter(record.expectedGeneration) ||
    !validCounter(record.nextGeneration) ||
    record.expectedGeneration >= MAX_COUNTER ||
    record.nextGeneration !== record.expectedGeneration + 1 ||
    typeof record.operationId !== "string" || !OPAQUE_ID.test(record.operationId)) return null;
  return Object.freeze({
    partitionId: record.partitionId,
    expectedGeneration: record.expectedGeneration,
    nextGeneration: record.nextGeneration,
    operationId: record.operationId,
  });
}

function validActivateInput(value: unknown, binding: FenceBinding) {
  const record = exactDataRecord(value, ["partitionId", "generation", "operationId"]);
  if (!record ||
    record.partitionId !== binding.partitionId ||
    !validCounter(record.generation) ||
    typeof record.operationId !== "string" || !OPAQUE_ID.test(record.operationId)) return null;
  return Object.freeze({
    partitionId: record.partitionId,
    generation: record.generation,
    operationId: record.operationId,
  });
}

function validMigrationInput(
  value: unknown,
  binding: FenceBinding,
  keys: readonly string[],
): DataRecord | null {
  const record = exactDataRecord(value, keys);
  if (
    !record ||
    typeof record.operationId !== "string" ||
    !OPAQUE_ID.test(record.operationId) ||
    !validCounter(record.generation) ||
    record.generation !== binding.initialGeneration + 1
  ) return null;
  return record;
}

function migrationRowMatches(
  row: HoidVaultGenerationFenceRecord | null,
  binding: FenceBinding,
  operationId: string,
  generation: number,
): boolean {
  return row !== null &&
    rowMatchesBinding(row, binding) &&
    row.state === "fenced" &&
    row.operationId === operationId &&
    row.generation === generation;
}

/**
 * Wrap one Vault session. The host must discard the unfenced Vault reference.
 * Normal operations, fence() and activate() all use the same exclusive gate.
 */
export function createHoidConversationVaultGenerationFencedAdapter(
  vaultInput: unknown,
  storeInput: unknown,
  bindingInput: unknown,
): HoidConversationVaultGenerationFencedAdapter | null {
  const vault = canonicalVault(vaultInput);
  const store = canonicalStore(storeInput);
  const binding = canonicalBinding(bindingInput);
  if (!vault || !store || !binding) return null;

  const execute = async (
    operation: () => Promise<HoidConversationVaultResult>,
  ): Promise<HoidConversationVaultResult> => {
    try {
      return await store.withExclusive(binding.partitionId, async transaction => {
        const row = await ensureRow(transaction, binding);
        if (!row) return blocked("generation-fence-unavailable");
        if (row.generation !== binding.storeGeneration || row.state !== "active") {
          return blocked("generation-fenced");
        }
        try {
          return await operation();
        } catch {
          return blocked("blob-store-unavailable");
        }
      });
    } catch {
      return blocked("generation-fence-unavailable");
    }
  };

  const fencedVault: HoidConversationVault = Object.freeze({
    restore: (sessionId: string) => sessionId !== binding.sessionId
      ? Promise.resolve(blocked("invalid-session"))
      : execute(() => vault.restore(sessionId)),
    save: (sessionId: string, expectedRevision: number, snapshot: unknown) =>
      sessionId !== binding.sessionId
        ? Promise.resolve(blocked("invalid-session"))
        : execute(() => vault.save(sessionId, expectedRevision, snapshot)),
    clear: (sessionId: string, expectedRevision: number) =>
      sessionId !== binding.sessionId
        ? Promise.resolve(blocked("invalid-session"))
        : execute(() => vault.clear(sessionId, expectedRevision)),
  });

  const participant: HoidHistoryFencingParticipantPort = Object.freeze({
    kind: "vault-history-v1" as const,
    fence: async input => {
      const canonical = validFenceInput(input, binding);
      if (!canonical) return "blocked";
      try {
        return await store.withExclusive(binding.partitionId, async transaction => {
          const row = await ensureRow(transaction, binding);
          if (!row) return "blocked";
          if (row.generation === canonical.nextGeneration &&
            row.state === "fenced" &&
            row.operationId === canonical.operationId) return "fenced";
          if (row.generation !== canonical.expectedGeneration) return "conflict";
          const allowed = binding.role === "source"
            ? row.state === "active"
            : row.state === "inactive";
          if (!allowed) return "conflict";
          const next = Object.freeze({
            ...row,
            generation: canonical.nextGeneration,
            state: "fenced" as const,
            operationId: canonical.operationId,
          });
          const result = await transaction.compareAndSwap(binding.partitionId, {
            generation: row.generation,
            state: row.state,
            operationId: row.operationId,
          }, next);
          return result === "saved" ? "fenced" : result === "conflict" ? "conflict" : "blocked";
        });
      } catch {
        return "blocked";
      }
    },
    activate: async input => {
      const canonical = validActivateInput(input, binding);
      if (!canonical) return "blocked";
      try {
        return await store.withExclusive(binding.partitionId, async transaction => {
          const row = await ensureRow(transaction, binding);
          if (!row ||
            row.generation !== canonical.generation ||
            row.operationId !== canonical.operationId) return "blocked";
          if (row.state === "active") return "already-active";
          if (row.state !== "fenced") return "blocked";
          const next = Object.freeze({ ...row, state: "active" as const });
          const result = await transaction.compareAndSwap(binding.partitionId, {
            generation: row.generation,
            state: row.state,
            operationId: row.operationId,
          }, next);
          return result === "saved" ? "activated" : "blocked";
        });
      } catch {
        return "blocked";
      }
    },
  });

  const migration: HoidHistoryMigrationSnapshotPort = Object.freeze({
    kind: "vault-history-v1" as const,
    role: binding.role,
    read: async input => {
      const canonical = validMigrationInput(input, binding, ["operationId", "generation"]);
      if (!canonical) return blocked("generation-fence-unavailable");
      try {
        return await store.withExclusive(binding.partitionId, async transaction => {
          const row = await ensureRow(transaction, binding);
          if (!migrationRowMatches(
            row,
            binding,
            canonical.operationId as string,
            canonical.generation as number,
          )) return blocked("generation-fenced");
          try {
            return await vault.restore(binding.sessionId);
          } catch {
            return blocked("blob-store-unavailable");
          }
        });
      } catch {
        return blocked("generation-fence-unavailable");
      }
    },
    replace: async input => {
      if (binding.role !== "target") return blocked("generation-fenced");
      const canonical = validMigrationInput(
        input,
        binding,
        ["operationId", "generation", "expectedRevision", "snapshot"],
      );
      if (
        !canonical ||
        !validCounter(canonical.expectedRevision) ||
        (canonical.expectedRevision as number) >= MAX_COUNTER
      ) return blocked("generation-fence-unavailable");
      try {
        return await store.withExclusive(binding.partitionId, async transaction => {
          const row = await ensureRow(transaction, binding);
          if (!migrationRowMatches(
            row,
            binding,
            canonical.operationId as string,
            canonical.generation as number,
          )) return blocked("generation-fenced");
          try {
            return await vault.save(
              binding.sessionId,
              canonical.expectedRevision as number,
              canonical.snapshot,
            );
          } catch {
            return blocked("blob-store-unavailable");
          }
        });
      } catch {
        return blocked("generation-fence-unavailable");
      }
    },
    clear: async input => {
      if (binding.role !== "target") return blocked("generation-fenced");
      const canonical = validMigrationInput(
        input,
        binding,
        ["operationId", "generation", "expectedRevision"],
      );
      if (
        !canonical ||
        !validCounter(canonical.expectedRevision) ||
        (canonical.expectedRevision as number) >= MAX_COUNTER
      ) return blocked("generation-fence-unavailable");
      try {
        return await store.withExclusive(binding.partitionId, async transaction => {
          const row = await ensureRow(transaction, binding);
          if (!migrationRowMatches(
            row,
            binding,
            canonical.operationId as string,
            canonical.generation as number,
          )) return blocked("generation-fenced");
          try {
            return await vault.clear(
              binding.sessionId,
              canonical.expectedRevision as number,
            );
          } catch {
            return blocked("blob-store-unavailable");
          }
        });
      } catch {
        return blocked("generation-fence-unavailable");
      }
    },
  });

  return Object.freeze({ vault: fencedVault, participant, migration });
}
