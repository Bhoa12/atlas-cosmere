import {
  migrateHoidProgressV1ToV2,
  validateHoidCursorProgressSnapshot,
  type HoidCursorProgressSnapshot,
} from "./cursorProgressLedger";
import {
  emptyHoidProgressLedger,
  type HoidProgressLedgerSnapshot,
} from "./progressLedger";
import { type HoidSqliteDatabasePort } from "./sqliteProgressStore";

export type HoidCursorStoreLoadResult =
  | Readonly<{
      status: "ready";
      snapshot: HoidCursorProgressSnapshot;
      migratedFromV1: boolean;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "corrupt-v1"
        | "ambiguous-v1"
        | "corrupt-v2"
        | "migration-marker-missing"
        | "migration-marker-orphaned"
        | "migration-source-changed"
        | "migration-conflict"
        | "storage-error";
      bookId?: string;
    }>;

export interface HoidCursorProgressStore {
  /** Loads v2, atomically migrating the complete v1 ledger when necessary. */
  load(): Promise<HoidCursorStoreLoadResult>;
  /** Returns a validated snapshot, or null when storage cannot be trusted. */
  read(): Promise<unknown>;
  /** Atomic revision-checked update of an already migrated v2 snapshot. */
  compareAndSwap(
    expectedRevision: number,
    next: HoidCursorProgressSnapshot,
  ): Promise<boolean>;
}

type LedgerRow = Readonly<{
  schema_version: number;
  revision: number;
  payload: string;
}>;

type MigrationRow = Readonly<{
  source_schema_version: number;
  target_schema_version: number;
  source_revision: number;
  source_payload: string;
  migrated_at: string;
}>;

const CREATE_V1_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS hoid_progress_ledger (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    schema_version INTEGER NOT NULL,
    revision INTEGER NOT NULL CHECK (revision >= 0),
    payload TEXT NOT NULL
  )
`;
const CREATE_V2_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS hoid_cursor_progress_ledger (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    schema_version INTEGER NOT NULL CHECK (schema_version = 2),
    revision INTEGER NOT NULL CHECK (revision >= 0),
    payload TEXT NOT NULL
  )
`;
const CREATE_MIGRATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS hoid_progress_migrations (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    source_schema_version INTEGER NOT NULL CHECK (source_schema_version = 1),
    target_schema_version INTEGER NOT NULL CHECK (target_schema_version = 2),
    source_revision INTEGER NOT NULL CHECK (source_revision >= 0),
    source_payload TEXT NOT NULL,
    migrated_at TEXT NOT NULL
  )
`;
const INSERT_INITIAL_V1_SQL = `
  INSERT OR IGNORE INTO hoid_progress_ledger
    (id, schema_version, revision, payload)
  VALUES (1, ?, ?, ?)
`;
const SELECT_V1_SQL = `
  SELECT schema_version, revision, payload
  FROM hoid_progress_ledger
  WHERE id = 1
`;
const SELECT_V2_SQL = `
  SELECT schema_version, revision, payload
  FROM hoid_cursor_progress_ledger
  WHERE id = 1
`;
const SELECT_MIGRATION_SQL = `
  SELECT source_schema_version, target_schema_version, source_revision, source_payload, migrated_at
  FROM hoid_progress_migrations
  WHERE id = 1
`;
const INSERT_V2_SQL = `
  INSERT INTO hoid_cursor_progress_ledger
    (id, schema_version, revision, payload)
  VALUES (1, ?, ?, ?)
`;
const INSERT_MIGRATION_SQL = `
  INSERT INTO hoid_progress_migrations
    (id, source_schema_version, target_schema_version, source_revision, source_payload, migrated_at)
  VALUES (1, ?, ?, ?, ?, ?)
`;
const UPDATE_V2_SQL = `
  UPDATE hoid_cursor_progress_ledger
  SET schema_version = ?, revision = ?, payload = ?
  WHERE id = 1 AND revision = ?
`;

function isBusy(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === "SQLITE_BUSY" || candidate.code === "SQLITE_LOCKED") return true;
  return typeof candidate.message === "string" &&
    /database is locked|SQLITE_BUSY|SQLITE_LOCKED/i.test(candidate.message);
}

function parseJson(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function decodeV1Row(row: LedgerRow | null): HoidProgressLedgerSnapshot | null {
  if (
    !row ||
    row.schema_version !== 1 ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 0 ||
    typeof row.payload !== "string"
  ) return null;

  const parsed = parseJson(row.payload);
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    (parsed as Record<string, unknown>).schemaVersion !== 1 ||
    (parsed as Record<string, unknown>).revision !== row.revision
  ) return null;

  return parsed as HoidProgressLedgerSnapshot;
}

function decodeV2Row(row: LedgerRow | null): HoidCursorProgressSnapshot | null {
  if (
    !row ||
    row.schema_version !== 2 ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 0 ||
    typeof row.payload !== "string"
  ) return null;

  const parsed = parseJson(row.payload);
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    (parsed as Record<string, unknown>).schemaVersion !== 2 ||
    (parsed as Record<string, unknown>).revision !== row.revision
  ) return null;

  const validation = validateHoidCursorProgressSnapshot(parsed);
  return validation.status === "valid" ? validation.snapshot : null;
}

function validMigrationMarker(row: MigrationRow | null): row is MigrationRow {
  return Boolean(
    row &&
    row.source_schema_version === 1 &&
    row.target_schema_version === 2 &&
    Number.isSafeInteger(row.source_revision) &&
    row.source_revision >= 0 &&
    typeof row.source_payload === "string" &&
    typeof row.migrated_at === "string" &&
    Number.isFinite(Date.parse(row.migrated_at)) &&
    new Date(Date.parse(row.migrated_at)).toISOString() === row.migrated_at
  );
}

function readUnavailableReason(
  v1Row: LedgerRow | null,
  v2Row: LedgerRow | null,
  marker: MigrationRow | null,
): HoidCursorStoreLoadResult | null {
  if (v2Row && !marker) {
    return Object.freeze({ status: "unavailable", reason: "migration-marker-missing" });
  }
  if (!v2Row && marker) {
    return Object.freeze({ status: "unavailable", reason: "migration-marker-orphaned" });
  }
  if (v2Row && marker && !validMigrationMarker(marker)) {
    return Object.freeze({ status: "unavailable", reason: "corrupt-v2" });
  }
  if (v2Row && marker) {
    const snapshot = decodeV2Row(v2Row);
    if (!snapshot || snapshot.revision < marker.source_revision) {
      return Object.freeze({ status: "unavailable", reason: "corrupt-v2" });
    }
    if (
      !v1Row ||
      v1Row.schema_version !== marker.source_schema_version ||
      v1Row.revision !== marker.source_revision ||
      v1Row.payload !== marker.source_payload
    ) {
      return Object.freeze({ status: "unavailable", reason: "migration-source-changed" });
    }
    return Object.freeze({ status: "ready", snapshot, migratedFromV1: false });
  }
  return null;
}

/**
 * Native SQLite v2 store with a one-way, non-destructive v1 migration.
 *
 * The legacy row is retained after migration. The v2 snapshot and migration
 * marker (including the exact source payload) are inserted in one exclusive
 * transaction. A later v1 write is detected and blocks v2 reads instead of
 * silently serving a stale cursor snapshot during a mixed-version rollout.
 */
export class ExpoSqliteHoidCursorProgressStore implements HoidCursorProgressStore {
  private initialization: Promise<void> | null = null;

  constructor(
    private readonly database: HoidSqliteDatabasePort,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  private ensureInitialized(): Promise<void> {
    if (this.initialization) return this.initialization;

    this.initialization = this.database.withExclusiveTransactionAsync(async transaction => {
      await transaction.execAsync(CREATE_V1_TABLE_SQL);
      await transaction.execAsync(CREATE_V2_TABLE_SQL);
      await transaction.execAsync(CREATE_MIGRATION_TABLE_SQL);
      const empty = emptyHoidProgressLedger();
      await transaction.runAsync(
        INSERT_INITIAL_V1_SQL,
        empty.schemaVersion,
        empty.revision,
        JSON.stringify(empty),
      );
    }).catch(error => {
      this.initialization = null;
      throw error;
    });

    return this.initialization;
  }

  async load(): Promise<HoidCursorStoreLoadResult> {
    try {
      await this.ensureInitialized();
      // Read v1, v2 and the receipt inside one exclusive transaction. This
      // prevents a still-running v1 writer from racing the source-divergence
      // check between separate SELECT statements.
      return await this.migrateAtomically();
    } catch (error) {
      return Object.freeze({
        status: "unavailable",
        reason: isBusy(error) ? "migration-conflict" : "storage-error",
      });
    }
  }

  async read(): Promise<unknown> {
    const result = await this.load();
    return result.status === "ready" ? result.snapshot : null;
  }

  async compareAndSwap(
    expectedRevision: number,
    next: HoidCursorProgressSnapshot,
  ): Promise<boolean> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return false;

    // Validate before reading any property from an untrusted runtime value.
    // The validator inspects own data descriptors and contains proxy traps.
    const validation = validateHoidCursorProgressSnapshot(next);
    if (
      validation.status !== "valid" ||
      validation.snapshot.revision !== expectedRevision + 1
    ) return false;

    const loaded = await this.load();
    if (loaded.status !== "ready") return false;

    const payload = JSON.stringify(validation.snapshot);
    if (typeof payload !== "string") return false;

    try {
      let updated = false;
      await this.database.withExclusiveTransactionAsync(async transaction => {
        const source = await transaction.getFirstAsync<LedgerRow>(SELECT_V1_SQL);
        const row = await transaction.getFirstAsync<LedgerRow>(SELECT_V2_SQL);
        const marker = await transaction.getFirstAsync<MigrationRow>(SELECT_MIGRATION_SQL);
        const state = readUnavailableReason(source, row, marker);
        if (state?.status !== "ready" || state.snapshot.revision !== expectedRevision) return;

        const result = await transaction.runAsync(
          UPDATE_V2_SQL,
          2,
          validation.snapshot.revision,
          payload,
          expectedRevision,
        );
        updated = result.changes === 1;
      });
      return updated;
    } catch (error) {
      if (isBusy(error)) return false;
      throw error;
    }
  }

  private async migrateAtomically(): Promise<HoidCursorStoreLoadResult> {
    let outcome: HoidCursorStoreLoadResult = Object.freeze({
      status: "unavailable",
      reason: "storage-error",
    });

    await this.database.withExclusiveTransactionAsync(async transaction => {
      const currentV1 = await transaction.getFirstAsync<LedgerRow>(SELECT_V1_SQL);
      const currentV2 = await transaction.getFirstAsync<LedgerRow>(SELECT_V2_SQL);
      const currentMarker = await transaction.getFirstAsync<MigrationRow>(SELECT_MIGRATION_SQL);
      const current = readUnavailableReason(currentV1, currentV2, currentMarker);
      if (current) {
        outcome = current;
        return;
      }

      const sourceRow = currentV1;
      const sourceSnapshot = decodeV1Row(sourceRow);
      if (!sourceSnapshot || !sourceRow) {
        outcome = Object.freeze({ status: "unavailable", reason: "corrupt-v1" });
        return;
      }

      const migration = await migrateHoidProgressV1ToV2(sourceSnapshot);
      if (migration.status !== "ready") {
        outcome = Object.freeze({
          status: "unavailable",
          reason: migration.reason === "cursor-unavailable" ? "ambiguous-v1" : "corrupt-v1",
          ...(migration.bookId ? { bookId: migration.bookId } : {}),
        });
        return;
      }

      // Re-read the source inside the same exclusive transaction. This is an
      // explicit source-revision and payload guard in addition to the DB lock.
      const confirmedSource = await transaction.getFirstAsync<LedgerRow>(SELECT_V1_SQL);
      if (
        !confirmedSource ||
        confirmedSource.revision !== sourceRow.revision ||
        confirmedSource.payload !== sourceRow.payload ||
        confirmedSource.schema_version !== sourceRow.schema_version
      ) {
        outcome = Object.freeze({ status: "unavailable", reason: "migration-conflict" });
        return;
      }

      const migratedPayload = JSON.stringify(migration.snapshot);
      if (typeof migratedPayload !== "string") {
        outcome = Object.freeze({ status: "unavailable", reason: "corrupt-v1" });
        return;
      }

      const timestamp = this.now();
      if (
        typeof timestamp !== "string" ||
        !Number.isFinite(Date.parse(timestamp)) ||
        new Date(Date.parse(timestamp)).toISOString() !== timestamp
      ) {
        outcome = Object.freeze({ status: "unavailable", reason: "storage-error" });
        return;
      }

      const snapshotWrite = await transaction.runAsync(
        INSERT_V2_SQL,
        2,
        migration.snapshot.revision,
        migratedPayload,
      );
      if (snapshotWrite.changes !== 1) throw new Error("Hoid cursor snapshot insert failed");

      const markerWrite = await transaction.runAsync(
        INSERT_MIGRATION_SQL,
        1,
        2,
        migration.sourceRevision,
        sourceRow.payload,
        timestamp,
      );
      if (markerWrite.changes !== 1) throw new Error("Hoid migration marker insert failed");

      outcome = Object.freeze({
        status: "ready",
        snapshot: migration.snapshot,
        migratedFromV1: true,
      });
    });

    return outcome;
  }
}

/** Factory for native composition roots; Expo remains outside the Hoid core. */
export function createExpoSqliteHoidCursorProgressStore(
  database: HoidSqliteDatabasePort,
  now?: () => string,
): HoidCursorProgressStore {
  return new ExpoSqliteHoidCursorProgressStore(database, now);
}
