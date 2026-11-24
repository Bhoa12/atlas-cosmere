import { describe, expect, it } from "vitest";
import {
  ExpoSqliteHoidUnitProgressStore,
  type HoidUnitSqliteStoreLoadResult,
} from "./unitSqliteProgressStore";
import {
  ExpoSqliteHoidCursorProgressStore,
} from "./cursorSqliteProgressStore";
import type {
  HoidSqliteBindValue,
  HoidSqliteDatabasePort,
  HoidSqliteRunResult,
  HoidSqliteTransactionPort,
} from "./sqliteProgressStore";
import type { HoidCursorProgressSnapshot } from "./cursorProgressLedger";
import type { HoidUnitProgressSnapshot } from "./unitProgressLedger";
import { createHoidReadingCursor } from "./readingManifest";
import { createHoidUnitProgressCursor } from "./unitProgressCursor";

type Row = { schema_version: number; revision: number; payload: string };
type Migration = {
  source_schema_version: number;
  target_schema_version: number;
  source_revision: number;
  source_payload: string;
  migrated_at: string;
};
type State = {
  v1: Row | null;
  v2: Row | null;
  v1Marker: Migration | null;
  v3: Row | null;
  v3Marker: Migration | null;
};

const fixedNow = () => "2026-11-24T12:00:00.000Z";

class MemoryTransaction implements HoidSqliteTransactionPort {
  constructor(
    private readonly state: State,
    private readonly database: MemoryDatabase,
  ) {}

  async execAsync(_source: string): Promise<void> {}

  async getFirstAsync<T>(source: string): Promise<T | null> {
    if (source.includes("FROM hoid_unit_progress_migrations")) return this.state.v3Marker as T | null;
    if (source.includes("FROM hoid_progress_migrations")) return this.state.v1Marker as T | null;
    if (source.includes("FROM hoid_unit_progress_ledger")) return this.state.v3 as T | null;
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
      if (this.state.v1Marker) return { changes: 0 };
      this.state.v1Marker = {
        source_schema_version: Number(params[0]),
        target_schema_version: Number(params[1]),
        source_revision: Number(params[2]),
        source_payload: String(params[3]),
        migrated_at: String(params[4]),
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

    if (source.includes("INSERT INTO hoid_unit_progress_ledger")) {
      if (this.state.v3) return { changes: 0 };
      this.state.v3 = {
        schema_version: Number(params[0]),
        revision: Number(params[1]),
        payload: String(params[2]),
      };
      return { changes: 1 };
    }

    if (source.includes("INSERT INTO hoid_unit_progress_migrations")) {
      if (this.database.failNextUnitMarkerInsert) {
        this.database.failNextUnitMarkerInsert = false;
        throw new Error("simulated v3 receipt failure");
      }
      if (this.state.v3Marker) return { changes: 0 };
      this.state.v3Marker = {
        source_schema_version: Number(params[0]),
        target_schema_version: Number(params[1]),
        source_revision: Number(params[2]),
        source_payload: String(params[3]),
        migrated_at: String(params[4]),
      };
      return { changes: 1 };
    }

    if (source.includes("UPDATE hoid_unit_progress_ledger")) {
      if (!this.state.v3 || this.state.v3.revision !== Number(params[3])) return { changes: 0 };
      this.state.v3 = {
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
  state: State = { v1: null, v2: null, v1Marker: null, v3: null, v3Marker: null };
  failNextUnitMarkerInsert = false;
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
        v1Marker: this.state.v1Marker ? { ...this.state.v1Marker } : null,
        v3: this.state.v3 ? { ...this.state.v3 } : null,
        v3Marker: this.state.v3Marker ? { ...this.state.v3Marker } : null,
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
    updatedAt: revision === 0 ? null : fixedNow(),
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

function createStore(database: MemoryDatabase, now: () => string = fixedNow) {
  return new ExpoSqliteHoidUnitProgressStore(database, now);
}

function nextV2Snapshot(expectedRevision: number): HoidCursorProgressSnapshot {
  const cursor = createHoidReadingCursor("tfe", 6);
  if (cursor.status !== "ready") throw new Error("V2 cursor unavailable");
  return {
    schemaVersion: 2,
    revision: expectedRevision + 1,
    positions: [{ bookId: "tfe", cursor: cursor.cursor, order: 0 }],
    updatedAt: fixedNow(),
  };
}

function nextV3Snapshot(expectedRevision: number): HoidUnitProgressSnapshot {
  const cursor = createHoidUnitProgressCursor("tfe", { chapterNumber: 1 });
  if (cursor.status !== "ready") throw new Error("V3 cursor unavailable");
  return {
    schemaVersion: 3,
    revision: expectedRevision + 1,
    positions: [{ bookId: "tfe", cursor: cursor.cursor, order: 0 }],
    updatedAt: fixedNow(),
  };
}

describe("ExpoSqliteHoidUnitProgressStore", () => {
  it("atomically migrates an empty v1 profile through v2 into v3", async () => {
    const database = new MemoryDatabase();
    const result = await createStore(database).load();

    expect(result).toMatchObject({
      status: "ready",
      migratedFromV2: true,
      snapshot: { schemaVersion: 3, revision: 0, positions: [], updatedAt: null },
    });
    expect(database.state.v1).not.toBeNull();
    expect(database.state.v2).not.toBeNull();
    expect(database.state.v1Marker).not.toBeNull();
    expect(database.state.v3).not.toBeNull();
    expect(database.state.v3Marker).toMatchObject({
      source_schema_version: 2,
      target_schema_version: 3,
      source_revision: 0,
    });
  });

  it("migrates every partial and completed position while retaining order and v2 source bytes", async () => {
    const database = new MemoryDatabase();
    seedLegacy(database, legacySnapshot([
      { bookId: "tfe", chapter: 5, order: 0 },
      { bookId: "woa", completed: true, order: 1 },
    ]));
    const store = createStore(database);
    const result = await store.load();

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.migratedFromV2).toBe(true);
    expect(result.snapshot).toMatchObject({
      schemaVersion: 3,
      revision: 1,
      positions: [
        { bookId: "tfe", order: 0, cursor: { reference: { chapterNumber: 5, ordinal: 5 } } },
        { bookId: "woa", order: 1, completed: true },
      ],
    });
    expect(database.state.v2?.payload).toBe(database.state.v3Marker?.source_payload);
  });

  it("uses the latest valid v2 snapshot when v2 advances before the first v3 migration", async () => {
    const database = new MemoryDatabase();
    const v2Store = new ExpoSqliteHoidCursorProgressStore(database, fixedNow);
    const initial = await v2Store.load();
    expect(initial.status).toBe("ready");
    if (initial.status !== "ready") return;

    expect(await v2Store.compareAndSwap(initial.snapshot.revision, nextV2Snapshot(initial.snapshot.revision))).toBe(true);
    const migrated = await createStore(database).load();
    expect(migrated).toMatchObject({
      status: "ready",
      migratedFromV2: true,
      snapshot: { revision: 1, positions: [{ bookId: "tfe", cursor: { reference: { ordinal: 6 } } }] },
    });
  });

  it("returns the committed v3 snapshot without repeating migration", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    const first = await store.load();
    const second = await store.load();

    expect(first).toMatchObject({ status: "ready", migratedFromV2: true });
    expect(second).toMatchObject({ status: "ready", migratedFromV2: false });
    if (first.status === "ready" && second.status === "ready") {
      expect(second.snapshot).toEqual(first.snapshot);
    }
  });

  it("performs revision-checked v3 compare-and-swap", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await store.load();

    expect(await store.compareAndSwap(0, nextV3Snapshot(0))).toBe(true);
    const result = await store.load();
    expect(result).toMatchObject({
      status: "ready",
      snapshot: { schemaVersion: 3, revision: 1, positions: [{ bookId: "tfe", cursor: { reference: { ordinal: 1 } } }] },
    });
  });

  it("rejects stale v3 compare-and-swap revisions", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await store.load();
    const next = nextV3Snapshot(0);

    expect(await store.compareAndSwap(0, next)).toBe(true);
    expect(await store.compareAndSwap(0, next)).toBe(false);
  });

  it("allows only one concurrent writer for the same v3 revision", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await store.load();
    const next = nextV3Snapshot(0);

    const results = await Promise.all([
      store.compareAndSwap(0, next),
      store.compareAndSwap(0, next),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const final = await store.load();
    expect(final).toMatchObject({ status: "ready", snapshot: { revision: 1 } });
  });

  it("blocks v3 after a legacy v2 writer changes the retained source", async () => {
    const database = new MemoryDatabase();
    const unitStore = createStore(database);
    await unitStore.load();

    const v2Store = new ExpoSqliteHoidCursorProgressStore(database, fixedNow);
    const loaded = await v2Store.load();
    expect(loaded.status).toBe("ready");
    if (loaded.status !== "ready") return;
    expect(await v2Store.compareAndSwap(loaded.snapshot.revision, nextV2Snapshot(loaded.snapshot.revision))).toBe(true);

    expect(await unitStore.load()).toEqual({
      status: "unavailable",
      reason: "source-changed",
    });
    expect(await unitStore.compareAndSwap(0, nextV3Snapshot(0))).toBe(false);
  });

  it("blocks v3 when the retained v1 source changes after migration", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await store.load();
    const changed = legacySnapshot([{ bookId: "tfe", chapter: 2, order: 0 }], 1);
    database.state.v1 = {
      schema_version: 1,
      revision: 1,
      payload: JSON.stringify(changed),
    };

    expect(await store.load()).toEqual({
      status: "unavailable",
      reason: "source-changed",
    });
  });

  it("fails closed when the v3 migration receipt is missing", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await store.load();
    database.state.v3Marker = null;

    expect(await store.load()).toEqual({
      status: "unavailable",
      reason: "unit-migration-marker-missing",
    });
  });

  it("fails closed when the v3 migration receipt is orphaned", async () => {
    const database = new MemoryDatabase();
    await new ExpoSqliteHoidCursorProgressStore(database, fixedNow).load();
    database.state.v3Marker = {
      source_schema_version: 2,
      target_schema_version: 3,
      source_revision: 0,
      source_payload: JSON.stringify({ schemaVersion: 2, revision: 0, positions: [], updatedAt: null }),
      migrated_at: fixedNow(),
    };

    expect(await createStore(database).load()).toEqual({
      status: "unavailable",
      reason: "unit-migration-marker-orphaned",
    });
  });

  it("does not fall back to v2 when the v3 snapshot is corrupt", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await store.load();
    if (!database.state.v3) throw new Error("V3 row missing");
    database.state.v3 = { ...database.state.v3, payload: "{broken" };

    expect(await store.load()).toEqual({
      status: "unavailable",
      reason: "corrupt-v3",
    });
  });

  it("rolls back the v3 row when its migration receipt insert fails", async () => {
    const database = new MemoryDatabase();
    database.failNextUnitMarkerInsert = true;
    const store = createStore(database);

    expect(await store.load()).toEqual({
      status: "unavailable",
      reason: "storage-error",
    });
    expect(database.state.v3).toBeNull();
    expect(database.state.v3Marker).toBeNull();
    expect(database.state.v2).not.toBeNull();

    expect(await store.load()).toMatchObject({
      status: "ready",
      migratedFromV2: true,
    });
    expect(database.state.v3).not.toBeNull();
    expect(database.state.v3Marker).not.toBeNull();
  });

  it("rejects accessor-backed snapshots without invoking getters", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database);
    await store.load();
    let invoked = false;
    const hostile = Object.defineProperty({}, "schemaVersion", {
      enumerable: true,
      get() {
        invoked = true;
        throw new Error("getter must not execute");
      },
    });

    expect(await store.compareAndSwap(0, hostile as unknown as HoidUnitProgressSnapshot)).toBe(false);
    expect(invoked).toBe(false);
  });

  it("rejects an invalid v1 source before creating any v3 row", async () => {
    const database = new MemoryDatabase();
    seedLegacy(database, {
      schemaVersion: 1,
      revision: 1,
      positions: [{ bookId: "unknown-work", chapter: 1 }],
      updatedAt: fixedNow(),
    });

    const result: HoidUnitSqliteStoreLoadResult = await createStore(database).load();
    expect(result.status).toBe("unavailable");
    expect(database.state.v3).toBeNull();
    expect(database.state.v3Marker).toBeNull();
  });

  it("rejects an invalid migration clock without partially creating v3 state", async () => {
    const database = new MemoryDatabase();
    const store = createStore(database, () => "not-a-timestamp");

    expect(await store.load()).toEqual({
      status: "unavailable",
      reason: "storage-error",
    });
    expect(database.state.v3).toBeNull();
    expect(database.state.v3Marker).toBeNull();
  });
});
