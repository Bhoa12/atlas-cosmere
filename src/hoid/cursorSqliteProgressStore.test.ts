import { describe, expect, it } from "vitest";
import {
  ExpoSqliteHoidCursorProgressStore,
  type HoidCursorProgressStore,
} from "./cursorSqliteProgressStore";
import type {
  HoidSqliteBindValue,
  HoidSqliteDatabasePort,
  HoidSqliteRunResult,
  HoidSqliteTransactionPort,
} from "./sqliteProgressStore";
import { createHoidReadingCursor } from "./readingManifest";
import type { HoidCursorProgressSnapshot } from "./cursorProgressLedger";

type Row = { schema_version: number; revision: number; payload: string };
type Marker = {
  source_schema_version: number;
  target_schema_version: number;
  source_revision: number;
  migrated_at: string;
};
type State = { v1: Row | null; v2: Row | null; marker: Marker | null };

class MemoryTransaction implements HoidSqliteTransactionPort {
  constructor(
    private readonly state: State,
    private readonly database: MemoryDatabase,
  ) {}

  async execAsync(_source: string): Promise<void> {}

  async getFirstAsync<T>(source: string): Promise<T | null> {
    if (source.includes("FROM hoid_progress_migrations")) return this.state.marker as T | null;
    if (source.includes("FROM hoid_cursor_progress_ledger")) return this.state.v2 as T | null;
    if (source.includes("FROM hoid_progress_ledger")) return this.state.v1 as T | null;
    throw new Error(`Unexpected SELECT: ${source}`);
  }

  async runAsync(source: string, ...params: HoidSqliteBindValue[]): Promise<HoidSqliteRunResult> {
    if (source.includes("INSERT OR IGNORE INTO hoid_progress_ledger")) {
      if (this.state.v1) return { changes: 0 };
      this.state.v1 = {
        schema_version: Number(params[0]),
        revision: Number(params[1]),
        payload: String(params[2]),
      };
      return { changes: 1 };
    }

    if (source.includes("INSERT INTO hoid_cursor_progress_ledger")) {
      if (this.state.v2) return { changes: 0 };
      this.state.v2 = {
        schema_version: Number(params[0]),
        revision: Number(params[1]),
        payload: String(params[2]),
      };
      return { changes: 1 };
    }

    if (source.includes("INSERT INTO hoid_progress_migrations")) {
      if (this.database.failNextMarkerInsert) {
        this.database.failNextMarkerInsert = false;
        throw new Error("simulated marker write failure");
      }
      if (this.state.marker) return { changes: 0 };
      this.state.marker = {
        source_schema_version: Number(params[0]),
        target_schema_version: Number(params[1]),
        source_revision: Number(params[2]),
        migrated_at: String(params[3]),
      };
      return { changes: 1 };
    }

    if (source.includes("UPDATE hoid_cursor_progress_ledger")) {
      if (!this.state.v2 || this.state.v2.revision !== Number(params[3])) return { changes: 0 };
      this.state.v2 = {
        schema_version: Number(params[0]),
        revision: Number(params[1]),
        payload: String(params[2]),
      };
      return { changes: 1 };
    }

    throw new Error(`Unexpected SQL write: ${source}`);
  }
}

class MemoryDatabase implements HoidSqliteDatabasePort {
  state: State = { v1: null, v2: null, marker: null };
  failNextMarkerInsert = false;
  private queue: Promise<void> = Promise.resolve();

  async execAsync(_source: string): Promise<void> {}

  async getFirstAsync<T>(source: string): Promise<T | null> {
    return new MemoryTransaction(this.state, this).getFirstAsync<T>(source);
  }

  async runAsync(source: string, ...params: HoidSqliteBindValue[]): Promise<HoidSqliteRunResult> {
    return new MemoryTransaction(this.state, this).runAsync(source, ...params);
  }

  withExclusiveTransactionAsync(
    task: (transaction: HoidSqliteTransactionPort) => Promise<void>,
  ): Promise<void> {
    const operation = this.queue.then(async () => {
      const draft: State = {
        v1: this.state.v1 ? { ...this.state.v1 } : null,
        v2: this.state.v2 ? { ...this.state.v2 } : null,
        marker: this.state.marker ? { ...this.state.marker } : null,
      };
      await task(new MemoryTransaction(draft, this));
      this.state = draft;
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }
}

function legacySnapshot(
  positions: readonly Record<string, unknown>[] = [],
  revision = positions.length === 0 ? 0 : 1,
) {
  return {
    schemaVersion: 1,
    revision,
    positions,
    updatedAt: revision === 0 ? null : "2026-11-17T00:00:00.000Z",
  };
}

function seedLegacy(database: MemoryDatabase, snapshot: unknown): void {
  const value = snapshot as { schemaVersion: number; revision: number };
  database.state.v1 = {
    schema_version: value.schemaVersion,
    revision: value.revision,
    payload: JSON.stringify(snapshot),
  };
}

function createNextSnapshot(revision: number): HoidCursorProgressSnapshot {
  const cursorResult = createHoidReadingCursor("tfe", 3);
  if (cursorResult.status !== "ready") throw new Error("Test cursor unavailable");
  return {
    schemaVersion: 2,
    revision: revision + 1,
    positions: [{ bookId: "tfe", cursor: cursorResult.cursor }],
    updatedAt: "2026-11-17T00:01:00.000Z",
  };
}

function createStore(database: MemoryDatabase): HoidCursorProgressStore {
  return new ExpoSqliteHoidCursorProgressStore(
    database,
    () => "2026-11-17T00:00:00.000Z",
  );
}

describe("ExpoSqliteHoidCursorProgressStore", () => {
  it("creates an empty v1 source and atomically migrates a fresh profile to v2", async () => {
    const database = new MemoryDatabase();
    const result = await createStore(database).load();

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.migratedFromV1).toBe(true);
      expect(result.snapshot).toEqual({
        schemaVersion: 2,
        revision: 0,
        positions: [],
        updatedAt: null,
      });
    }
    expect(database.state.v1).not.toBeNull();
    expect(database.state.v2).not.toBeNull();
    expect(database.state.marker?.source_revision).toBe(0);
  });

  it("migrates partial cursors and explicit completions while retaining v1", async () => {
    const database = new MemoryDatabase();
    seedLegacy(database, legacySnapshot([
      { bookId: "tfe", chapter: 5 },
      { bookId: "woa", completed: true },
    ]));
    const sourceBefore = database.state.v1?.payload;

    const result = await createStore(database).load();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.migratedFromV1).toBe(true);
    expect(result.snapshot.positions).toHaveLength(2);
    expect(result.snapshot.positions.find(position => position.bookId === "woa")).toEqual({
      bookId: "woa",
      completed: true,
    });
    expect(result.snapshot.positions.find(position => position.bookId === "tfe")).toMatchObject({
      bookId: "tfe",
      cursor: { chapterNumber: 5, unitId: "chapter:005" },
    });
    expect(database.state.v1?.payload).toBe(sourceBefore);
  });

  it("rejects the complete migration when a legacy position is ambiguous", async () => {
    const database = new MemoryDatabase();
    seedLegacy(database, legacySnapshot([{ bookId: "elantris", chapter: 50 }]));

    const result = await createStore(database).load();
    expect(result).toEqual({
      status: "unavailable",
      reason: "ambiguous-v1",
      bookId: "elantris",
    });
    expect(database.state.v2).toBeNull();
    expect(database.state.marker).toBeNull();
    expect(database.state.v1).not.toBeNull();
  });

  it("rejects a corrupt v1 row without creating v2 state", async () => {
    const database = new MemoryDatabase();
    database.state.v1 = { schema_version: 1, revision: 4, payload: "{broken" };

    const result = await createStore(database).load();
    expect(result).toEqual({ status: "unavailable", reason: "corrupt-v1" });
    expect(database.state.v2).toBeNull();
    expect(database.state.marker).toBeNull();
  });

  it("returns the v2 snapshot on subsequent reads without repeating migration", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    const first = await store.load();
    const second = await store.load();

    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    if (first.status === "ready" && second.status === "ready") {
      expect(first.migratedFromV1).toBe(true);
      expect(second.migratedFromV1).toBe(false);
      expect(second.snapshot).toEqual(first.snapshot);
    }
  });

  it("performs a revision-checked compare-and-swap update", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    const loaded = await store.load();
    expect(loaded.status).toBe("ready");
    if (loaded.status !== "ready") return;

    expect(await store.compareAndSwap(0, createNextSnapshot(0))).toBe(true);
    const after = await store.load();
    expect(after.status).toBe("ready");
    if (after.status === "ready") expect(after.snapshot.revision).toBe(1);
  });

  it("rejects stale compare-and-swap revisions", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await store.load();
    const next = createNextSnapshot(0);

    expect(await store.compareAndSwap(0, next)).toBe(true);
    expect(await store.compareAndSwap(0, next)).toBe(false);
  });

  it("does not fall back to v1 when an existing v2 payload is corrupt", async () => {
    const database = new MemoryDatabase();
    seedLegacy(database, legacySnapshot([{ bookId: "tfe", chapter: 5 }]));
    database.state.v2 = { schema_version: 2, revision: 1, payload: "{broken" };
    database.state.marker = {
      source_schema_version: 1,
      target_schema_version: 2,
      source_revision: 1,
      migrated_at: "2026-11-17T00:00:00.000Z",
    };

    const result = await createStore(database).load();
    expect(result).toEqual({ status: "unavailable", reason: "corrupt-v2" });
  });

  it("fails closed when the migration marker exists without a v2 snapshot", async () => {
    const database = new MemoryDatabase();
    database.state.marker = {
      source_schema_version: 1,
      target_schema_version: 2,
      source_revision: 0,
      migrated_at: "2026-11-17T00:00:00.000Z",
    };

    const result = await createStore(database).load();
    expect(result).toEqual({ status: "unavailable", reason: "migration-marker-orphaned" });
  });

  it("rolls back both v2 writes when the migration marker insert fails", async () => {
    const database = new MemoryDatabase();
    database.failNextMarkerInsert = true;
    const store = createStore(database);

    const failed = await store.load();
    expect(failed).toEqual({ status: "unavailable", reason: "storage-error" });
    expect(database.state.v2).toBeNull();
    expect(database.state.marker).toBeNull();
    expect(database.state.v1).not.toBeNull();

    const retried = await store.load();
    expect(retried.status).toBe("ready");
    expect(database.state.v2).not.toBeNull();
    expect(database.state.marker).not.toBeNull();
  });

  it("allows only one concurrent writer for the same expected revision", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await store.load();
    const next = createNextSnapshot(0);

    const results = await Promise.all([
      store.compareAndSwap(0, next),
      store.compareAndSwap(0, next),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const final = await store.load();
    expect(final.status).toBe("ready");
    if (final.status === "ready") expect(final.snapshot.revision).toBe(1);
  });

  it("rejects malformed snapshots before writing", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await store.load();
    const malformed = {
      schemaVersion: 2,
      revision: 1,
      positions: [{ bookId: "tfe", cursor: createNextSnapshot(0).positions[0] }],
      updatedAt: "2026-11-17T00:01:00.000Z",
    } as unknown as HoidCursorProgressSnapshot;

    expect(await store.compareAndSwap(0, malformed)).toBe(false);
    const final = await store.load();
    expect(final.status).toBe("ready");
    if (final.status === "ready") expect(final.snapshot.revision).toBe(0);
  });
});
