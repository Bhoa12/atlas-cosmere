import type { HoidHistoryBackendKind } from "./conversationHistoryAuthorityJournal";
import {
  HOID_HISTORY_MIGRATION_SNAPSHOT_SCHEMA_VERSION,
  type HoidHistoryMigrationTransferPort,
} from "./conversationHistoryMigrationRunner";
import {
  createHoidConversationHistorySnapshotCodec,
  type HoidConversationHistorySnapshotCodec,
} from "./conversationHistorySnapshotCodec";
import type { HoidHistoryMigrationSnapshotPort } from "./conversationHistoryMigrationSnapshotPort";
import { sha256Hex } from "./sha256";

const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA256_HEX = /^[a-f0-9]{64}$/u;
const MAX_COUNTER = Number.MAX_SAFE_INTEGER - 1;
const EMPTY_HISTORY_DIGEST = sha256Hex("hoid-conversation-history-empty-v1");

type DataRecord = Record<string, unknown>;
type SnapshotRead =
  | Readonly<{ status: "empty"; revision: number; digest: string }>
  | Readonly<{ status: "ready"; revision: number; snapshot: unknown; digest: string }>;

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

function validId(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_ID.test(value);
}

function validBackend(value: unknown): value is HoidHistoryBackendKind {
  return value === "sqlite-history-v1" || value === "vault-history-v1";
}

function canonicalSnapshotPort(value: unknown): HoidHistoryMigrationSnapshotPort | null {
  const record = exactDataRecord(value, ["partitionId", "kind", "role", "read", "replace", "clear"]);
  if (
    !record ||
    !validId(record.partitionId) ||
    !validBackend(record.kind) ||
    (record.role !== "source" && record.role !== "target") ||
    typeof record.read !== "function" ||
    typeof record.replace !== "function" ||
    typeof record.clear !== "function"
  ) return null;

  const read = record.read as HoidHistoryMigrationSnapshotPort["read"];
  const replace = record.replace as HoidHistoryMigrationSnapshotPort["replace"];
  const clear = record.clear as HoidHistoryMigrationSnapshotPort["clear"];
  return Object.freeze({
    partitionId: record.partitionId,
    kind: record.kind,
    role: record.role,
    read: input => read.call(value, input),
    replace: input => replace.call(value, input),
    clear: input => clear.call(value, input),
  });
}

function canonicalCodec(value: unknown): HoidConversationHistorySnapshotCodec | null {
  const record = exactDataRecord(value, [
    "kind",
    "schemaVersion",
    "encode",
    "decode",
    "digest",
    "canonicalize",
  ]);
  if (
    !record ||
    record.kind !== "hoid-history-snapshot-codec" ||
    record.schemaVersion !== 1 ||
    typeof record.encode !== "function" ||
    typeof record.decode !== "function" ||
    typeof record.digest !== "function" ||
    typeof record.canonicalize !== "function"
  ) return null;

  const encode = record.encode as HoidConversationHistorySnapshotCodec["encode"];
  const decode = record.decode as HoidConversationHistorySnapshotCodec["decode"];
  const digest = record.digest as HoidConversationHistorySnapshotCodec["digest"];
  const canonicalize = record.canonicalize as HoidConversationHistorySnapshotCodec["canonicalize"];
  return Object.freeze({
    kind: "hoid-history-snapshot-codec" as const,
    schemaVersion: 1 as const,
    encode: snapshot => encode.call(value, snapshot),
    decode: plaintext => decode.call(value, plaintext),
    digest: snapshot => digest.call(value, snapshot),
    canonicalize: snapshot => canonicalize.call(value, snapshot),
  });
}

function canonicalOperation(value: unknown): Readonly<{
  partitionId: string;
  operationId: string;
  generation: number;
  sourceBackend: HoidHistoryBackendKind;
  targetBackend: HoidHistoryBackendKind;
}> | null {
  const record = exactDataRecord(value, [
    "partitionId",
    "operationId",
    "generation",
    "sourceBackend",
    "targetBackend",
  ]);
  if (
    !record ||
    !validId(record.partitionId) ||
    !validId(record.operationId) ||
    !validCounter(record.generation) ||
    !validBackend(record.sourceBackend) ||
    !validBackend(record.targetBackend) ||
    record.sourceBackend === record.targetBackend
  ) return null;
  return Object.freeze({
    partitionId: record.partitionId,
    operationId: record.operationId,
    generation: record.generation,
    sourceBackend: record.sourceBackend,
    targetBackend: record.targetBackend,
  });
}

function canonicalVerifyInput(value: unknown): Readonly<{
  partitionId: string;
  operationId: string;
  generation: number;
  sourceBackend: HoidHistoryBackendKind;
  targetBackend: HoidHistoryBackendKind;
  sourceRevision: number;
  targetRevision: number;
  sourceDigest: string;
  targetDigest: string;
}> | null {
  const record = exactDataRecord(value, [
    "partitionId",
    "operationId",
    "generation",
    "sourceBackend",
    "targetBackend",
    "sourceRevision",
    "targetRevision",
    "sourceDigest",
    "targetDigest",
  ]);
  if (
    !record ||
    !validId(record.partitionId) ||
    !validId(record.operationId) ||
    !validCounter(record.generation) ||
    !validBackend(record.sourceBackend) ||
    !validBackend(record.targetBackend) ||
    record.sourceBackend === record.targetBackend ||
    !validCounter(record.sourceRevision) ||
    !validCounter(record.targetRevision) ||
    typeof record.sourceDigest !== "string" ||
    !SHA256_HEX.test(record.sourceDigest) ||
    typeof record.targetDigest !== "string" ||
    !SHA256_HEX.test(record.targetDigest) ||
    record.sourceDigest !== record.targetDigest
  ) return null;
  return Object.freeze({
    partitionId: record.partitionId,
    operationId: record.operationId,
    generation: record.generation,
    sourceBackend: record.sourceBackend,
    targetBackend: record.targetBackend,
    sourceRevision: record.sourceRevision,
    targetRevision: record.targetRevision,
    sourceDigest: record.sourceDigest,
    targetDigest: record.targetDigest,
  });
}

function canonicalReadResult(value: unknown): Readonly<{
  status: "empty" | "ready";
  revision: number;
  snapshot?: unknown;
}> | null {
  const statusDescriptor = value !== null && typeof value === "object"
    ? Object.getOwnPropertyDescriptor(value, "status")
    : undefined;
  if (
    !statusDescriptor ||
    !Object.prototype.hasOwnProperty.call(statusDescriptor, "value") ||
    statusDescriptor.enumerable !== true
  ) return null;

  if (statusDescriptor.value === "empty") {
    const record = exactDataRecord(value, ["status", "revision"]);
    if (!record || !validCounter(record.revision)) return null;
    return Object.freeze({ status: "empty", revision: record.revision });
  }
  if (statusDescriptor.value === "ready") {
    const record = exactDataRecord(value, ["status", "revision", "snapshot"]);
    if (!record || !validCounter(record.revision) || record.revision < 1) return null;
    return Object.freeze({
      status: "ready",
      revision: record.revision,
      snapshot: record.snapshot,
    });
  }
  return null;
}

function canonicalWriteResult(value: unknown, expectedRevision: number): Readonly<{
  status: "saved" | "cleared" | "conflict";
  revision: number | null;
}> | null {
  const statusDescriptor = value !== null && typeof value === "object"
    ? Object.getOwnPropertyDescriptor(value, "status")
    : undefined;
  if (
    !statusDescriptor ||
    !Object.prototype.hasOwnProperty.call(statusDescriptor, "value") ||
    statusDescriptor.enumerable !== true
  ) return null;

  if (statusDescriptor.value === "saved" || statusDescriptor.value === "cleared") {
    const record = exactDataRecord(value, ["status", "revision"]);
    if (
      !record ||
      !validCounter(record.revision) ||
      record.revision !== expectedRevision + 1
    ) return null;
    return Object.freeze({
      status: statusDescriptor.value,
      revision: record.revision,
    });
  }
  if (statusDescriptor.value === "conflict") {
    const record = exactDataRecord(value, ["status", "revision"]);
    if (!(record && (record.revision === null || validCounter(record.revision)))) return null;
    return Object.freeze({ status: "conflict", revision: record.revision });
  }
  return null;
}

/**
 * Builds the runner transfer port from the migration-only capabilities returned
 * by the SQLite and Vault generation-fenced adapters.
 *
 * Source and target are read only while fenced. The target is replaced with
 * revision CAS; retries detect an already-copied digest and do not write twice.
 * Verification independently re-reads both sides after the copy.
 */
export function createHoidHistoryMigrationSnapshotTransferAdapter(
  input: unknown,
): HoidHistoryMigrationTransferPort | null {
  const config = exactDataRecord(input, ["partitionId", "sqlite", "vault", "codec"]);
  if (!config || !validId(config.partitionId)) return null;

  const sqlite = canonicalSnapshotPort(config.sqlite);
  const vault = canonicalSnapshotPort(config.vault);
  const codec = canonicalCodec(config.codec);
  if (
    !sqlite ||
    !vault ||
    !codec ||
    sqlite.kind !== "sqlite-history-v1" ||
    vault.kind !== "vault-history-v1" ||
    sqlite.partitionId !== config.partitionId ||
    vault.partitionId !== config.partitionId
  ) return null;

  const backendFor = (kind: HoidHistoryBackendKind) =>
    kind === "sqlite-history-v1" ? sqlite : vault;

  const readSnapshot = async (
    backend: HoidHistoryMigrationSnapshotPort,
    operationId: string,
    generation: number,
  ): Promise<SnapshotRead> => {
    const raw = await backend.read({ operationId, generation });
    const read = canonicalReadResult(raw);
    if (!read) throw new Error("Migration snapshot read blocked or invalid");
    if (read.status === "empty") {
      return Object.freeze({
        status: "empty",
        revision: read.revision,
        digest: EMPTY_HISTORY_DIGEST,
      });
    }
    const canonical = codec.canonicalize(read.snapshot);
    if (!canonical) throw new Error("Migration source snapshot is invalid");
    const digest = codec.digest(canonical);
    if (typeof digest !== "string" || !SHA256_HEX.test(digest)) {
      throw new Error("Migration snapshot digest unavailable");
    }
    return Object.freeze({
      status: "ready",
      revision: read.revision,
      snapshot: canonical,
      digest,
    });
  };

  const copy: HoidHistoryMigrationTransferPort["copy"] = async rawInput => {
    const operation = canonicalOperation(rawInput);
    if (!operation || operation.partitionId !== config.partitionId) {
      throw new Error("Invalid migration operation");
    }

    const sourceBackend = backendFor(operation.sourceBackend);
    const targetBackend = backendFor(operation.targetBackend);
    if (sourceBackend.role !== "source" || targetBackend.role !== "target") {
      throw new Error("Migration capabilities are bound to the wrong roles");
    }
    const source = await readSnapshot(sourceBackend, operation.operationId, operation.generation);
    let target = await readSnapshot(targetBackend, operation.operationId, operation.generation);

    if (source.status === "empty") {
      if (target.status === "ready") {
        const rawClear = await targetBackend.clear({
          operationId: operation.operationId,
          generation: operation.generation,
          expectedRevision: target.revision,
        });
        const cleared = canonicalWriteResult(rawClear, target.revision);
        if (!cleared || cleared.status !== "cleared") {
          throw new Error("Target backend cannot clear the previous snapshot");
        }
        target = await readSnapshot(targetBackend, operation.operationId, operation.generation);
      }
    } else if (target.status !== "ready" || target.digest !== source.digest) {
      const rawWrite = await targetBackend.replace({
        operationId: operation.operationId,
        generation: operation.generation,
        expectedRevision: target.revision,
        snapshot: source.snapshot,
      });
      const written = canonicalWriteResult(rawWrite, target.revision);
      if (!written || written.status !== "saved") {
        throw new Error("Target backend rejected the snapshot replacement");
      }
      target = await readSnapshot(targetBackend, operation.operationId, operation.generation);
    }

    if (target.digest !== source.digest) {
      throw new Error("Target snapshot differs after migration copy");
    }
    return Object.freeze({
      schemaVersion: HOID_HISTORY_MIGRATION_SNAPSHOT_SCHEMA_VERSION,
      sourceRevision: source.revision,
      targetRevision: target.revision,
      sourceDigest: source.digest,
      targetDigest: target.digest,
    });
  };

  const verify: HoidHistoryMigrationTransferPort["verify"] = async rawInput => {
    const inputRecord = canonicalVerifyInput(rawInput);
    if (!inputRecord || inputRecord.partitionId !== config.partitionId) {
      throw new Error("Invalid migration verification request");
    }
    const sourceBackend = backendFor(inputRecord.sourceBackend);
    const targetBackend = backendFor(inputRecord.targetBackend);
    if (sourceBackend.role !== "source" || targetBackend.role !== "target") {
      throw new Error("Migration capabilities are bound to the wrong roles");
    }
    const source = await readSnapshot(
      sourceBackend,
      inputRecord.operationId,
      inputRecord.generation,
    );
    const target = await readSnapshot(
      targetBackend,
      inputRecord.operationId,
      inputRecord.generation,
    );
    if (
      source.revision !== inputRecord.sourceRevision ||
      source.digest !== inputRecord.sourceDigest ||
      target.revision !== inputRecord.targetRevision ||
      target.digest !== inputRecord.targetDigest ||
      source.digest !== target.digest
    ) throw new Error("Migration snapshot verification failed");

    return Object.freeze({
      schemaVersion: HOID_HISTORY_MIGRATION_SNAPSHOT_SCHEMA_VERSION,
      targetRevision: target.revision,
      targetDigest: target.digest,
    });
  };

  return Object.freeze({ copy, verify });
}

/** Exposed for deterministic tests and diagnostics; not an authentication tag. */
export function getHoidEmptyHistoryMigrationDigest(): string {
  return EMPTY_HISTORY_DIGEST;
}

/** Default codec factory used by composition roots that do not inject one. */
export function createDefaultHoidHistoryMigrationSnapshotCodec(): HoidConversationHistorySnapshotCodec {
  return createHoidConversationHistorySnapshotCodec();
}
