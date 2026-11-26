import { describe, expect, it } from "vitest";
import { sha256Hex } from "./sha256";
import {
  createHoidEmptySourceInspectionReceiptLedger,
  recordHoidSourceInspectionReceipt,
  type HoidSourceInspectionReceiptLedger,
} from "./sourceInspectionReceipts";
import {
  ExpoSqliteHoidSourceInspectionReceiptStore,
} from "./sqliteSourceInspectionReceiptStore";
import type {
  HoidSqliteBindValue,
  HoidSqliteDatabasePort,
  HoidSqliteRunResult,
  HoidSqliteTransactionPort,
} from "./sqliteProgressStore";

type FakeRow = {
  schema_version: number;
  revision: number;
  payload: string;
};
type FakeState = { row: FakeRow | null };

class FakeTransaction implements HoidSqliteTransactionPort {
  constructor(
    private readonly state: FakeState,
    private readonly writes: Array<{
      sql: string;
      params: readonly HoidSqliteBindValue[];
    }>,
  ) {}

  async execAsync(source: string): Promise<void> {
    if (!source.includes("CREATE TABLE IF NOT EXISTS hoid_source_inspection_receipts_v1")) {
      throw new Error("Unexpected SQL schema statement");
    }
  }

  async getFirstAsync<T>(source: string): Promise<T | null> {
    if (!source.includes("FROM hoid_source_inspection_receipts_v1")) {
      throw new Error("Unexpected SQL read");
    }
    return (this.state.row ? { ...this.state.row } : null) as T | null;
  }

  async runAsync(
    source: string,
    ...params: HoidSqliteBindValue[]
  ): Promise<HoidSqliteRunResult> {
    this.writes.push({ sql: source, params: [...params] });
    if (source.includes("INSERT OR IGNORE INTO hoid_source_inspection_receipts_v1")) {
      if (this.state.row) return { changes: 0 };
      this.state.row = {
        schema_version: Number(params[0]),
        revision: Number(params[1]),
        payload: String(params[2]),
      };
      return { changes: 1 };
    }

    if (source.includes("UPDATE hoid_source_inspection_receipts_v1")) {
      const [schemaVersion, revision, payload, expectedRevision] = params;
      if (!this.state.row || this.state.row.revision !== expectedRevision) {
        return { changes: 0 };
      }
      this.state.row = {
        schema_version: Number(schemaVersion),
        revision: Number(revision),
        payload: String(payload),
      };
      return { changes: 1 };
    }

    throw new Error("Unexpected SQL write");
  }
}

/** Serializes exclusive transactions and commits staged state only on success. */
class FakeSqliteDatabase implements HoidSqliteDatabasePort {
  private row: FakeRow | null = null;
  private transactionTail: Promise<void> = Promise.resolve();
  failNextTransaction: unknown = null;
  readonly writes: Array<{
    sql: string;
    params: readonly HoidSqliteBindValue[];
  }> = [];

  seed(row: FakeRow | null): void {
    this.row = row ? { ...row } : null;
  }

  inspect(): FakeRow | null {
    return this.row ? { ...this.row } : null;
  }

  async execAsync(_source: string): Promise<void> {}

  async getFirstAsync<T>(source: string): Promise<T | null> {
    if (!source.includes("FROM hoid_source_inspection_receipts_v1")) {
      throw new Error("Unexpected SQL read");
    }
    return (this.row ? { ...this.row } : null) as T | null;
  }

  async runAsync(
    _source: string,
    ..._params: HoidSqliteBindValue[]
  ): Promise<HoidSqliteRunResult> {
    throw new Error("Writes must use an exclusive transaction");
  }

  async withExclusiveTransactionAsync(
    task: (transaction: HoidSqliteTransactionPort) => Promise<void>,
  ): Promise<void> {
    const previous = this.transactionTail;
    let release!: () => void;
    this.transactionTail = new Promise<void>(resolve => { release = resolve; });
    await previous;

    const staged: FakeState = { row: this.row ? { ...this.row } : null };
    try {
      if (this.failNextTransaction !== null) {
        const failure = this.failNextTransaction;
        this.failNextTransaction = null;
        throw failure;
      }
      await task(new FakeTransaction(staged, this.writes));
      this.row = staged.row;
    } finally {
      release();
    }
  }
}

function nextLedger(revision: number): HoidSourceInspectionReceiptLedger {
  const empty = createHoidEmptySourceInspectionReceiptLedger();
  if (revision === 0) return empty;
  const receipt = {
    schemaVersion: 1 as const,
    status: "candidate-only" as const,
    authorizationEffect: "none" as const,
    editorialEffect: "none" as const,
    summaryCreated: false as const,
    productionWritePerformed: false as const,
    workId: "tfe",
    editionId: "cosmere-epub-merged-v1",
    chapterNumber: 12,
    byteLength: 512,
    documentSha256: "a".repeat(64),
    navigationSha256: "85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee",
    inspectedAt: "2026-11-26T14:30:00.000Z",
    receiptFingerprint: "",
  };
  // Obtain the canonical receipt through the same digest function used by callers.
  const receiptPayload = JSON.stringify([
    1,
    "candidate-only",
    "none",
    "none",
    false,
    false,
    receipt.workId,
    receipt.editionId,
    receipt.chapterNumber,
    receipt.byteLength,
    receipt.documentSha256,
    receipt.navigationSha256,
    receipt.inspectedAt,
  ]);
  const canonicalReceipt = {
    ...receipt,
    receiptFingerprint: sha256Hex(receiptPayload),
  };
  const added = recordHoidSourceInspectionReceipt(empty, canonicalReceipt);
  if (added.status !== "added" || added.ledger.revision !== revision) {
    throw new Error("Could not build canonical fake ledger");
  }
  return added.ledger;
}

function rowFor(ledger: HoidSourceInspectionReceiptLedger): FakeRow {
  return {
    schema_version: 1,
    revision: ledger.revision,
    payload: JSON.stringify(ledger),
  };
}

describe("Expo SQLite Hoid source inspection receipt store", () => {
  it("initializes a durable empty metadata ledger", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidSourceInspectionReceiptStore(database);
    const validation = await store.read();

    expect(validation).toMatchObject({
      schemaVersion: 1,
      revision: 0,
      scope: "device-local-metadata-only",
      sourceContentIncluded: false,
      authorizationEffect: "none",
      editorialEffect: "none",
      receipts: [],
    });
    expect(database.inspect()?.revision).toBe(0);
  });

  it("persists a ledger and reads it through a new store instance", async () => {
    const database = new FakeSqliteDatabase();
    const first = new ExpoSqliteHoidSourceInspectionReceiptStore(database);
    await first.read();

    expect(await first.compareAndSwap(0, nextLedger(1))).toBe("saved");

    const second = new ExpoSqliteHoidSourceInspectionReceiptStore(database);
    const read = await second.read() as HoidSourceInspectionReceiptLedger;
    expect(read.revision).toBe(1);
    expect(read.receipts).toHaveLength(1);
  });

  it("rejects stale writers without overwriting the stored receipt ledger", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidSourceInspectionReceiptStore(database);
    await store.read();

    expect(await store.compareAndSwap(0, nextLedger(1))).toBe("saved");
    expect(await store.compareAndSwap(0, nextLedger(1))).toBe("conflict");
    expect(database.inspect()?.revision).toBe(1);
  });

  it("allows only one concurrent writer for a revision", async () => {
    const database = new FakeSqliteDatabase();
    const first = new ExpoSqliteHoidSourceInspectionReceiptStore(database);
    const second = new ExpoSqliteHoidSourceInspectionReceiptStore(database);
    await Promise.all([first.read(), second.read()]);

    const results = await Promise.all([
      first.compareAndSwap(0, nextLedger(1)),
      second.compareAndSwap(0, nextLedger(1)),
    ]);

    expect(results.filter(result => result === "saved")).toHaveLength(1);
    expect(results.filter(result => result === "conflict")).toHaveLength(1);
    expect(database.inspect()?.revision).toBe(1);
  });

  it("does not overwrite malformed persisted JSON", async () => {
    const database = new FakeSqliteDatabase();
    database.seed({ schema_version: 1, revision: 4, payload: "{not-json" });
    const store = new ExpoSqliteHoidSourceInspectionReceiptStore(database);

    expect(await store.read()).toMatchObject({ invalidStoredSourceInspectionReceipts: true });
    expect(await store.compareAndSwap(4, nextLedger(5))).toBe("unavailable");
    expect(database.inspect()?.payload).toBe("{not-json");
  });

  it("rejects unknown schema versions without guessing a migration", async () => {
    const database = new FakeSqliteDatabase();
    database.seed({ schema_version: 99, revision: 0, payload: "{}" });
    const store = new ExpoSqliteHoidSourceInspectionReceiptStore(database);

    expect(await store.read()).toMatchObject({ invalidStoredSourceInspectionReceipts: true });
    expect(await store.compareAndSwap(0, nextLedger(1))).toBe("unavailable");
    expect(database.inspect()?.schema_version).toBe(99);
  });

  it("maps SQLite lock contention to a retryable conflict", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidSourceInspectionReceiptStore(database);
    await store.read();
    database.failNextTransaction = Object.assign(new Error("database is locked"), {
      code: "SQLITE_BUSY",
    });

    expect(await store.compareAndSwap(0, nextLedger(1))).toBe("conflict");
    expect(database.inspect()?.revision).toBe(0);
  });

  it("rejects skipped revisions and invalid ledgers before SQL writes", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidSourceInspectionReceiptStore(database);
    await store.read();
    const writesBefore = database.writes.length;

    expect(await store.compareAndSwap(0, nextLedger(0))).toBe("unavailable");
    expect(database.writes.length).toBe(writesBefore);
  });
});