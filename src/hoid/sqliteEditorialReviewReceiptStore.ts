import {
  getDefaultHoidEditorialReviewReceiptSnapshot,
  validateHoidEditorialReviewReceiptSnapshot,
  type HoidEditorialReviewReceiptSnapshot,
  type HoidEditorialReviewReceiptStorePort,
} from "./editorialReviewReceiptStore";
import type {
  HoidSqliteBindValue,
  HoidSqliteDatabasePort,
  HoidSqliteRunResult,
  HoidSqliteTransactionPort,
} from "./sqliteProgressStore";

type ReceiptRow = Readonly<{
  schema_version: number;
  revision: number;
  payload: string;
}>;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS hoid_editorial_review_receipts_v1 (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    schema_version INTEGER NOT NULL CHECK (schema_version = 1),
    revision INTEGER NOT NULL CHECK (revision >= 0),
    payload TEXT NOT NULL
  )
`;
const INSERT_INITIAL_SQL = `
  INSERT OR IGNORE INTO hoid_editorial_review_receipts_v1
    (id, schema_version, revision, payload)
  VALUES (1, ?, ?, ?)
`;
const SELECT_RECEIPTS_SQL = `
  SELECT schema_version, revision, payload
  FROM hoid_editorial_review_receipts_v1
  WHERE id = 1
`;
const UPDATE_RECEIPTS_SQL = `
  UPDATE hoid_editorial_review_receipts_v1
  SET schema_version = ?, revision = ?, payload = ?
  WHERE id = 1 AND revision = ?
`;

const INVALID_STORED_VALUE = Object.freeze({
  schemaVersion: 0,
  invalidStoredEditorialReviewReceipts: true,
});

function isSqliteBusyError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === "SQLITE_BUSY" || candidate.code === "SQLITE_LOCKED") return true;
  return typeof candidate.message === "string" &&
    /database is locked|SQLITE_BUSY|SQLITE_LOCKED/i.test(candidate.message);
}

function decodeRow(row: ReceiptRow | null): HoidEditorialReviewReceiptSnapshot | null {
  if (
    !row ||
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

  const validation = validateHoidEditorialReviewReceiptSnapshot(parsed);
  if (
    validation.status !== "valid" ||
    validation.snapshot.revision !== row.revision
  ) return null;
  return validation.snapshot;
}

/**
 * Device-local persistence for metadata-only editorial review receipts.
 *
 * The adapter reuses the host-owned SQLite connection and performs all writes
 * through exclusive transactions with revision compare-and-swap. It never
 * stores summary text, EPUB/XHTML content, locators, file paths or URIs.
 */
export class ExpoSqliteHoidEditorialReviewReceiptStore
implements HoidEditorialReviewReceiptStorePort {
  private initialization: Promise<void> | null = null;

  constructor(private readonly database: HoidSqliteDatabasePort) {}

  private ensureInitialized(): Promise<void> {
    if (this.initialization) return this.initialization;

    const defaults = getDefaultHoidEditorialReviewReceiptSnapshot();
    this.initialization = this.database.withExclusiveTransactionAsync(async transaction => {
      await transaction.execAsync(CREATE_TABLE_SQL);
      await transaction.runAsync(
        INSERT_INITIAL_SQL,
        defaults.schemaVersion,
        defaults.revision,
        JSON.stringify(defaults),
      );
    }).catch(error => {
      this.initialization = null;
      throw error;
    });

    return this.initialization;
  }

  async read(): Promise<unknown> {
    await this.ensureInitialized();
    const row = await this.database.getFirstAsync<ReceiptRow>(SELECT_RECEIPTS_SQL);
    return decodeRow(row) ?? INVALID_STORED_VALUE;
  }

  async compareAndSwap(
    expectedRevision: number,
    nextInput: HoidEditorialReviewReceiptSnapshot,
  ): Promise<"saved" | "conflict" | "unavailable"> {
    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      !Number.isSafeInteger(expectedRevision + 1)
    ) return "unavailable";

    const validation = validateHoidEditorialReviewReceiptSnapshot(nextInput);
    if (
      validation.status !== "valid" ||
      validation.snapshot.revision !== expectedRevision + 1
    ) return "unavailable";

    try {
      await this.ensureInitialized();
    } catch {
      return "unavailable";
    }

    const next = validation.snapshot;
    const payload = JSON.stringify(next);
    if (typeof payload !== "string") return "unavailable";

    let outcome: "saved" | "conflict" | "unavailable" = "conflict";
    try {
      await this.database.withExclusiveTransactionAsync(async transaction => {
        const currentRow = await transaction.getFirstAsync<ReceiptRow>(SELECT_RECEIPTS_SQL);
        const current = decodeRow(currentRow);
        if (!current) {
          outcome = "unavailable";
          return;
        }
        if (current.revision !== expectedRevision) {
          outcome = "conflict";
          return;
        }

        const result = await transaction.runAsync(
          UPDATE_RECEIPTS_SQL,
          next.schemaVersion,
          next.revision,
          payload,
          expectedRevision,
        );
        outcome = result.changes === 1 ? "saved" : "conflict";
      });
    } catch (error) {
      return isSqliteBusyError(error) ? "conflict" : "unavailable";
    }

    return outcome;
  }
}

/** Explicit factory; database opening and lifetime remain owned by the host. */
export function createExpoSqliteHoidEditorialReviewReceiptStore(
  database: HoidSqliteDatabasePort,
): HoidEditorialReviewReceiptStorePort {
  return new ExpoSqliteHoidEditorialReviewReceiptStore(database);
}

export type HoidEditorialReceiptSqliteValue = HoidSqliteBindValue;
export type HoidEditorialReceiptSqliteRunResult = HoidSqliteRunResult;
export type HoidEditorialReceiptSqliteTransaction = HoidSqliteTransactionPort;
