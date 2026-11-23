import { describe, expect, it } from "vitest";
import {
  emptyHoidCursorProgressSnapshot,
  validateHoidCursorProgressSnapshot,
  type HoidCursorProgressSnapshot,
} from "./cursorProgressLedger";
import {
  HoidCursorProgressCoordinator,
} from "./cursorProgressCoordinator";
import type {
  HoidCursorProgressStore,
  HoidCursorStoreLoadResult,
} from "./cursorSqliteProgressStore";
import { createHoidReadingCursor } from "./readingManifest";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./cursorProgressFingerprint";

const fixedNow = () => "2026-11-17T03:30:00.000Z";

class MemoryCursorStore implements HoidCursorProgressStore {
  snapshot: HoidCursorProgressSnapshot = emptyHoidCursorProgressSnapshot();
  unavailable = false;
  failWrites = false;
  migratedFromV1 = false;
  writes = 0;

  async load(): Promise<HoidCursorStoreLoadResult> {
    if (this.unavailable) return { status: "unavailable", reason: "storage-error" };
    const validation = validateHoidCursorProgressSnapshot(this.snapshot);
    if (validation.status !== "valid") {
      return { status: "unavailable", reason: "corrupt-v2" };
    }
    const migratedFromV1 = this.migratedFromV1;
    this.migratedFromV1 = false;
    return { status: "ready", snapshot: validation.snapshot, migratedFromV1 };
  }

  async read(): Promise<unknown> {
    return this.snapshot;
  }

  async compareAndSwap(
    expectedRevision: number,
    next: HoidCursorProgressSnapshot,
  ): Promise<boolean> {
    if (this.unavailable || this.failWrites) throw new Error("simulated storage failure");
    if (this.snapshot.revision !== expectedRevision) return false;
    const validation = validateHoidCursorProgressSnapshot(next);
    if (validation.status !== "valid") return false;
    this.snapshot = validation.snapshot;
    this.writes += 1;
    return true;
  }
}

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Cursor de prueba no disponible");
  return result.cursor;
}

function createCoordinator(store = new MemoryCursorStore()) {
  return {
    store,
    coordinator: new HoidCursorProgressCoordinator(store, fixedNow),
  };
}

function progressBinding(snapshot: HoidCursorProgressSnapshot) {
  const projection = projectHoidCursorProgressSnapshot(snapshot);
  if (projection.status !== "ready") throw new Error("Progress projection unavailable");
  return {
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
  };
}

describe("HoidCursorProgressCoordinator", () => {
  it("initializes a fresh v2 profile without granting any reading progress", async () => {
    const { coordinator } = createCoordinator();
    const result = await coordinator.initialize();

    expect(result).toMatchObject({
      status: "ready",
      operation: "loaded",
      snapshot: { schemaVersion: 2, revision: 0, positions: [], updatedAt: null },
    });
  });

  it("reports a successful legacy migration distinctly", async () => {
    const store = new MemoryCursorStore();
    store.migratedFromV1 = true;
    const { coordinator } = createCoordinator(store);

    expect(await coordinator.initialize()).toMatchObject({
      status: "ready",
      operation: "migrated",
    });
  });

  it("advances only to a validated edition-bound cursor", async () => {
    const { coordinator } = createCoordinator();
    const result = await coordinator.advance("tfe", cursor("tfe", 8));

    expect(result).toMatchObject({
      status: "ready",
      operation: "updated",
      snapshot: {
        revision: 1,
        positions: [{ bookId: "tfe", cursor: { unitId: "chapter:008", ordinal: 8 } }],
      },
    });
  });

  it("allows a forward jump but never infers completion from the final chapter", async () => {
    const { coordinator } = createCoordinator();
    await coordinator.advance("tfe", cursor("tfe", 37));
    const result = await coordinator.advance("tfe", cursor("tfe", 38));

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.snapshot.positions).toHaveLength(1);
      expect("completed" in result.snapshot.positions[0]).toBe(false);
    }
  });

  it("treats an identical cursor as unchanged without writing", async () => {
    const { coordinator, store } = createCoordinator();
    const target = cursor("tfe", 8);
    await coordinator.advance("tfe", target);
    const result = await coordinator.advance("tfe", target);

    expect(result).toMatchObject({ status: "ready", operation: "unchanged" });
    expect(store.writes).toBe(1);
  });

  it("rejects backwards movement through the ordinary advance operation", async () => {
    const { coordinator, store } = createCoordinator();
    await coordinator.advance("tfe", cursor("tfe", 8));
    const result = await coordinator.advance("tfe", cursor("tfe", 5));

    expect(result).toEqual({
      status: "rejected",
      reason: "regression-requires-confirmation",
    });
    expect(store.writes).toBe(1);
  });

  it("requires a separate explicit correction confirmation to move backwards", async () => {
    const { coordinator } = createCoordinator();
    await coordinator.advance("tfe", cursor("tfe", 8));

    const result = await coordinator.correctCursor(
      "tfe",
      cursor("tfe", 5),
      { confirmed: true },
    );
    expect(result).toMatchObject({
      status: "ready",
      operation: "updated",
      snapshot: { positions: [{ bookId: "tfe", cursor: { chapterNumber: 5 } }] },
    });
  });

  it("rejects a correction without explicit confirmation", async () => {
    const { coordinator } = createCoordinator();
    await coordinator.advance("tfe", cursor("tfe", 8));

    const result = await coordinator.correctCursor(
      "tfe",
      cursor("tfe", 5),
      {} as { confirmed: true },
    );
    expect(result).toEqual({
      status: "rejected",
      reason: "regression-requires-confirmation",
    });
  });

  it("records completion separately and blocks further cursor advancement", async () => {
    const { coordinator } = createCoordinator();
    await coordinator.advance("tfe", cursor("tfe", 8));
    const completed = await coordinator.complete("tfe");
    const blocked = await coordinator.advance("tfe", cursor("tfe", 9));

    expect(completed).toMatchObject({
      status: "ready",
      snapshot: { positions: [{ bookId: "tfe", completed: true }] },
    });
    expect(blocked).toEqual({ status: "rejected", reason: "already-completed" });
  });

  it("reopens a completed work only with confirmation and starts at the first verified unit", async () => {
    const { coordinator } = createCoordinator();
    await coordinator.complete("tfe");

    const missing = await coordinator.reopenCompletedWork("tfe", {} as { confirmed: true });
    expect(missing).toEqual({ status: "rejected", reason: "reopen-requires-confirmation" });

    const reopened = await coordinator.reopenCompletedWork("tfe", { confirmed: true });
    expect(reopened).toMatchObject({
      status: "ready",
      snapshot: { positions: [{ bookId: "tfe", cursor: { chapterNumber: 1 } }] },
    });
  });

  it("does not fabricate a first cursor for an unsegmented collection", async () => {
    const { coordinator } = createCoordinator();
    await coordinator.complete("arcanum");
    const result = await coordinator.reopenCompletedWork("arcanum", { confirmed: true });

    expect(result).toEqual({ status: "rejected", reason: "unsupported-position" });
  });

  it("rejects a cursor whose book does not match the requested work", async () => {
    const { coordinator, store } = createCoordinator();
    const result = await coordinator.advance("woa", cursor("tfe", 3));

    expect(result).toEqual({ status: "rejected", reason: "invalid-cursor" });
    expect(store.writes).toBe(0);
  });

  it("rejects unknown works without touching storage", async () => {
    const { coordinator, store } = createCoordinator();
    const result = await coordinator.complete("unknown-work");

    expect(result).toEqual({ status: "rejected", reason: "unknown-work" });
    expect(store.writes).toBe(0);
  });

  it("refreshes its snapshot and reports a conflict when another coordinator wins", async () => {
    const store = new MemoryCursorStore();
    const first = new HoidCursorProgressCoordinator(store, fixedNow);
    const second = new HoidCursorProgressCoordinator(store, fixedNow);
    await Promise.all([first.initialize(), second.initialize()]);

    await first.advance("tfe", cursor("tfe", 4));
    const conflict = await second.advance("woa", cursor("woa", 3));

    expect(conflict).toMatchObject({
      status: "conflict",
      snapshot: { revision: 1, positions: [{ bookId: "tfe" }] },
    });
    expect(second.getSnapshot()?.revision).toBe(1);
  });

  it("serializes concurrent operations issued through one coordinator", async () => {
    const { coordinator } = createCoordinator();
    const results = await Promise.all([
      coordinator.advance("tfe", cursor("tfe", 2)),
      coordinator.advance("woa", cursor("woa", 3)),
    ]);

    expect(results.every(result => result.status === "ready")).toBe(true);
    expect(coordinator.getSnapshot()).toMatchObject({
      revision: 2,
      positions: [
        { bookId: "tfe", order: 0 },
        { bookId: "woa", order: 1 },
      ],
    });
  });

  it("fails closed when the store is unavailable", async () => {
    const store = new MemoryCursorStore();
    store.unavailable = true;
    const { coordinator } = createCoordinator(store);

    expect(await coordinator.initialize()).toEqual({
      status: "unavailable",
      reason: "storage-error",
    });
    expect(await coordinator.complete("tfe")).toEqual({
      status: "unavailable",
      reason: "storage-error",
    });
  });

  it("does not persist when the injected clock is invalid", async () => {
    const store = new MemoryCursorStore();
    const coordinator = new HoidCursorProgressCoordinator(store, () => "not-a-date");
    const result = await coordinator.advance("tfe", cursor("tfe", 2));

    expect(result).toEqual({ status: "unavailable", reason: "clock-error" });
    expect(store.writes).toBe(0);
  });

  it("rejects invalid cursors before reading or writing the store", async () => {
    const { coordinator, store } = createCoordinator();
    const invalid = { ...cursor("tfe", 2), manifestId: "obsolete" };
    const result = await coordinator.advance("tfe", invalid);

    expect(result).toEqual({ status: "rejected", reason: "invalid-cursor" });
    expect(store.writes).toBe(0);
  });

  it("preserves the first-read order when updating an existing work", async () => {
    const { coordinator } = createCoordinator();
    await coordinator.advance("tfe", cursor("tfe", 2));
    await coordinator.advance("woa", cursor("woa", 3));
    const result = await coordinator.advance("tfe", cursor("tfe", 4));

    expect(result).toMatchObject({
      status: "ready",
      snapshot: {
        positions: [
          { bookId: "tfe", order: 0, cursor: { chapterNumber: 4 } },
          { bookId: "woa", order: 1 },
        ],
      },
    });
  });

  it("rejects inherited and accessor-backed confirmation objects without invoking getters", async () => {
    const { coordinator, store } = createCoordinator();
    await coordinator.complete("tfe");

    let invoked = false;
    const accessor = Object.defineProperty({}, "confirmed", {
      enumerable: true,
      get() {
        invoked = true;
        return true;
      },
    });
    const accessorResult = await coordinator.reopenCompletedWork(
      "tfe",
      accessor as { confirmed: true },
    );
    expect(accessorResult).toEqual({
      status: "rejected",
      reason: "reopen-requires-confirmation",
    });
    expect(invoked).toBe(false);

    const inherited = Object.create({ confirmed: true }) as { confirmed: true };
    const inheritedResult = await coordinator.reopenCompletedWork("tfe", inherited);
    expect(inheritedResult).toEqual({
      status: "rejected",
      reason: "reopen-requires-confirmation",
    });
    expect(store.writes).toBe(1);
  });

  it("rejects accessor-backed correction flags without executing them", async () => {
    const { coordinator } = createCoordinator();
    await coordinator.complete("tfe");

    let invoked = false;
    const confirmation = Object.defineProperty({ confirmed: true }, "reopenCompleted", {
      enumerable: true,
      get() {
        invoked = true;
        return true;
      },
    });
    const result = await coordinator.correctCursor(
      "tfe",
      cursor("tfe", 3),
      confirmation as { confirmed: true; reopenCompleted: true },
    );

    expect(result).toEqual({
      status: "rejected",
      reason: "regression-requires-confirmation",
    });
    expect(invoked).toBe(false);
  });


  it("refreshes a cached snapshot after another coordinator commits to the shared store", async () => {
    const store = new MemoryCursorStore();
    const first = new HoidCursorProgressCoordinator(store, fixedNow);
    const second = new HoidCursorProgressCoordinator(store, fixedNow);
    await Promise.all([first.initialize(), second.initialize()]);

    await first.advance("tfe", cursor("tfe", 6));
    expect(second.getSnapshot()?.revision).toBe(0);

    const refreshed = await second.refresh();
    expect(refreshed).toMatchObject({
      status: "ready",
      operation: "refreshed",
      snapshot: {
        revision: 1,
        positions: [{ bookId: "tfe", cursor: { chapterNumber: 6 } }],
      },
    });
    expect(second.getSnapshot()?.revision).toBe(1);
  });

  it("clears the cached authorization snapshot when a durable refresh becomes unavailable", async () => {
    const store = new MemoryCursorStore();
    const { coordinator } = createCoordinator(store);
    await coordinator.initialize();
    expect(coordinator.getSnapshot()?.revision).toBe(0);

    store.unavailable = true;
    expect(await coordinator.refresh()).toEqual({
      status: "unavailable",
      reason: "storage-error",
    });
    expect(coordinator.getSnapshot()).toBeNull();
  });


  it("notifies subscribers only after a durable cursor commit and supports idempotent unsubscribe", async () => {
    const { coordinator, store } = createCoordinator();
    const events: string[] = [];
    const unsubscribe = coordinator.subscribe(() => events.push("changed"));

    await coordinator.initialize();
    expect(events).toEqual([]);
    await coordinator.advance("tfe", cursor("tfe", 4));
    expect(events).toEqual(["changed"]);
    await coordinator.advance("tfe", cursor("tfe", 4));
    expect(events).toEqual(["changed"]);

    unsubscribe();
    unsubscribe();
    await coordinator.advance("tfe", cursor("tfe", 5));
    expect(events).toEqual(["changed"]);
    expect(store.writes).toBe(2);
  });

  it("notifies a local subscriber when refresh discovers another coordinator's committed snapshot", async () => {
    const store = new MemoryCursorStore();
    const writer = new HoidCursorProgressCoordinator(store, fixedNow);
    const reader = new HoidCursorProgressCoordinator(store, fixedNow);
    await Promise.all([writer.initialize(), reader.initialize()]);
    let events = 0;
    reader.subscribe(() => { events += 1; });

    await writer.advance("tfe", cursor("tfe", 6));
    expect(events).toBe(0);
    await reader.refresh();

    expect(events).toBe(1);
    expect(reader.getSnapshot()?.revision).toBe(1);
  });

  it("does not notify subscribers when a durable write fails", async () => {
    const { coordinator, store } = createCoordinator();
    await coordinator.initialize();
    let events = 0;
    coordinator.subscribe(() => { events += 1; });
    store.failWrites = true;

    const result = await coordinator.advance("tfe", cursor("tfe", 3));
    expect(result).toEqual({ status: "unavailable", reason: "storage-error" });
    expect(events).toBe(0);
  });

  it("makes concurrent initialize calls join an in-flight durable refresh instead of seeing stale progress", async () => {
    const store = new MemoryCursorStore();
    const first = new HoidCursorProgressCoordinator(store, fixedNow);
    const second = new HoidCursorProgressCoordinator(store, fixedNow);
    await Promise.all([first.initialize(), second.initialize()]);
    await first.advance("tfe", cursor("tfe", 7));

    const originalLoad = store.load.bind(store);
    let releaseLoad!: () => void;
    let markLoadStarted!: () => void;
    const loadGate = new Promise<void>(resolve => { releaseLoad = resolve; });
    const loadStarted = new Promise<void>(resolve => { markLoadStarted = resolve; });
    store.load = async () => {
      markLoadStarted();
      await loadGate;
      return originalLoad();
    };

    const refreshing = second.refresh();
    await loadStarted;
    expect(second.getSnapshot()).toBeNull();

    const concurrentInitialize = second.initialize();
    releaseLoad();
    const [refreshed, initialized] = await Promise.all([refreshing, concurrentInitialize]);

    expect(refreshed).toMatchObject({
      status: "ready",
      operation: "refreshed",
      snapshot: { revision: 1 },
    });
    expect(initialized).toMatchObject({
      status: "ready",
      snapshot: { revision: 1 },
    });
    expect(second.getSnapshot()?.revision).toBe(1);
  });
  it("marks the opened chapter as read by moving the cursor to the following chapter", async () => {
    const { coordinator, store } = createCoordinator();
    await coordinator.advance("tfe", cursor("tfe", 7));
    const binding = progressBinding(store.snapshot);

    const result = await coordinator.markChapterReadIfCurrent(
      "tfe",
      8,
      binding.revision,
      binding.fingerprint,
      { confirmed: true },
    );

    expect(result).toMatchObject({
      status: "ready",
      operation: "updated",
      snapshot: { revision: 2, positions: [{ bookId: "tfe", cursor: { chapterNumber: 9 } }] },
    });
    expect(store.writes).toBe(2);
  });

  it("returns the latest snapshot without writing when another coordinator changed progress", async () => {
    const store = new MemoryCursorStore();
    const reader = new HoidCursorProgressCoordinator(store, fixedNow);
    const other = new HoidCursorProgressCoordinator(store, fixedNow);
    await Promise.all([reader.initialize(), other.initialize()]);
    const staleBinding = progressBinding(store.snapshot);

    await other.advance("tfe", cursor("tfe", 4));
    const result = await reader.markChapterReadIfCurrent(
      "woa",
      1,
      staleBinding.revision,
      staleBinding.fingerprint,
      { confirmed: true },
    );

    expect(result).toMatchObject({
      status: "conflict",
      snapshot: { revision: 1, positions: [{ bookId: "tfe", cursor: { chapterNumber: 4 } }] },
    });
    expect(store.writes).toBe(1);
    expect(reader.getSnapshot()?.revision).toBe(1);
  });

  it("does not let the reader progress action skip an unread chapter", async () => {
    const { coordinator, store } = createCoordinator();
    await coordinator.advance("tfe", cursor("tfe", 7));
    const binding = progressBinding(store.snapshot);

    const result = await coordinator.markChapterReadIfCurrent(
      "tfe",
      9,
      binding.revision,
      binding.fingerprint,
      { confirmed: true },
    );

    expect(result).toEqual({
      status: "rejected",
      reason: "non-sequential-reader-advance",
    });
    expect(store.writes).toBe(1);
  });

  it("rejects malformed progress bindings before attempting a durable read", async () => {
    const { coordinator, store } = createCoordinator();
    const result = await coordinator.markChapterReadIfCurrent(
      "tfe",
      1,
      0,
      "not-a-sha256",
      { confirmed: true },
    );

    expect(result).toEqual({ status: "rejected", reason: "invalid-update" });
    expect(store.writes).toBe(0);
  });

  it("requires a separate explicit completion action after the final verified chapter", async () => {
    const { coordinator, store } = createCoordinator();
    await coordinator.advance("tfe", cursor("tfe", 37));
    const binding = progressBinding(store.snapshot);

    const chapterOnly = await coordinator.markChapterReadIfCurrent(
      "tfe",
      38,
      binding.revision,
      binding.fingerprint,
      { confirmed: true },
    );
    expect(chapterOnly).toEqual({
      status: "rejected",
      reason: "completion-requires-explicit-confirmation",
    });
    expect(store.writes).toBe(1);

    const completed = await coordinator.completeAfterReadingIfCurrent(
      "tfe",
      38,
      binding.revision,
      binding.fingerprint,
      { confirmed: true },
    );
    expect(completed).toMatchObject({
      status: "ready",
      operation: "updated",
      snapshot: { revision: 2, positions: [{ bookId: "tfe", completed: true }] },
    });
    expect(store.writes).toBe(2);
  });

  it("does not complete a work before its final chapter is the next chapter to read", async () => {
    const { coordinator, store } = createCoordinator();
    await coordinator.advance("tfe", cursor("tfe", 7));
    const binding = progressBinding(store.snapshot);

    const result = await coordinator.completeAfterReadingIfCurrent(
      "tfe",
      8,
      binding.revision,
      binding.fingerprint,
      { confirmed: true },
    );

    expect(result).toEqual({
      status: "rejected",
      reason: "non-sequential-reader-advance",
    });
    expect(store.writes).toBe(1);
  });

  it("requires an explicit canonical confirmation before changing reader progress", async () => {
    const { coordinator, store } = createCoordinator();
    const result = await coordinator.markChapterReadIfCurrent(
      "tfe",
      1,
      0,
      "a".repeat(64),
      {} as { confirmed: true },
    );

    expect(result).toEqual({
      status: "rejected",
      reason: "progress-confirmation-required",
    });
    expect(store.writes).toBe(0);
  });



});
