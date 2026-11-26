import { describe, expect, it } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  getDefaultHoidReaderRecommendationPreferences,
  validateHoidReaderRecommendationPreferences,
  type HoidReaderRecommendationPreferences,
} from "./readerRecommendationPreferences";
import {
  ExpoSqliteHoidReaderRecommendationPreferencesStore,
  type HoidReaderPreferencesSqliteValue,
  type HoidReaderPreferencesSqliteRunResult,
  type HoidReaderPreferencesSqliteTransaction,
} from "./sqliteReaderRecommendationPreferencesStore";
import type { HoidSqliteDatabasePort } from "./sqliteProgressStore";

type FakeRow = {
  schema_version: number;
  revision: number;
  payload: string;
};
type FakeState = { row: FakeRow | null };

class FakeTransaction implements HoidReaderPreferencesSqliteTransaction {
  constructor(
    private readonly state: FakeState,
    private readonly writes: Array<{
      sql: string;
      params: readonly HoidReaderPreferencesSqliteValue[];
    }>,
  ) {}

  async execAsync(source: string): Promise<void> {
    if (!source.includes("CREATE TABLE IF NOT EXISTS hoid_reader_recommendation_preferences_v1")) {
      throw new Error("Unexpected SQL schema statement");
    }
  }

  async getFirstAsync<T>(
    source: string,
    ..._params: HoidReaderPreferencesSqliteValue[]
  ): Promise<T | null> {
    if (!source.includes("FROM hoid_reader_recommendation_preferences_v1")) {
      throw new Error("Unexpected SQL read");
    }
    return (this.state.row ? { ...this.state.row } : null) as T | null;
  }

  async runAsync(
    source: string,
    ...params: HoidReaderPreferencesSqliteValue[]
  ): Promise<HoidReaderPreferencesSqliteRunResult> {
    this.writes.push({ sql: source, params: [...params] });
    if (source.includes("INSERT OR IGNORE INTO hoid_reader_recommendation_preferences_v1")) {
      if (this.state.row) return { changes: 0 };
      this.state.row = {
        schema_version: Number(params[0]),
        revision: Number(params[1]),
        payload: String(params[2]),
      };
      return { changes: 1 };
    }

    if (source.includes("UPDATE hoid_reader_recommendation_preferences_v1")) {
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
    params: readonly HoidReaderPreferencesSqliteValue[];
  }> = [];

  seed(row: FakeRow | null): void {
    this.row = row ? { ...row } : null;
  }

  inspect(): FakeRow | null {
    return this.row ? { ...this.row } : null;
  }

  async execAsync(_source: string): Promise<void> {}

  async getFirstAsync<T>(
    source: string,
    ..._params: HoidReaderPreferencesSqliteValue[]
  ): Promise<T | null> {
    if (!source.includes("FROM hoid_reader_recommendation_preferences_v1")) {
      throw new Error("Unexpected SQL read");
    }
    return (this.row ? { ...this.row } : null) as T | null;
  }

  async runAsync(
    _source: string,
    ..._params: HoidReaderPreferencesSqliteValue[]
  ): Promise<HoidReaderPreferencesSqliteRunResult> {
    throw new Error("Writes must use an exclusive transaction");
  }

  async withExclusiveTransactionAsync(
    task: (transaction: HoidReaderPreferencesSqliteTransaction) => Promise<void>,
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

function nextPreferences(
  revision: number,
  priorityWorkIds: readonly string[] = ["tfe"],
): HoidReaderRecommendationPreferences {
  return Object.freeze({
    schemaVersion: 1,
    revision,
    priorityWorkIds: Object.freeze([...priorityWorkIds]),
    deprioritizedWorkIds: Object.freeze([]),
    maxItems: 3,
  });
}

function validRow(preferences: HoidReaderRecommendationPreferences): FakeRow {
  return {
    schema_version: 1,
    revision: preferences.revision,
    payload: JSON.stringify(preferences),
  };
}

describe("Expo SQLite Hoid reader recommendation preferences store", () => {
  it("initializes a durable default profile without requiring an account identity", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
    const result = validateHoidReaderRecommendationPreferences(await store.read());

    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.preferences).toEqual(getDefaultHoidReaderRecommendationPreferences());
    }
    expect(database.inspect()?.revision).toBe(0);
  });

  it("persists preferences and reads them through a new store instance", async () => {
    const database = new FakeSqliteDatabase();
    const first = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
    await first.read();

    expect(await first.compareAndSwap(0, nextPreferences(1, ["elantris", "tfe"]))).toBe("saved");

    const second = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
    const result = validateHoidReaderRecommendationPreferences(await second.read());
    expect(result.status).toBe("valid");
    if (result.status === "valid") {
      expect(result.preferences.revision).toBe(1);
      expect(result.preferences.priorityWorkIds).toEqual(["elantris", "tfe"]);
    }
  });

  it("rejects stale writers without overwriting the current profile", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
    await store.read();
    expect(await store.compareAndSwap(0, nextPreferences(1, ["tfe"]))).toBe("saved");

    expect(await store.compareAndSwap(0, nextPreferences(1, ["elantris"]))).toBe("conflict");
    expect(database.inspect()?.payload).toContain('"priorityWorkIds":["tfe"]');
  });

  it("allows only one of two concurrent writers with the same revision", async () => {
    const database = new FakeSqliteDatabase();
    const first = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
    const second = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
    await Promise.all([first.read(), second.read()]);

    const results = await Promise.all([
      first.compareAndSwap(0, nextPreferences(1, ["tfe"])),
      second.compareAndSwap(0, nextPreferences(1, ["elantris"])),
    ]);

    expect(results.filter(result => result === "saved")).toHaveLength(1);
    expect(results.filter(result => result === "conflict")).toHaveLength(1);
    expect(database.inspect()?.revision).toBe(1);
  });

  it("rejects unknown work IDs and malformed profiles before writing", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
    await store.read();

    const invalid = {
      schemaVersion: 1,
      revision: 1,
      priorityWorkIds: ["not-in-bibliography"],
      deprioritizedWorkIds: [],
      maxItems: 3,
    } as unknown as HoidReaderRecommendationPreferences;

    expect(await store.compareAndSwap(0, invalid)).toBe("unavailable");
    expect(database.inspect()?.revision).toBe(0);
  });

  it("rejects a non-monotonic or skipped revision", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
    await store.read();

    expect(await store.compareAndSwap(0, nextPreferences(2))).toBe("unavailable");
    expect(database.inspect()?.revision).toBe(0);
  });

  it("does not convert malformed persisted JSON into default preferences", async () => {
    const database = new FakeSqliteDatabase();
    database.seed({ schema_version: 1, revision: 4, payload: "{not-json" });
    const store = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
    const result = validateHoidReaderRecommendationPreferences(await store.read());

    expect(result.status).toBe("invalid");
    expect(database.inspect()?.payload).toBe("{not-json");
  });

  it("does not overwrite a corrupt existing row during compare-and-swap", async () => {
    const database = new FakeSqliteDatabase();
    database.seed({ schema_version: 1, revision: 4, payload: "{not-json" });
    const store = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);

    expect(await store.compareAndSwap(4, nextPreferences(5))).toBe("unavailable");
    expect(database.inspect()?.payload).toBe("{not-json");
  });

  it("rejects unsupported SQL schema versions instead of guessing a migration", async () => {
    const database = new FakeSqliteDatabase();
    database.seed({
      schema_version: 99,
      revision: 0,
      payload: JSON.stringify({ ...getDefaultHoidReaderRecommendationPreferences(), schemaVersion: 99 }),
    });
    const store = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
    const result = validateHoidReaderRecommendationPreferences(await store.read());

    expect(result.status).toBe("invalid");
    expect(database.inspect()?.schema_version).toBe(99);
  });

  it("maps SQLITE_BUSY and SQLITE_LOCKED to a retryable conflict", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
    await store.read();
    database.failNextTransaction = Object.assign(new Error("database is locked"), {
      code: "SQLITE_BUSY",
    });

    expect(await store.compareAndSwap(0, nextPreferences(1))).toBe("conflict");
    expect(database.inspect()?.revision).toBe(0);
  });

  it("returns unavailable on non-lock storage failures", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
    await store.read();
    database.failNextTransaction = new Error("disk I/O failure");

    expect(await store.compareAndSwap(0, nextPreferences(1))).toBe("unavailable");
    expect(database.inspect()?.revision).toBe(0);
  });

  it("uses bound parameters instead of interpolating preference values into SQL", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
    await store.read();
    expect(await store.compareAndSwap(0, nextPreferences(1, ["tfe", "elantris"]))).toBe("saved");

    const update = database.writes.find(write =>
      write.sql.includes("UPDATE hoid_reader_recommendation_preferences_v1"),
    );
    expect(update?.sql).not.toContain('"priorityWorkIds"');
    expect(update?.sql).toContain("WHERE id = 1 AND revision = ?");
    expect(update?.params[2]).toContain('"priorityWorkIds":["tfe","elantris"]');
  });

  it("never writes outside the exclusive transaction", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
    await store.read();

    expect(await store.compareAndSwap(0, nextPreferences(1))).toBe("saved");
    expect(database.inspect()?.revision).toBe(1);
  });

  it("uses only known bibliography works in its persisted profile", async () => {
    const database = new FakeSqliteDatabase();
    const store = new ExpoSqliteHoidReaderRecommendationPreferencesStore(database);
    await store.read();
    const known = HOID_SOURCE_BIBLIOGRAPHY[0].id;

    expect(await store.compareAndSwap(0, nextPreferences(1, [known]))).toBe("saved");
    const result = validateHoidReaderRecommendationPreferences(await store.read());
    expect(result.status).toBe("valid");
  });
});
