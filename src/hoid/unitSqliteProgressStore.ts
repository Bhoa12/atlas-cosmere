import {
  migrateHoidProgressV1ToV2,
  validateHoidCursorProgressSnapshot,
  type HoidCursorProgressSnapshot,
} from "./cursorProgressLedger";
import {
  ExpoSqliteHoidCursorProgressStore,
  type HoidCursorStoreLoadResult,
} from "./cursorSqliteProgressStore";
import {
  type HoidSqliteDatabasePort,
  type HoidSqliteTransactionPort,
} from "./sqliteProgressStore";
import {
  validateHoidUnitProgressSnapshot,
  type HoidUnitProgressPosition,
  type HoidUnitProgressSnapshot,
  type HoidUnitProgressStore,
} from "./unitProgressLedger";
import { createHoidUnitProgressCursor } from "./unitProgressCursor";

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

export type HoidUnitSqliteStoreLoadResult =
  | Readonly<{
      status: "ready";
      snapshot: HoidUnitProgressSnapshot;
      migratedFromV2: boolean;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "source-unavailable"
        | "source-corrupt"
        | "source-changed"
        | "source-migration-marker-missing"
        | "source-migration-marker-orphaned"
        | "unit-migration-marker-missing"
        | "unit-migration-marker-orphaned"
        | "ambiguous-v2"
        | "corrupt-v3"
        | "migration-conflict"
        | "storage-error";
      bookId?: string;
    }>;

const CREATE_V3_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS hoid_unit_progress_ledger (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    schema_version INTEGER NOT NULL CHECK (schema_version = 3),
    revision INTEGER NOT NULL CHECK (revision >= 0),
    payload TEXT NOT NULL
  )
`;
const CREATE_V2_V3_MIGRATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS hoid_unit_progress_migrations (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    source_schema_version INTEGER NOT NULL CHECK (source_schema_version = 2),
    target_schema_version INTEGER NOT NULL CHECK (target_schema_version = 3),
    source_revision INTEGER NOT NULL CHECK (source_revision >= 0),
    source_payload TEXT NOT NULL,
    migrated_at TEXT NOT NULL
  )
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
const SELECT_V1_V2_MIGRATION_SQL = `
  SELECT source_schema_version, target_schema_version, source_revision, source_payload, migrated_at
  FROM hoid_progress_migrations
  WHERE id = 1
`;
const SELECT_V3_SQL = `
  SELECT schema_version, revision, payload
  FROM hoid_unit_progress_ledger
  WHERE id = 1
`;
const SELECT_V2_V3_MIGRATION_SQL = `
  SELECT source_schema_version, target_schema_version, source_revision, source_payload, migrated_at
  FROM hoid_unit_progress_migrations
  WHERE id = 1
`;
const INSERT_V3_SQL = `
  INSERT INTO hoid_unit_progress_ledger
    (id, schema_version, revision, payload)
  VALUES (1, ?, ?, ?)
`;
const INSERT_V2_V3_MIGRATION_SQL = `
  INSERT INTO hoid_unit_progress_migrations
    (id, source_schema_version, target_schema_version, source_revision, source_payload, migrated_at)
  VALUES (1, ?, ?, ?, ?, ?)
`;
const UPDATE_V3_SQL = `
  UPDATE hoid_unit_progress_ledger
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

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
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

function decodeV3Row(row: LedgerRow | null): HoidUnitProgressSnapshot | null {
  if (
    !row ||
    row.schema_version !== 3 ||
    !Number.isSafeInteger(row.revision) ||
    row.revision < 0 ||
    typeof row.payload !== "string"
  ) return null;

  const parsed = parseJson(row.payload);
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    (parsed as Record<string, unknown>).schemaVersion !== 3 ||
    (parsed as Record<string, unknown>).revision !== row.revision
  ) return null;

  const validation = validateHoidUnitProgressSnapshot(parsed);
  return validation.status === "valid" ? validation.snapshot : null;
}

function validV1V2Migration(row: MigrationRow | null): row is MigrationRow {
  return Boolean(
    row &&
    row.source_schema_version === 1 &&
    row.target_schema_version === 2 &&
    Number.isSafeInteger(row.source_revision) &&
    row.source_revision >= 0 &&
    typeof row.source_payload === "string" &&
    canonicalTimestamp(row.migrated_at)
  );
}

function validV2V3Migration(row: MigrationRow | null): row is MigrationRow {
  return Boolean(
    row &&
    row.source_schema_version === 2 &&
    row.target_schema_version === 3 &&
    Number.isSafeInteger(row.source_revision) &&
    row.source_revision >= 0 &&
    typeof row.source_payload === "string" &&
    canonicalTimestamp(row.migrated_at)
  );
}

type SourceChainResult =
  | Readonly<{
      status: "ready";
      snapshot: HoidCursorProgressSnapshot;
      sourcePayload: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "source-corrupt"
        | "source-changed"
        | "source-migration-marker-missing"
        | "source-migration-marker-orphaned"
        | "migration-conflict";
      bookId?: string;
    }>;

/**
 * Revalidate the retained v1 -> v2 chain inside the same transaction used by
 * the v3 operation. The v2 migration receipt is a consistency guard, not an
 * authentication signature.
 */
async function readSourceChain(
  transaction: HoidSqliteTransactionPort,
): Promise<SourceChainResult> {
  const v1 = await transaction.getFirstAsync<LedgerRow>(SELECT_V1_SQL);
  const v2 = await transaction.getFirstAsync<LedgerRow>(SELECT_V2_SQL);
  const marker = await transaction.getFirstAsync<MigrationRow>(SELECT_V1_V2_MIGRATION_SQL);

  if (v2 && !marker) {
    return Object.freeze({ status: "unavailable", reason: "source-migration-marker-missing" });
  }
  if (!v2 && marker) {
    return Object.freeze({ status: "unavailable", reason: "source-migration-marker-orphaned" });
  }
  if (!v1 || !v2 || !marker || !validV1V2Migration(marker)) {
    return Object.freeze({ status: "unavailable", reason: "source-corrupt" });
  }

  if (
    v1.schema_version !== marker.source_schema_version ||
    v1.revision !== marker.source_revision ||
    v1.payload !== marker.source_payload
  ) {
    return Object.freeze({ status: "unavailable", reason: "source-changed" });
  }

  const legacy = parseJson(v1.payload);
  const validatedLegacy = await migrateHoidProgressV1ToV2(legacy);
  if (
    validatedLegacy.status !== "ready" ||
    validatedLegacy.sourceRevision !== marker.source_revision
  ) {
    return Object.freeze({
      status: "unavailable",
      reason: "source-corrupt",
      ...(validatedLegacy.status === "unavailable" && validatedLegacy.bookId
        ? { bookId: validatedLegacy.bookId }
        : {}),
    });
  }

  const snapshot = decodeV2Row(v2);
  if (!snapshot || snapshot.revision < marker.source_revision) {
    return Object.freeze({ status: "unavailable", reason: "source-corrupt" });
  }

  return Object.freeze({
    status: "ready",
    snapshot,
    sourcePayload: v2.payload,
  });
}

/** Convert every v2 position or reject the entire migration; never drop one. */
function migrateV2ToV3(source: HoidCursorProgressSnapshot): HoidUnitProgressSnapshot | null {
  const positions: HoidUnitProgressPosition[] = [];

  for (const position of source.positions) {
    if ("completed" in position) {
      positions.push(Object.freeze({
        bookId: position.bookId,
        completed: true,
        ...(position.order === undefined ? {} : { order: position.order }),
      }));
      continue;
    }

    const created = createHoidUnitProgressCursor(position.bookId, {
      chapterNumber: position.cursor.chapterNumber,
      unitId: position.cursor.unitId,
    });
    if (created.status !== "ready") return null;

    const reference = created.cursor.reference;
    if (
      reference.bookId !== position.bookId ||
      reference.chapterNumber !== position.cursor.chapterNumber ||
      reference.unitId !== position.cursor.unitId ||
      reference.ordinal !== position.cursor.ordinal
    ) return null;

    positions.push(Object.freeze({
      bookId: position.bookId,
      cursor: created.cursor,
      ...(position.order === undefined ? {} : { order: position.order }),
    }));
  }

  const validation = validateHoidUnitProgressSnapshot({
    schemaVersion: 3,
    revision: source.revision,
    positions,
    updatedAt: source.updatedAt,
  });
  return validation.status === "valid" ? validation.snapshot : null;
}

function mapV2Failure(result: Extract<HoidCursorStoreLoadResult, { status: "unavailable" }>): HoidUnitSqliteStoreLoadResult {
  const reason = result.reason;
  if (reason === "migration-source-changed") {
    return Object.freeze({ status: "unavailable", reason: "source-changed" });
  }
  if (reason === "migration-marker-missing") {
    return Object.freeze({ status: "unavailable", reason: "source-migration-marker-missing" });
  }
  if (reason === "migration-marker-orphaned") {
    return Object.freeze({ status: "unavailable", reason: "source-migration-marker-orphaned" });
  }
  if (reason === "migration-conflict") {
    return Object.freeze({ status: "unavailable", reason: "migration-conflict" });
  }
  if (reason === "storage-error") {
    return Object.freeze({ status: "unavailable", reason: "storage-error" });
  }
  return Object.freeze({
    status: "unavailable",
    reason: result.reason === "ambiguous-v1" ? "source-unavailable" : "source-corrupt",
    ...(result.bookId ? { bookId: result.bookId } : {}),
  });
}

/**
 * Durable v3 adapter. It preserves the complete v2 snapshot as an immutable
 * migration source and records its exact payload in the v2 -> v3 receipt.
 * Any later v2 write invalidates v3 reads instead of serving mixed-version
 * progress. The adapter does not activate itself in Atlas composition.
 */
export class ExpoSqliteHoidUnitProgressStore implements HoidUnitProgressStore {
  private initialization: Promise<void> | null = null;
  private readonly v2Store: ExpoSqliteHoidCursorProgressStore;

  constructor(
    private readonly database: HoidSqliteDatabasePort,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    this.v2Store = new ExpoSqliteHoidCursorProgressStore(database, now);
  }

  private ensureInitialized(): Promise<void> {
    if (this.initialization) return this.initialization;
    this.initialization = this.database.withExclusiveTransactionAsync(async transaction => {
      await transaction.execAsync(CREATE_V3_TABLE_SQL);
      await transaction.execAsync(CREATE_V2_V3_MIGRATION_TABLE_SQL);
    }).catch(error => {
      this.initialization = null;
      throw error;
    });
    return this.initialization;
  }

  async load(): Promise<HoidUnitSqliteStoreLoadResult> {
    try {
      const source = await this.v2Store.load();
      if (source.status !== "ready") return mapV2Failure(source);
      await this.ensureInitialized();
      return await this.loadAtomically();
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
    next: HoidUnitProgressSnapshot,
  ): Promise<boolean> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return false;

    const validation = validateHoidUnitProgressSnapshot(next);
    if (
      validation.status !== "valid" ||
      validation.snapshot.revision !== expectedRevision + 1
    ) return false;

    const loaded = await this.load();
    if (loaded.status !== "ready" || loaded.snapshot.revision !== expectedRevision) return false;

    const payload = JSON.stringify(validation.snapshot);
    if (typeof payload !== "string") return false;

    try {
      let updated = false;
      await this.database.withExclusiveTransactionAsync(async transaction => {
        const source = await readSourceChain(transaction);
        if (source.status !== "ready") return;

        const row = await transaction.getFirstAsync<LedgerRow>(SELECT_V3_SQL);
        const marker = await transaction.getFirstAsync<MigrationRow>(SELECT_V2_V3_MIGRATION_SQL);
        if (row && !marker) return;
        if (!row || !marker || !validV2V3Migration(marker)) return;
        if (
          marker.source_revision !== source.snapshot.revision ||
          marker.source_payload !== source.sourcePayload
        ) return;

        const current = decodeV3Row(row);
        if (
          !current ||
          current.revision < marker.source_revision ||
          current.revision !== expectedRevision
        ) return;

        const result = await transaction.runAsync(
          UPDATE_V3_SQL,
          3,
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

  private async loadAtomically(): Promise<HoidUnitSqliteStoreLoadResult> {
    let outcome: HoidUnitSqliteStoreLoadResult = Object.freeze({
      status: "unavailable",
      reason: "storage-error",
    });

    await this.database.withExclusiveTransactionAsync(async transaction => {
      const source = await readSourceChain(transaction);
      if (source.status !== "ready") {
        outcome = Object.freeze({
          status: "unavailable",
          reason: source.reason,
          ...(source.bookId ? { bookId: source.bookId } : {}),
        });
        return;
      }

      const row = await transaction.getFirstAsync<LedgerRow>(SELECT_V3_SQL);
      const marker = await transaction.getFirstAsync<MigrationRow>(SELECT_V2_V3_MIGRATION_SQL);
      if (row && !marker) {
        outcome = Object.freeze({
          status: "unavailable",
          reason: "unit-migration-marker-missing",
        });
        return;
      }
      if (!row && marker) {
        outcome = Object.freeze({
          status: "unavailable",
          reason: "unit-migration-marker-orphaned",
        });
        return;
      }

      if (row && marker) {
        if (!validV2V3Migration(marker)) {
          outcome = Object.freeze({ status: "unavailable", reason: "corrupt-v3" });
          return;
        }
        if (
          marker.source_revision !== source.snapshot.revision ||
          marker.source_payload !== source.sourcePayload
        ) {
          outcome = Object.freeze({ status: "unavailable", reason: "source-changed" });
          return;
        }
        const snapshot = decodeV3Row(row);
        if (!snapshot || snapshot.revision < marker.source_revision) {
          outcome = Object.freeze({ status: "unavailable", reason: "corrupt-v3" });
          return;
        }
        outcome = Object.freeze({
          status: "ready",
          snapshot,
          migratedFromV2: false,
        });
        return;
      }

      const migrated = migrateV2ToV3(source.snapshot);
      if (!migrated) {
        outcome = Object.freeze({ status: "unavailable", reason: "ambiguous-v2" });
        return;
      }

      let migratedAt: string;
      try {
        migratedAt = this.now();
      } catch {
        outcome = Object.freeze({ status: "unavailable", reason: "storage-error" });
        return;
      }
      if (!canonicalTimestamp(migratedAt)) {
        outcome = Object.freeze({ status: "unavailable", reason: "storage-error" });
        return;
      }

      const payload = JSON.stringify(migrated);
      if (typeof payload !== "string") {
        outcome = Object.freeze({ status: "unavailable", reason: "corrupt-v3" });
        return;
      }

      const snapshotWrite = await transaction.runAsync(
        INSERT_V3_SQL,
        3,
        migrated.revision,
        payload,
      );
      if (snapshotWrite.changes !== 1) throw new Error("Hoid unit snapshot insert failed");

      const markerWrite = await transaction.runAsync(
        INSERT_V2_V3_MIGRATION_SQL,
        2,
        3,
        source.snapshot.revision,
        source.sourcePayload,
        migratedAt,
      );
      if (markerWrite.changes !== 1) throw new Error("Hoid unit migration receipt insert failed");

      outcome = Object.freeze({
        status: "ready",
        snapshot: migrated,
        migratedFromV2: true,
      });
    });

    return outcome;
  }
}

/** The application owns the shared database handle and its lifecycle. */
export function createExpoSqliteHoidUnitProgressStore(
  database: HoidSqliteDatabasePort,
  now?: () => string,
): HoidUnitProgressStore {
  return new ExpoSqliteHoidUnitProgressStore(database, now);
}
