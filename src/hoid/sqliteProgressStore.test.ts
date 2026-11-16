import { describe, expect, it } from "vitest";
import {
  ExpoSqliteHoidProgressStore,
  type HoidSqliteBindValue,
  type HoidSqliteDatabasePort,
  type HoidSqliteRunResult,
  type HoidSqliteTransactionPort,
} from "./sqliteProgressStore";
import { HoidProgressLedger } from "./progressLedger";

type FakeRow = {
  schema_version: number;
  revision: number;
  payload: string;
};

type FakeState = { row: FakeRow | null };

class FakeTransaction implements HoidSqliteTransactionPort {
  constructor(private readonly state: FakeState) {}

  async execAsync(source: string): Promise<void> {
    if (!source.includes("CREATE TABLE IF NOT EXISTS hoid_progress_ledger")) {
      throw new Error("Unexpected SQL schema statement");
    }
  }

  async getFirstAsync<T>(source: string, ..._params: HoidSqliteBindValue[]): Promise<T | null> {
    if (!source.includes("FROM hoid_progress_ledger")) throw new Error("Unexpected SQL read");
    return (this.state.row ? { ...this.state.row } : null) as T | null;
  }

  async runAsync(source: string, ...params: HoidSqliteBindValue[]): Promise<HoidSqliteRunResult> {
    if (source.includes("INSERT OR IGNORE INTO hoid_progress_ledger")) {
      if (this.state.row) return { changes: 0 };
      this.state.row = {
        schema_version: Number(params[0]),
        revision: Number(params[1]),
        payload: String(params[2]),
      };
      return { changes: 1 };
    }

    if (source.includes("UPDATE hoid_progress_ledger")) {
      const [schemaVersion, revision, payload, expectedRevision] = params;
      if (!this.state.row || this.state.row.revision !== expectedRevision) return { changes: 0 };
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

/** Serializes transactions and commits staged state only when the callback succeeds. */
class FakeSqliteDatabase implements HoidSqliteDatabasePort {
  private row: FakeRow | null = null;
  private transactionTail: Promise<void> = Promise.resolve();
  failNextTransaction: unknown = null;

  seed(row: FakeRow | null): void {
    this.row = row ? { ...row } : null;
  }

  inspect(): FakeRow | null {
    return this.row ? { ...this.row } : null;
  }

  async execAsync(_source: string): Promise<void> {}

  async getFirstAsync<T>(source: string, ..._params: HoidSqliteBindValue[]): Promise<T | null> {
    if (!source.includes("FROM hoid_progress_ledger")) throw new Error("Unexpected SQL read");
    return (this.row ? { ...this.row } : null) as T | null;
  }

  async runAsync(_source: string, ..._params: HoidSqliteBindValue[]): Promise<HoidSqliteRunResult> {
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
      await task(new FakeTransaction(staged));
      this.row = staged.row;
    } finally {
      release();
    }
  }
}

const fixedClock = () => "2026-11-16T19:00:00.000Z";

describe("Expo SQLite Hoid progress store", () => {
  it("initializes a durable empty ledger", async () => {
    const database = new FakeSqliteDatabase();
    const ledger = new HoidProgressLedger(new ExpoSqliteHoidProgressStore(database), fixedClock);

    expect(await ledger.read()).toMatchObject({
      status: "ready",
      snapshot: { schemaVersion: 1, revision: 0, positions: [], updatedAt: null },
    });
    expect(database.inspect()?.revision).toBe(0);
  });

  it("persists a ledger update and reads it through a new store instance", async () => {
    const database = new FakeSqliteDatabase();
    const first = new HoidProgressLedger(new ExpoSqliteHoidProgressStore(database), fixedClock);
    const update = await first.update({ expectedRevision: 0, bookId: "tfe", chapter: 8 });

    expect(update).toMatchObject({ status: "updated", snapshot: { revision: 1 } });

    const second = new HoidProgressLedger(new ExpoSqliteHoidProgressStore(database), fixedClock);
    expect(await second.read()).toMatchObject({
      status: "ready",
      snapshot: { revision: 1, positions: [{ bookId: "tfe", chapter: 8 }] },
    });
  });

  it("uses a revision predicate so stale writers cannot overwrite a newer snapshot", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidProgressStore(database);
    const ledger = new HoidProgressLedger(store, fixedClock);
    await ledger.read();

    const first = await ledger.update({ expectedRevision: 0, bookId: "tfe", chapter: 4 });
    const stale = await store.compareAndSwap(0, {
      schemaVersion: 1,
      revision: 1,
      positions: [{ bookId: "elantris", chapter: 2 }],
      updatedAt: fixedClock(),
    });

    expect(first.status).toBe("updated");
    expect(stale).toBe(false);
    expect(database.inspect()?.payload).toContain('"bookId":"tfe"');
  });

  it("allows only one of two concurrent writers with the same revision", async () => {
    const database = new FakeSqliteDatabase();
    const first = new HoidProgressLedger(new ExpoSqliteHoidProgressStore(database), fixedClock);
    const second = new HoidProgressLedger(new ExpoSqliteHoidProgressStore(database), fixedClock);

    const results = await Promise.all([
      first.update({ expectedRevision: 0, bookId: "tfe", chapter: 1 }),
      second.update({ expectedRevision: 0, bookId: "elantris", chapter: 1 }),
    ]);

    expect(results.filter(result => result.status === "updated")).toHaveLength(1);
    expect(results.filter(result => result.status === "conflict")).toHaveLength(1);
    expect(database.inspect()?.revision).toBe(1);
  });

  it("returns a corrupt snapshot when the persisted payload is not valid JSON", async () => {
    const database = new FakeSqliteDatabase();
    database.seed({ schema_version: 1, revision: 2, payload: "{not-json" });
    const ledger = new HoidProgressLedger(new ExpoSqliteHoidProgressStore(database), fixedClock);

    expect(await ledger.read()).toEqual({ status: "unavailable", reason: "corrupt-ledger" });
  });

  it("rejects an unsupported SQL schema version instead of guessing a migration", async () => {
    const database = new FakeSqliteDatabase();
    database.seed({
      schema_version: 99,
      revision: 0,
      payload: JSON.stringify({ schemaVersion: 99, revision: 0, positions: [], updatedAt: null }),
    });
    const ledger = new HoidProgressLedger(new ExpoSqliteHoidProgressStore(database), fixedClock);

    expect(await ledger.read()).toEqual({ status: "unavailable", reason: "corrupt-ledger" });
  });

  it("maps SQLite busy/locked errors to a retryable compare-and-swap conflict", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidProgressStore(database);
    await store.read();
    database.failNextTransaction = Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });

    const result = await store.compareAndSwap(0, {
      schemaVersion: 1,
      revision: 1,
      positions: [{ bookId: "tfe", chapter: 1 }],
      updatedAt: fixedClock(),
    });

    expect(result).toBe(false);
    expect(database.inspect()?.revision).toBe(0);
  });

  it("propagates non-lock storage failures so the ledger can fail closed", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidProgressStore(database);
    await store.read();
    database.failNextTransaction = new Error("disk I/O failure");
    const ledger = new HoidProgressLedger(store, fixedClock);

    expect(await ledger.update({ expectedRevision: 0, bookId: "tfe", chapter: 1 }))
      .toEqual({ status: "rejected", reason: "storage-error" });
    expect(database.inspect()?.revision).toBe(0);
  });

  it("does not interpolate reader-controlled values into SQL statements", async () => {
    const database = new FakeSqliteDatabase();
    const ledger = new HoidProgressLedger(new ExpoSqliteHoidProgressStore(database), fixedClock);
    const result = await ledger.update({ expectedRevision: 0, bookId: "tfe", chapter: 1 });

    expect(result.status).toBe("updated");
    expect(database.inspect()?.payload).toContain('"bookId":"tfe"');
  });
});
