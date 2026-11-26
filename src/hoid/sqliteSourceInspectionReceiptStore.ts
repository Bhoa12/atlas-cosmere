import {
  createHoidEmptySourceInspectionReceiptLedger,
  validateHoidSourceInspectionReceiptLedger,
  type HoidSourceInspectionReceiptLedger,
  type HoidSourceInspectionReceiptStorePort,
} from "./sourceInspectionReceipts";
import type {
  HoidSqliteDatabasePort,
  HoidSqliteTransactionPort,
} from "./sqliteProgressStore";

type ReceiptLedgerRow = Readonly<{
  schema_version: number;
  revision: number;
  payload: string;
}>;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS hoid_source_inspection_receipts_v1 (
    id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
    schema_version INTEGER NOT NULL CHECK (schema_version = 1),
    revision INTEGER NOT NULL CHECK (revision >= 0),
    payload TEXT NOT NULL
  )
`;

const INSERT_INITIAL_SQL = `
  INSERT OR IGNORE INTO hoid_source_inspection_receipts_v1
    (id, schema_version, revision, payload)
  VALUES (1, ?, ?, ?)
`;

const SELECT_LEDGER_SQL = `
  SELECT schema_version, revision, payload
  FROM hoid_source_inspection_receipts_v1
  WHERE id = 1
`;

const UPDATE_LEDGER_SQL = `
  UPDATE hoid_source_inspection_receipts_v1
  SET schema_version = ?, revision = ?, payload = ?
  WHERE id = 1 AND revision = ?
`;

const INVALID_STORED_LEDGER = Object.freeze({
  schemaVersion: 0,
  invalidStoredSourceInspectionReceipts: true,
});

function isSqliteBusyError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === "SQLITE_BUSY" || candidate.code === "SQLITE_LOCKED") return true;
  return typeof candidate.message === "string" &&
    /database is locked|SQLITE_BUSY|SQLITE_LOCKED/i.test(candidate.message);
}

function decodeRow(row: ReceiptLedgerRow | null): HoidSourceInspectionReceiptLedger | null {
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

  const validation = validateHoidSourceInspectionReceiptLedger(parsed);
  if (
    validation.status !== "valid" ||
    validation.ledger.revision !== row.revision
  ) return null;

  return validation.ledger;
}

/**
 * Device-local metadata persistence for inspected EPUB chapter receipts.
 *
 * It reuses the host-owned SQLite handle and stores only chapter numbers,
 * edition identity, byte length and cryptographic digests. It never stores
 * source text, EPUB bytes, filenames, URIs, archive paths or provider data.
 * A valid row is still only an inspection receipt, never an editorial approval
 * or a production authorization.
 */
export class ExpoSqliteHoidSourceInspectionReceiptStore
implements HoidSourceInspectionReceiptStorePort {
  private initialization: Promise<void> | null = null;

  constructor(private readonly database: HoidSqliteDatabasePort) {}

  private ensureInitialized(): Promise<void> {
    if (this.initialization) return this.initialization;

    const empty = createHoidEmptySourceInspectionReceiptLedger();
    this.initialization = this.database.withExclusiveTransactionAsync(async transaction => {
      await transaction.execAsync(CREATE_TABLE_SQL);
      await transaction.runAsync(
        INSERT_INITIAL_SQL,
        empty.schemaVersion,
        empty.revision,
        JSON.stringify(empty),
      );
    }).catch(error => {
      // A failed migration is retryable. Existing corrupt rows are not reset.
      this.initialization = null;
      throw error;
    });

    return this.initialization;
  }

  async read(): Promise<unknown> {
    await this.ensureInitialized();
    const row = await this.database.getFirstAsync<ReceiptLedgerRow>(SELECT_LEDGER_SQL);
    return decodeRow(row) ?? INVALID_STORED_LEDGER;
  }

  async compareAndSwap(
    expectedRevision: number,
    nextInput: HoidSourceInspectionReceiptLedger,
  ): Promise<"saved" | "conflict" | "unavailable"> {
    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      !Number.isSafeInteger(expectedRevision + 1)
    ) return "unavailable";

    const validation = validateHoidSourceInspectionReceiptLedger(nextInput);
    if (
      validation.status !== "valid" ||
      validation.ledger.revision !== expectedRevision + 1
    ) return "unavailable";

    try {
      await this.ensureInitialized();
    } catch {
      return "unavailable";
    }

    const next = validation.ledger;
    const payload = JSON.stringify(next);
    if (typeof payload !== "string") return "unavailable";

    let outcome: "saved" | "conflict" | "unavailable" = "conflict";
    try {
      await this.database.withExclusiveTransactionAsync(async (transaction: HoidSqliteTransactionPort) => {
        const currentRow = await transaction.getFirstAsync<ReceiptLedgerRow>(SELECT_LEDGER_SQL);
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
          UPDATE_LEDGER_SQL,
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

export function createExpoSqliteHoidSourceInspectionReceiptStore(
  database: HoidSqliteDatabasePort,
): HoidSourceInspectionReceiptStorePort {
  return new ExpoSqliteHoidSourceInspectionReceiptStore(database);
}
