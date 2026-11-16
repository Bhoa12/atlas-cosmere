import {
  emptyHoidProgressLedger,
  type HoidProgressLedgerSnapshot,
  type HoidProgressStore,
} from "./progressLedger";

/**
 * Structural subset of Expo SQLite's async API. Hoid does not import the
 * Expo SDK, so tests and alternative SQLite hosts can inject the same port.
 */
export type HoidSqliteBindValue = string | number | null | boolean | Uint8Array;

export type HoidSqliteRunResult = Readonly<{ changes: number }>;

export interface HoidSqliteTransactionPort {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: HoidSqliteBindValue[]): Promise<HoidSqliteRunResult>;
  getFirstAsync<T>(source: string, ...params: HoidSqliteBindValue[]): Promise<T | null>;
}

export interface HoidSqliteDatabasePort extends HoidSqliteTransactionPort {
  /**
   * Must provide an exclusive SQLite write transaction on native platforms.
   * Every query in the callback must use the supplied transaction object.
   */
  withExclusiveTransactionAsync(
    task: (transaction: HoidSqliteTransactionPort) => Promise<void>,
  ): Promise<void>;
}

type LedgerRow = Readonly<{
  schema_version: number;
  revision: number;
  payload: string;
}>;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS hoid_progress_ledger (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    schema_version INTEGER NOT NULL,
    revision INTEGER NOT NULL CHECK (revision >= 0),
    payload TEXT NOT NULL
  )
`;
const INSERT_INITIAL_SQL = `
  INSERT OR IGNORE INTO hoid_progress_ledger
    (id, schema_version, revision, payload)
  VALUES (1, ?, ?, ?)
`;
const SELECT_LEDGER_SQL = `
  SELECT schema_version, revision, payload
  FROM hoid_progress_ledger
  WHERE id = 1
`;
const UPDATE_LEDGER_SQL = `
  UPDATE hoid_progress_ledger
  SET schema_version = ?, revision = ?, payload = ?
  WHERE id = 1 AND revision = ?
`;

function isSqliteBusyError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === "SQLITE_BUSY" || candidate.code === "SQLITE_LOCKED") return true;
  return typeof candidate.message === "string"
    && /database is locked|SQLITE_BUSY|SQLITE_LOCKED/i.test(candidate.message);
}

/**
 * Durable, single-device progress storage backed by Expo SQLite.
 *
 * Atomic compare-and-swap is implemented inside an exclusive SQLite
 * transaction. This coordinates writers that share the same database file;
 * it is not cloud or cross-device synchronization.
 */
export class ExpoSqliteHoidProgressStore implements HoidProgressStore {
  private initialization: Promise<void> | null = null;

  constructor(private readonly database: HoidSqliteDatabasePort) {}

  private ensureInitialized(): Promise<void> {
    if (this.initialization) return this.initialization;

    this.initialization = this.database.withExclusiveTransactionAsync(async transaction => {
      await transaction.execAsync(CREATE_TABLE_SQL);
      const empty = emptyHoidProgressLedger();
      await transaction.runAsync(
        INSERT_INITIAL_SQL,
        empty.schemaVersion,
        empty.revision,
        JSON.stringify(empty),
      );
    }).catch(error => {
      // A failed migration must be retryable on the next operation.
      this.initialization = null;
      throw error;
    });

    return this.initialization;
  }

  async read(): Promise<unknown> {
    await this.ensureInitialized();
    const row = await this.database.getFirstAsync<LedgerRow>(SELECT_LEDGER_SQL);
    if (!row) return null;

    if (
      row.schema_version !== 1 ||
      !Number.isSafeInteger(row.revision) ||
      row.revision < 0 ||
      typeof row.payload !== "string"
    ) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(row.payload) as unknown;
    } catch {
      return null;
    }

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const snapshot = parsed as Record<string, unknown>;
    if (snapshot.schemaVersion !== row.schema_version || snapshot.revision !== row.revision) return null;

    // The Progress Ledger performs the complete canonical shape and
    // edition-bound validation. This adapter only verifies its SQL envelope.
    return parsed;
  }

  async compareAndSwap(
    expectedRevision: number,
    next: HoidProgressLedgerSnapshot,
  ): Promise<boolean> {
    await this.ensureInitialized();

    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      next.schemaVersion !== 1 ||
      next.revision !== expectedRevision + 1
    ) {
      throw new Error("Invalid Hoid progress compare-and-swap request");
    }

    const payload = JSON.stringify(next);
    if (typeof payload !== "string") {
      throw new Error("Hoid progress snapshot is not serializable");
    }

    let updated = false;
    try {
      await this.database.withExclusiveTransactionAsync(async transaction => {
        const current = await transaction.getFirstAsync<{ revision: number }>(SELECT_LEDGER_SQL);
        if (!current || current.revision !== expectedRevision) return;

        const result = await transaction.runAsync(
          UPDATE_LEDGER_SQL,
          next.schemaVersion,
          next.revision,
          payload,
          expectedRevision,
        );
        updated = result.changes === 1;
      });
    } catch (error) {
      // Expo SQLite can report SQLITE_BUSY when another connection wins the
      // write lock. Treat it as a retryable conflict, never as a successful write.
      if (isSqliteBusyError(error)) return false;
      throw error;
    }

    return updated;
  }
}

/** Factory kept explicit so the app owns database opening and lifecycle. */
export function createExpoSqliteHoidProgressStore(
  database: HoidSqliteDatabasePort,
): HoidProgressStore {
  return new ExpoSqliteHoidProgressStore(database);
}
