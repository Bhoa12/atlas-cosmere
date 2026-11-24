import { describe, expect, it, vi } from "vitest";
import {
  createHoidCursorBackedUnitProgressRuntime,
  HoidCursorBackedUnitProgressStore,
  projectHoidCursorProgressToUnitProgress,
  type HoidCursorProgressInvalidationSource,
} from "./cursorBackedUnitProgressStore";
import {
  emptyHoidCursorProgressSnapshot,
  type HoidCursorProgressSnapshot,
} from "./cursorProgressLedger";
import type {
  HoidCursorProgressStore,
  HoidCursorStoreLoadResult,
} from "./cursorSqliteProgressStore";
import { createHoidReadingCursor } from "./readingManifest";

const now = "2026-11-24T22:00:00.000Z";

function cursorSnapshot(
  bookId = "tfe",
  chapterNumber = 3,
  revision = 1,
): HoidCursorProgressSnapshot {
  const created = createHoidReadingCursor(bookId, chapterNumber);
  if (created.status !== "ready") throw new Error("Synthetic cursor unavailable");
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze([
      Object.freeze({ bookId, cursor: created.cursor }),
    ]),
    updatedAt: now,
  });
}

class MemoryCursorStore implements HoidCursorProgressStore {
  value: HoidCursorProgressSnapshot = emptyHoidCursorProgressSnapshot();
  loadResult: HoidCursorStoreLoadResult | null = null;
  casCalls = 0;

  async load(): Promise<HoidCursorStoreLoadResult> {
    return this.loadResult ?? Object.freeze({
      status: "ready" as const,
      snapshot: this.value,
      migratedFromV1: false,
    });
  }

  async read(): Promise<unknown> {
    const result = await this.load();
    return result.status === "ready" ? result.snapshot : null;
  }

  async compareAndSwap(): Promise<boolean> {
    this.casCalls += 1;
    return false;
  }
}

class MemoryInvalidationSource implements HoidCursorProgressInvalidationSource {
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

describe("Hoid cursor-backed exact-unit progress bridge", () => {
  it("projects a valid reader cursor to the same exact edition unit", () => {
    const source = cursorSnapshot("tfe", 3, 7);
    const result = projectHoidCursorProgressToUnitProgress(source);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.snapshot).toMatchObject({
      schemaVersion: 3,
      revision: 7,
      positions: [{
        bookId: "tfe",
        cursor: {
          kind: "unit-progress-cursor",
          reference: {
            bookId: "tfe",
            unitId: "chapter:003",
            ordinal: 3,
            chapterNumber: 3,
          },
        },
      }],
      updatedAt: now,
    });
  });

  it("preserves explicit completion without inventing a cursor", () => {
    const source = Object.freeze({
      schemaVersion: 2,
      revision: 2,
      positions: Object.freeze([
        Object.freeze({ bookId: "tfe", completed: true as const }),
      ]),
      updatedAt: now,
    });
    const result = projectHoidCursorProgressToUnitProgress(source);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.snapshot.positions).toEqual([
      Object.freeze({ bookId: "tfe", completed: true }),
    ]);
  });

  it("projects a cursor on the verified prefix before Elantris duplicate labels", () => {
    const source = cursorSnapshot("elantris", 47, 4);
    const result = projectHoidCursorProgressToUnitProgress(source);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.snapshot.positions[0]).toMatchObject({
      bookId: "elantris",
      cursor: {
        reference: {
          chapterNumber: 47,
          ordinal: 47,
          labelAmbiguous: false,
        },
      },
    });
  });

  it("rejects a snapshot whose manifest identity has been changed", () => {
    const valid = cursorSnapshot();
    const position = valid.positions[0];
    if (!("cursor" in position)) throw new Error("Expected cursor");
    const tampered = Object.freeze({
      ...valid,
      positions: Object.freeze([
        Object.freeze({
          bookId: position.bookId,
          cursor: Object.freeze({ ...position.cursor, manifestId: "wrong-edition" }),
        }),
      ]),
    });

    expect(projectHoidCursorProgressToUnitProgress(tampered)).toEqual({
      status: "unavailable",
      reason: "invalid-cursor-snapshot",
    });
  });

  it("fails closed when the cursor store cannot load", async () => {
    const source = new MemoryCursorStore();
    source.loadResult = Object.freeze({ status: "unavailable", reason: "storage-error" });
    const store = new HoidCursorBackedUnitProgressStore(source);
    await expect(store.read()).resolves.toBeNull();
  });

  it("never writes through to the cursor ledger", async () => {
    const source = new MemoryCursorStore();
    source.value = cursorSnapshot();
    const store = new HoidCursorBackedUnitProgressStore(source);

    expect(await store.compareAndSwap(1, {
      schemaVersion: 3,
      revision: 2,
      positions: [],
      updatedAt: now,
    })).toBe(false);
    expect(source.casCalls).toBe(0);
  });

  it("refreshes the exact-unit coordinator from the same durable cursor ledger", async () => {
    const source = new MemoryCursorStore();
    source.value = cursorSnapshot("tfe", 3, 1);
    const invalidation = new MemoryInvalidationSource();
    const runtime = createHoidCursorBackedUnitProgressRuntime(source, invalidation, () => now);
    expect(runtime).not.toBeNull();
    if (!runtime) return;

    const first = await runtime.coordinator.initialize();
    expect(first.status).toBe("ready");
    if (first.status !== "ready") return;
    expect(first.snapshot.revision).toBe(1);

    const changed = cursorSnapshot("tfe", 4, 2);
    source.value = changed;
    const listener = vi.fn();
    runtime.coordinator.subscribe(listener);
    const refreshed = await runtime.coordinator.refresh();

    expect(refreshed.status).toBe("ready");
    if (refreshed.status === "ready") {
      expect(refreshed.snapshot.revision).toBe(2);
      expect(refreshed.snapshot.positions[0]).toMatchObject({
        cursor: { reference: { unitId: "chapter:004", ordinal: 4 } },
      });
    }
    expect(listener).toHaveBeenCalledTimes(1);
    runtime.coordinator.dispose();
  });

  it("delegates payload-free invalidation and preserves unsubscribe", () => {
    const source = new MemoryCursorStore();
    const invalidation = new MemoryInvalidationSource();
    const runtime = createHoidCursorBackedUnitProgressRuntime(source, invalidation, () => now);
    expect(runtime).not.toBeNull();
    if (!runtime) return;

    const listener = vi.fn();
    const unsubscribe = runtime.progressInvalidation.subscribe(listener);
    invalidation.emit();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    invalidation.emit();
    expect(listener).toHaveBeenCalledTimes(1);
    runtime.coordinator.dispose();
  });

  it("rejects accessor-backed progress-source methods without executing getters", () => {
    const source = new MemoryCursorStore();
    let getterCalls = 0;
    const hostile = Object.create(Object.getPrototypeOf(source)) as object;
    Object.defineProperty(hostile, "subscribe", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return () => () => {};
      },
    });

    expect(createHoidCursorBackedUnitProgressRuntime(
      source,
      hostile as HoidCursorProgressInvalidationSource,
      () => now,
    )).toBeNull();
    expect(getterCalls).toBe(0);
  });
});
