import {
  createHoidConversationHistorySnapshot,
  hydrateHoidConversationHistorySnapshot,
} from "./conversationHistoryHydration";
import {
  HOID_CONVERSATION_STORAGE_RECORD_KIND,
  HOID_CONVERSATION_STORAGE_SCHEMA_VERSION,
  type HoidConversationHistoryStorePort,
  type HoidConversationStorageKey,
  type HoidConversationStorageRecord,
} from "./conversationHistoryStorePort";
import type { HoidSqliteDatabasePort } from "./sqliteProgressStore";

export const HOID_SQLITE_CONVERSATION_HISTORY_TABLE = "hoid_conversation_history_v1" as const;

const MAX_KEY_LENGTH = 128;
const MAX_STORAGE_REVISION = Number.MAX_SAFE_INTEGER - 1;
const MAX_PLAINTEXT_LENGTH = 750_000;
const MAX_CIPHERTEXT_LENGTH = 1_000_000;
const OPAQUE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export type HoidConversationPayloadProtectionContext = Readonly<{
  purpose: "hoid-conversation-history";
  schemaVersion: typeof HOID_CONVERSATION_STORAGE_SCHEMA_VERSION;
  principalId: string;
  conversationId: string;
  storageRevision: number;
}>;

/**
 * The host must implement authenticated encryption (AEAD), not reversible
 * encoding. Every context field must be authenticated as associated data.
 * Key creation, rotation, backup and deletion remain host responsibilities.
 */
export type HoidConversationPayloadProtector = Readonly<{
  seal: (
    plaintext: string,
    context: HoidConversationPayloadProtectionContext,
  ) => Promise<string>;
  open: (
    ciphertext: string,
    context: HoidConversationPayloadProtectionContext,
  ) => Promise<string>;
}>;

type DataRecord = Record<string, unknown>;

type ConversationRow = Readonly<{
  schema_version: number;
  storage_revision: number;
  payload_ciphertext: string;
}>;

const CREATE_TABLE_SQL = [
  "CREATE TABLE IF NOT EXISTS hoid_conversation_history_v1 (",
  "principal_id TEXT NOT NULL CHECK(length(principal_id) BETWEEN 1 AND 128),",
  "conversation_id TEXT NOT NULL CHECK(length(conversation_id) BETWEEN 1 AND 128),",
  "schema_version INTEGER NOT NULL CHECK(schema_version = 1),",
  "storage_revision INTEGER NOT NULL CHECK(storage_revision >= 1),",
  "payload_ciphertext TEXT NOT NULL CHECK(length(payload_ciphertext) BETWEEN 1 AND 1000000),",
  "PRIMARY KEY (principal_id, conversation_id)",
  ")",
].join(" ");

const SELECT_ROW_SQL = [
  "SELECT schema_version, storage_revision, payload_ciphertext",
  "FROM hoid_conversation_history_v1",
  "WHERE principal_id = ? AND conversation_id = ?",
].join(" ");

const INSERT_ROW_SQL = [
  "INSERT INTO hoid_conversation_history_v1",
  "(principal_id, conversation_id, schema_version, storage_revision, payload_ciphertext)",
  "VALUES (?, ?, ?, ?, ?)",
].join(" ");

const UPDATE_ROW_SQL = [
  "UPDATE hoid_conversation_history_v1",
  "SET schema_version = ?, storage_revision = ?, payload_ciphertext = ?",
  "WHERE principal_id = ? AND conversation_id = ? AND storage_revision = ?",
].join(" ");

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
): DataRecord | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.length) return null;

    const result = Object.create(null) as DataRecord;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
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

function canonicalStorageKey(value: unknown): HoidConversationStorageKey | null {
  const record = canonicalRecord(value, ["principalId", "conversationId"]);
  if (!record) return null;

  const principalId = record.principalId;
  const conversationId = record.conversationId;
  if (
    typeof principalId !== "string" ||
    typeof conversationId !== "string" ||
    principalId.length > MAX_KEY_LENGTH ||
    conversationId.length > MAX_KEY_LENGTH ||
    !OPAQUE_KEY_PATTERN.test(principalId) ||
    !OPAQUE_KEY_PATTERN.test(conversationId)
  ) return null;

  return Object.freeze({ principalId, conversationId });
}

function canonicalStorageRecord(
  value: unknown,
  key: HoidConversationStorageKey,
): HoidConversationStorageRecord | null {
  const record = canonicalRecord(value, [
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
    record.principalId !== key.principalId ||
    record.conversationId !== key.conversationId ||
    typeof record.storageRevision !== "number" ||
    !Number.isSafeInteger(record.storageRevision) ||
    record.storageRevision < 1 ||
    record.storageRevision > MAX_STORAGE_REVISION
  ) return null;

  const snapshotRecord = canonicalRecord(record.snapshot, [
    "schemaVersion",
    "kind",
    "progressScope",
    "messages",
  ]);
  if (!snapshotRecord) return null;

  const hydrated = hydrateHoidConversationHistorySnapshot(
    record.snapshot,
    snapshotRecord.progressScope,
  );
  if (hydrated.status !== "ready") return null;

  const canonicalSnapshot = createHoidConversationHistorySnapshot(
    hydrated.messages,
    hydrated.savedProgressScope,
  );
  if (canonicalSnapshot.status !== "ready") return null;

  return Object.freeze({
    schemaVersion: HOID_CONVERSATION_STORAGE_SCHEMA_VERSION,
    kind: HOID_CONVERSATION_STORAGE_RECORD_KIND,
    principalId: key.principalId,
    conversationId: key.conversationId,
    storageRevision: record.storageRevision,
    snapshot: canonicalSnapshot.snapshot,
  });
}

function canonicalProtector(value: unknown): HoidConversationPayloadProtector | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== 2 || !keys.includes("seal") || !keys.includes("open")) return null;

    const sealDescriptor = Object.getOwnPropertyDescriptor(value, "seal");
    const openDescriptor = Object.getOwnPropertyDescriptor(value, "open");
    if (
      !sealDescriptor ||
      !openDescriptor ||
      !Object.prototype.hasOwnProperty.call(sealDescriptor, "value") ||
      !Object.prototype.hasOwnProperty.call(openDescriptor, "value") ||
      sealDescriptor.enumerable !== true ||
      openDescriptor.enumerable !== true ||
      typeof sealDescriptor.value !== "function" ||
      typeof openDescriptor.value !== "function"
    ) return null;

    const sealMethod = sealDescriptor.value as HoidConversationPayloadProtector["seal"];
    const openMethod = openDescriptor.value as HoidConversationPayloadProtector["open"];
    return Object.freeze({
      seal: (plaintext: string, context: HoidConversationPayloadProtectionContext) =>
        sealMethod.call(value, plaintext, context),
      open: (ciphertext: string, context: HoidConversationPayloadProtectionContext) =>
        openMethod.call(value, ciphertext, context),
    });
  } catch {
    return null;
  }
}

function validExpectedRevision(value: unknown): value is number | null {
  return value === null || (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value < MAX_STORAGE_REVISION
  );
}

function protectionContext(
  key: HoidConversationStorageKey,
  storageRevision: number,
): HoidConversationPayloadProtectionContext {
  return Object.freeze({
    purpose: "hoid-conversation-history",
    schemaVersion: HOID_CONVERSATION_STORAGE_SCHEMA_VERSION,
    principalId: key.principalId,
    conversationId: key.conversationId,
    storageRevision,
  });
}

function canonicalRow(value: unknown): ConversationRow | null {
  const row = canonicalRecord(value, [
    "schema_version",
    "storage_revision",
    "payload_ciphertext",
  ]);
  if (
    !row ||
    row.schema_version !== HOID_CONVERSATION_STORAGE_SCHEMA_VERSION ||
    typeof row.storage_revision !== "number" ||
    !Number.isSafeInteger(row.storage_revision) ||
    row.storage_revision < 1 ||
    row.storage_revision > MAX_STORAGE_REVISION ||
    typeof row.payload_ciphertext !== "string" ||
    row.payload_ciphertext.length === 0 ||
    row.payload_ciphertext.length > MAX_CIPHERTEXT_LENGTH
  ) return null;

  return Object.freeze({
    schema_version: row.schema_version,
    storage_revision: row.storage_revision,
    payload_ciphertext: row.payload_ciphertext,
  });
}

function isSqliteBusyError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === "SQLITE_BUSY" || candidate.code === "SQLITE_LOCKED") return true;
  return typeof candidate.message === "string" &&
    /database is locked|SQLITE_BUSY|SQLITE_LOCKED/i.test(candidate.message);
}

class ExpoSqliteHoidConversationHistoryAdapter {
  private initialization: Promise<void> | null = null;

  constructor(
    private readonly database: HoidSqliteDatabasePort,
    private readonly protector: HoidConversationPayloadProtector,
  ) {}

  private ensureInitialized(): Promise<void> {
    if (this.initialization) return this.initialization;

    this.initialization = this.database.withExclusiveTransactionAsync(async transaction => {
      await transaction.execAsync(CREATE_TABLE_SQL);
    }).catch(error => {
      this.initialization = null;
      throw error;
    });

    return this.initialization;
  }

  private async decodeRow(
    value: unknown,
    key: HoidConversationStorageKey,
  ): Promise<HoidConversationStorageRecord | null> {
    const row = canonicalRow(value);
    if (!row) return null;

    const context = protectionContext(key, row.storage_revision);
    const plaintext = await this.protector.open(row.payload_ciphertext, context);
    if (typeof plaintext !== "string" || plaintext.length > MAX_PLAINTEXT_LENGTH) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(plaintext) as unknown;
    } catch {
      return null;
    }

    const record = canonicalStorageRecord(parsed, key);
    if (
      !record ||
      record.schemaVersion !== row.schema_version ||
      record.storageRevision !== row.storage_revision
    ) return null;

    return record;
  }

  async read(keyInput: HoidConversationStorageKey): Promise<unknown | null> {
    const key = canonicalStorageKey(keyInput);
    if (!key) return Object.freeze({ invalidStorageKey: true });

    await this.ensureInitialized();
    const row = await this.database.getFirstAsync<unknown>(
      SELECT_ROW_SQL,
      key.principalId,
      key.conversationId,
    );
    if (row === null) return null;

    const decoded = await this.decodeRow(row, key);
    return decoded ?? Object.freeze({ invalidStorageRecord: true });
  }

  async compareAndSwap(
    keyInput: HoidConversationStorageKey,
    expectedStorageRevision: number | null,
    nextRecordInput: HoidConversationStorageRecord,
  ): Promise<"saved" | "conflict"> {
    const key = canonicalStorageKey(keyInput);
    if (!key || !validExpectedRevision(expectedStorageRevision)) return "conflict";

    const nextRecord = canonicalStorageRecord(nextRecordInput, key);
    const nextRevision = expectedStorageRevision === null
      ? 1
      : expectedStorageRevision + 1;
    if (!nextRecord || nextRecord.storageRevision !== nextRevision) return "conflict";

    await this.ensureInitialized();

    const plaintext = JSON.stringify(nextRecord);
    if (typeof plaintext !== "string" || plaintext.length > MAX_PLAINTEXT_LENGTH) {
      throw new Error("Hoid conversation record exceeds the serialized payload limit");
    }

    const ciphertext = await this.protector.seal(
      plaintext,
      protectionContext(key, nextRecord.storageRevision),
    );
    if (
      typeof ciphertext !== "string" ||
      ciphertext.length === 0 ||
      ciphertext.length > MAX_CIPHERTEXT_LENGTH
    ) throw new Error("Hoid conversation payload protector returned an invalid ciphertext");

    let outcome: "saved" | "conflict" = "conflict";
    try {
      await this.database.withExclusiveTransactionAsync(async transaction => {
        const currentRow = await transaction.getFirstAsync<unknown>(
          SELECT_ROW_SQL,
          key.principalId,
          key.conversationId,
        );

        if (currentRow === null) {
          if (expectedStorageRevision !== null) return;
          const inserted = await transaction.runAsync(
            INSERT_ROW_SQL,
            key.principalId,
            key.conversationId,
            nextRecord.schemaVersion,
            nextRecord.storageRevision,
            ciphertext,
          );
          outcome = inserted.changes === 1 ? "saved" : "conflict";
          return;
        }

        const currentRecord = await this.decodeRow(currentRow, key);
        if (
          !currentRecord ||
          expectedStorageRevision === null ||
          currentRecord.storageRevision !== expectedStorageRevision
        ) return;

        const updated = await transaction.runAsync(
          UPDATE_ROW_SQL,
          nextRecord.schemaVersion,
          nextRecord.storageRevision,
          ciphertext,
          key.principalId,
          key.conversationId,
          expectedStorageRevision,
        );
        outcome = updated.changes === 1 ? "saved" : "conflict";
      });
    } catch (error) {
      if (isSqliteBusyError(error)) return "conflict";
      throw error;
    }

    return outcome;
  }
}

/**
 * Creates the SQLite implementation of the provider-neutral history port.
 *
 * The supplied protector must use authenticated encryption and bind the
 * complete protection context as AEAD associated data. This adapter never
 * stores plaintext JSON. It is not production-ready until the host supplies
 * a reviewed Keychain/Keystore-backed protector and native device tests pass.
 */
export function createExpoSqliteHoidConversationHistoryStore(
  database: HoidSqliteDatabasePort,
  protectorInput: unknown,
): HoidConversationHistoryStorePort {
  const protector = canonicalProtector(protectorInput);
  if (!protector) throw new TypeError("Invalid Hoid conversation payload protector");

  const adapter = new ExpoSqliteHoidConversationHistoryAdapter(database, protector);
  return Object.freeze({
    read: (key: HoidConversationStorageKey) => adapter.read(key),
    compareAndSwap: (
      key: HoidConversationStorageKey,
      expectedStorageRevision: number | null,
      nextRecord: HoidConversationStorageRecord,
    ) => adapter.compareAndSwap(key, expectedStorageRevision, nextRecord),
  });
}
