import {
  createHoidHistoryAuthorityJournalCoordinator,
  type HoidHistoryAuthorityJournalReadResult,
  type HoidHistoryAuthorityJournalStorePort,
  type HoidHistoryAuthorityJournalWriteResult,
  type HoidHistoryBackendKind,
  type HoidHistoryFencingParticipantPort,
} from "./conversationHistoryAuthorityJournal";
import type { HoidConversationHistorySnapshotCodec } from "./conversationHistorySnapshotCodec";
import type { HoidHistoryMigrationSnapshotPort } from "./conversationHistoryMigrationSnapshotPort";
import {
  createHoidHistoryMigrationSnapshotTransferAdapter,
} from "./conversationHistoryMigrationTransferAdapter";
import {
  createHoidHistoryMigrationRunner,
  type HoidHistoryMigrationRunnerBlockedReason,
  type HoidHistoryMigrationRunnerResult,
} from "./conversationHistoryMigrationRunner";

const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

type DataRecord = Record<string, unknown>;
type AdapterRole = "source" | "target";

export type HoidHistoryMigrationRuntimeBlockedReason =
  | HoidHistoryMigrationRunnerBlockedReason
  | "adapter-role-mismatch";

export type HoidHistoryMigrationRuntimeResult =
  | HoidHistoryMigrationRunnerResult
  | Readonly<{
      status: "blocked";
      reason: HoidHistoryMigrationRuntimeBlockedReason;
    }>;

export type HoidHistoryMigrationRuntime = Readonly<{
  initialize: (
    activeBackend: HoidHistoryBackendKind,
  ) => Promise<HoidHistoryAuthorityJournalWriteResult | Readonly<{
    status: "blocked";
    reason: "adapter-role-mismatch";
  }>>;
  readAuthority: () => Promise<HoidHistoryAuthorityJournalReadResult>;
  start: (
    operationId: string,
    targetBackend: HoidHistoryBackendKind,
  ) => Promise<HoidHistoryMigrationRuntimeResult>;
  resume: (operationId: string) => Promise<HoidHistoryMigrationRuntimeResult>;
  abort: (operationId: string) => Promise<HoidHistoryMigrationRuntimeResult>;
}>;

type CanonicalParticipant = HoidHistoryFencingParticipantPort;
type CanonicalMigrationPort = HoidHistoryMigrationSnapshotPort;

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

function validId(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_ID.test(value);
}

function validBackend(value: unknown): value is HoidHistoryBackendKind {
  return value === "sqlite-history-v1" || value === "vault-history-v1";
}

function canonicalParticipant(value: unknown): CanonicalParticipant | null {
  const record = exactDataRecord(value, ["kind", "fence", "activate"]);
  if (
    !record ||
    !validBackend(record.kind) ||
    typeof record.fence !== "function" ||
    typeof record.activate !== "function"
  ) return null;

  const fence = record.fence as CanonicalParticipant["fence"];
  const activate = record.activate as CanonicalParticipant["activate"];
  return Object.freeze({
    kind: record.kind,
    fence: input => fence.call(value, input),
    activate: input => activate.call(value, input),
  });
}

function canonicalMigrationPort(value: unknown): CanonicalMigrationPort | null {
  const record = exactDataRecord(value, [
    "partitionId",
    "kind",
    "role",
    "read",
    "replace",
    "clear",
  ]);
  if (
    !record ||
    !validId(record.partitionId) ||
    !validBackend(record.kind) ||
    (record.role !== "source" && record.role !== "target") ||
    typeof record.read !== "function" ||
    typeof record.replace !== "function" ||
    typeof record.clear !== "function"
  ) return null;

  const read = record.read as CanonicalMigrationPort["read"];
  const replace = record.replace as CanonicalMigrationPort["replace"];
  const clear = record.clear as CanonicalMigrationPort["clear"];
  return Object.freeze({
    partitionId: record.partitionId,
    kind: record.kind,
    role: record.role,
    read: input => read.call(value, input),
    replace: input => replace.call(value, input),
    clear: input => clear.call(value, input),
  });
}

function canonicalAdapter(
  value: unknown,
  expectedBackend: HoidHistoryBackendKind,
  partitionId: string,
): Readonly<{
  participant: CanonicalParticipant;
  migration: CanonicalMigrationPort;
}> | null {
  const record = exactDataRecord(value, ["participant", "migration"]);
  if (!record) return null;
  const participant = canonicalParticipant(record.participant);
  const migration = canonicalMigrationPort(record.migration);
  if (
    !participant ||
    !migration ||
    participant.kind !== expectedBackend ||
    migration.kind !== expectedBackend ||
    migration.partitionId !== partitionId
  ) return null;
  return Object.freeze({ participant, migration });
}

function blocked(
  reason: HoidHistoryMigrationRuntimeBlockedReason,
): HoidHistoryMigrationRuntimeResult {
  return Object.freeze({ status: "blocked", reason });
}

function roleFor(
  sqlite: CanonicalMigrationPort,
  vault: CanonicalMigrationPort,
  role: AdapterRole,
): HoidHistoryBackendKind | null {
  if (sqlite.role === role && vault.role !== role) return "sqlite-history-v1";
  if (vault.role === role && sqlite.role !== role) return "vault-history-v1";
  return null;
}

function migrationRolesMatch(
  migration: unknown,
  sourceBackend: HoidHistoryBackendKind,
  targetBackend: HoidHistoryBackendKind,
): boolean {
  const record = exactDataRecord(migration, [
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
  return record !== null &&
    record.sourceBackend === sourceBackend &&
    record.targetBackend === targetBackend;
}

/**
 * Composes the durable authority journal, fenced SQLite/Vault capabilities,
 * canonical snapshot transfer and crash-resumable runner.
 *
 * This is a provider-neutral composition root. It accepts only the migration
 * capabilities, never raw stores or Vault handles, and exposes no unfenced
 * application storage. Native rollback-resistant journal and cross-process
 * Vault gate implementations remain host responsibilities.
 */
export function createHoidHistoryMigrationRuntime(
  input: unknown,
): HoidHistoryMigrationRuntime | null {
  const config = exactDataRecord(input, [
    "partitionId",
    "journalStore",
    "sqlite",
    "vault",
    "codec",
  ]);
  if (!config || !validId(config.partitionId)) return null;

  const partitionId = config.partitionId;
  const journalStore = config.journalStore as HoidHistoryAuthorityJournalStorePort;
  const sqlite = canonicalAdapter(config.sqlite, "sqlite-history-v1", partitionId);
  const vault = canonicalAdapter(config.vault, "vault-history-v1", partitionId);
  if (!sqlite || !vault || sqlite.migration.role === vault.migration.role) return null;

  const journal = createHoidHistoryAuthorityJournalCoordinator(journalStore, partitionId);
  const transfer = createHoidHistoryMigrationSnapshotTransferAdapter({
    partitionId,
    sqlite: sqlite.migration,
    vault: vault.migration,
    codec: config.codec as HoidConversationHistorySnapshotCodec,
  });
  if (!journal || !transfer) return null;

  const runner = createHoidHistoryMigrationRunner({
    partitionId,
    journal,
    participants: [sqlite.participant, vault.participant],
    transfer,
  });
  if (!runner) return null;

  const sourceBackend = roleFor(sqlite.migration, vault.migration, "source");
  const targetBackend = roleFor(sqlite.migration, vault.migration, "target");
  if (!sourceBackend || !targetBackend || sourceBackend === targetBackend) return null;

  const readAuthority = async (): Promise<HoidHistoryAuthorityJournalReadResult> => {
    try {
      return await journal.read();
    } catch {
      return Object.freeze({ status: "blocked", reason: "journal-unavailable" });
    }
  };

  const initialize: HoidHistoryMigrationRuntime["initialize"] = async activeBackend => {
    if (!validBackend(activeBackend) || activeBackend !== sourceBackend) {
      return Object.freeze({ status: "blocked", reason: "adapter-role-mismatch" });
    }
    try {
      return await journal.initialize(activeBackend);
    } catch {
      return Object.freeze({ status: "blocked", reason: "journal-unavailable" });
    }
  };

  const start: HoidHistoryMigrationRuntime["start"] = async (operationId, targetBackendInput) => {
    if (!validId(operationId) || !validBackend(targetBackendInput)) return blocked("invalid-input");
    const authority = await readAuthority();
    if (authority.status === "empty") return blocked("journal-not-initialized");
    if (authority.status === "blocked") return blocked("journal-unavailable");
    if (authority.record.migration !== null) {
      return runner.start(operationId, targetBackendInput);
    }
    if (
      authority.record.activeBackend !== sourceBackend ||
      targetBackendInput !== targetBackend
    ) return blocked("adapter-role-mismatch");
    return runner.start(operationId, targetBackendInput);
  };

  const validatePendingMigration = async (
    operationId: string,
  ): Promise<HoidHistoryMigrationRuntimeResult | null> => {
    if (!validId(operationId)) return blocked("invalid-input");
    const authority = await readAuthority();
    if (authority.status === "blocked") return blocked("journal-unavailable");
    if (authority.status === "empty") return null;
    const migration = authority.record.migration;
    if (migration !== null && migration.operationId !== operationId) {
      return blocked("wrong-operation");
    }
    if (
      migration !== null &&
      !migrationRolesMatch(migration, sourceBackend, targetBackend)
    ) return blocked("adapter-role-mismatch");
    return null;
  };

  const resume: HoidHistoryMigrationRuntime["resume"] = async operationId => {
    const invalid = await validatePendingMigration(operationId);
    if (invalid) return invalid;
    return runner.resume(operationId);
  };

  const abort: HoidHistoryMigrationRuntime["abort"] = async operationId => {
    const invalid = await validatePendingMigration(operationId);
    if (invalid) return invalid;
    return runner.abort(operationId);
  };

  return Object.freeze({ initialize, readAuthority, start, resume, abort });
}
