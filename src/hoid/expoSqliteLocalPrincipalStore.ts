import type { HoidSqliteDatabasePort } from "./sqliteProgressStore";
import {
  HOID_LOCAL_PRINCIPAL_IDENTITY_KIND,
  HOID_LOCAL_PRINCIPAL_IDENTITY_SCHEMA_VERSION,
  isHoidLocalPrincipalId,
  type HoidLocalPrincipalIdentityRecord,
  type HoidLocalPrincipalIdentityStorePort,
} from "./localPrincipalIdentity";

export const HOID_SQLITE_LOCAL_PRINCIPAL_TABLE = "hoid_local_principal_identity_v1" as const;

type DataRecord = Record<string, unknown>;
type IdentityRow = Readonly<{
  schema_version: number;
  principal_id: string;
}>;

const CREATE_TABLE_SQL = [
  "CREATE TABLE IF NOT EXISTS hoid_local_principal_identity_v1 (",
  "identity_slot INTEGER PRIMARY KEY NOT NULL CHECK(identity_slot = 1),",
  "schema_version INTEGER NOT NULL CHECK(schema_version = 1),",
  "principal_id TEXT NOT NULL UNIQUE CHECK(length(principal_id) = 53)",
  ")",
].join(" ");

const SELECT_IDENTITY_SQL = [
  "SELECT schema_version, principal_id",
  "FROM hoid_local_principal_identity_v1",
  "WHERE identity_slot = 1",
].join(" ");

const INSERT_IDENTITY_SQL = [
  "INSERT OR IGNORE INTO hoid_local_principal_identity_v1",
  "(identity_slot, schema_version, principal_id)",
  "VALUES (1, ?, ?)",
].join(" ");

function canonicalRecord(value: unknown, allowedKeys: readonly string[]): DataRecord | null {
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

function canonicalCandidate(value: unknown): HoidLocalPrincipalIdentityRecord | null {
  const record = canonicalRecord(value, ["schemaVersion", "kind", "principalId"]);
  if (
    !record ||
    record.schemaVersion !== HOID_LOCAL_PRINCIPAL_IDENTITY_SCHEMA_VERSION ||
    record.kind !== HOID_LOCAL_PRINCIPAL_IDENTITY_KIND ||
    !isHoidLocalPrincipalId(record.principalId)
  ) return null;

  return Object.freeze({
    schemaVersion: HOID_LOCAL_PRINCIPAL_IDENTITY_SCHEMA_VERSION,
    kind: HOID_LOCAL_PRINCIPAL_IDENTITY_KIND,
    principalId: record.principalId,
  });
}

function canonicalRow(value: unknown): IdentityRow | null {
  const row = canonicalRecord(value, ["schema_version", "principal_id"]);
  if (
    !row ||
    row.schema_version !== HOID_LOCAL_PRINCIPAL_IDENTITY_SCHEMA_VERSION ||
    !isHoidLocalPrincipalId(row.principal_id)
  ) return null;

  return Object.freeze({
    schema_version: row.schema_version,
    principal_id: row.principal_id,
  });
}

class ExpoSqliteHoidLocalPrincipalStore {
  private initialization: Promise<void> | null = null;

  constructor(private readonly database: HoidSqliteDatabasePort) {}

  private ensureInitialized(): Promise<void> {
    if (this.initialization) return this.initialization;
    this.initialization = this.database
      .withExclusiveTransactionAsync(async transaction => {
        await transaction.execAsync(CREATE_TABLE_SQL);
      })
      .catch(error => {
        this.initialization = null;
        throw error;
      });
    return this.initialization;
  }

  async read(): Promise<unknown | null> {
    await this.ensureInitialized();
    const row = await this.database.getFirstAsync<unknown>(SELECT_IDENTITY_SQL);
    if (row === null) return null;

    const canonical = canonicalRow(row);
    if (!canonical) return Object.freeze({ invalidIdentityRecord: true });

    return Object.freeze({
      schemaVersion: HOID_LOCAL_PRINCIPAL_IDENTITY_SCHEMA_VERSION,
      kind: HOID_LOCAL_PRINCIPAL_IDENTITY_KIND,
      principalId: canonical.principal_id,
    });
  }

  async createIfAbsent(candidateInput: HoidLocalPrincipalIdentityRecord): Promise<"created" | "exists"> {
    const candidate = canonicalCandidate(candidateInput);
    if (!candidate) throw new TypeError("Invalid Hoid local principal identity record");

    await this.ensureInitialized();
    let outcome: "created" | "exists" = "exists";
    await this.database.withExclusiveTransactionAsync(async transaction => {
      const result = await transaction.runAsync(
        INSERT_IDENTITY_SQL,
        candidate.schemaVersion,
        candidate.principalId,
      );
      outcome = result.changes === 1 ? "created" : "exists";
    });
    return outcome;
  }
}

/**
 * SQLite stores one pseudonymous installation-local principal ID. It is not
 * a login credential, account ID, encryption key or cross-device identity.
 * The caller must use getExpoHoidDatabase() so all Hoid stores share a handle.
 */
export function createExpoSqliteHoidLocalPrincipalStore(
  database: HoidSqliteDatabasePort,
): HoidLocalPrincipalIdentityStorePort {
  const adapter = new ExpoSqliteHoidLocalPrincipalStore(database);
  return Object.freeze({
    read: () => adapter.read(),
    createIfAbsent: (record: HoidLocalPrincipalIdentityRecord) =>
      adapter.createIfAbsent(record),
  });
}
