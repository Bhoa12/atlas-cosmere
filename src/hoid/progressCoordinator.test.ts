import { describe, expect, it } from "vitest";
import {
  emptyHoidProgressLedger,
  type HoidProgressLedgerSnapshot,
  type HoidProgressStore,
} from "./progressLedger";
import {
  atlasProgressFromSnapshot,
  HoidProgressCoordinator,
} from "./progressCoordinator";

class MemoryProgressStore implements HoidProgressStore {
  value: unknown = emptyHoidProgressLedger();
  failReads = false;
  writes = 0;

  async read(): Promise<unknown> {
    if (this.failReads) throw new Error("storage unavailable");
    return this.value;
  }

  async compareAndSwap(expectedRevision: number, next: HoidProgressLedgerSnapshot): Promise<boolean> {
    const current = this.value as HoidProgressLedgerSnapshot;
    if (current.revision !== expectedRevision) return false;
    this.value = next;
    this.writes += 1;
    return true;
  }
}

const fixedClock = () => "2026-11-16T20:00:00.000Z";

describe("Hoid progress coordinator", () => {
  it("hydrates an empty persisted ledger without inventing reading progress", async () => {
    const coordinator = new HoidProgressCoordinator(new MemoryProgressStore(), fixedClock);
    const result = await coordinator.initialize();

    expect(result).toMatchObject({
      status: "ready",
      operation: "loaded",
      snapshot: { revision: 0, positions: [] },
    });
  });

  it("serializes chapter writes and preserves progress across different works", async () => {
    const coordinator = new HoidProgressCoordinator(new MemoryProgressStore(), fixedClock);
    await coordinator.initialize();

    const results = await Promise.all([
      coordinator.setChapter("tfe", 8),
      coordinator.setChapter("elantris", 12),
    ]);

    expect(results.every(result => result.status === "ready")).toBe(true);
    expect(coordinator.getSnapshot()).toMatchObject({
      revision: 2,
      positions: [
        { bookId: "elantris", chapter: 12 },
        { bookId: "tfe", chapter: 8 },
      ],
    });
  });

  it("persists explicit completion as a separate state", async () => {
    const coordinator = new HoidProgressCoordinator(new MemoryProgressStore(), fixedClock);
    const result = await coordinator.setCompleted("tfe", true);

    expect(result).toMatchObject({
      status: "ready",
      snapshot: { positions: [{ bookId: "tfe", completed: true }] },
    });
  });

  it("reopens a completed numeric work at chapter one after an explicit unread action", async () => {
    const store = new MemoryProgressStore();
    const coordinator = new HoidProgressCoordinator(store, fixedClock);
    await coordinator.setCompleted("tfe", true);

    const reopened = await coordinator.setCompleted("tfe", false);
    expect(reopened).toMatchObject({
      status: "ready",
      snapshot: { positions: [{ bookId: "tfe", chapter: 1 }] },
    });
  });

  it("requires explicit confirmation before moving a chapter cursor backwards", async () => {
    const coordinator = new HoidProgressCoordinator(new MemoryProgressStore(), fixedClock);
    await coordinator.setChapter("tfe", 8);

    const rejected = await coordinator.setChapter("tfe", 5);
    expect(rejected).toEqual({ status: "rejected", reason: "regression-requires-confirmation" });

    const corrected = await coordinator.setChapter("tfe", 5, { allowRegression: true });
    expect(corrected).toMatchObject({ status: "ready", snapshot: { positions: [{ bookId: "tfe", chapter: 5 }] } });
  });

  it("requires an explicit reopen option when setting a chapter on a completed work", async () => {
    const coordinator = new HoidProgressCoordinator(new MemoryProgressStore(), fixedClock);
    await coordinator.setCompleted("tfe", true);

    expect(await coordinator.setChapter("tfe", 4))
      .toEqual({ status: "rejected", reason: "already-completed" });

    expect(await coordinator.setChapter("tfe", 4, { reopenCompleted: true }))
      .toMatchObject({ status: "ready", snapshot: { positions: [{ bookId: "tfe", chapter: 4 }] } });
  });

  it("rejects numeric cursors for unsegmented collections", async () => {
    const coordinator = new HoidProgressCoordinator(new MemoryProgressStore(), fixedClock);
    const result = await coordinator.setChapter("arcanum", 3);
    expect(result).toEqual({ status: "rejected", reason: "unsupported-position" });
  });

  it("refreshes its snapshot after a compare-and-swap conflict", async () => {
    const store = new MemoryProgressStore();
    const coordinator = new HoidProgressCoordinator(store, fixedClock);
    await coordinator.initialize();

    store.value = {
      schemaVersion: 1,
      revision: 1,
      positions: [{ bookId: "elantris", chapter: 2 }],
      updatedAt: fixedClock(),
    };

    const result = await coordinator.setChapter("tfe", 4);
    expect(result).toMatchObject({
      status: "conflict",
      snapshot: { revision: 1, positions: [{ bookId: "elantris", chapter: 2 }] },
    });
    expect(coordinator.getSnapshot()?.revision).toBe(1);
  });

  it("fails closed when persisted progress cannot be read", async () => {
    const store = new MemoryProgressStore();
    store.failReads = true;
    const coordinator = new HoidProgressCoordinator(store, fixedClock);

    expect(await coordinator.initialize()).toEqual({ status: "unavailable", reason: "storage-error" });
    expect(await coordinator.setChapter("tfe", 1)).toEqual({ status: "unavailable", reason: "storage-error" });
    expect(store.writes).toBe(0);
  });

  it("restores only own canonical maps from a validated snapshot", () => {
    const progress = atlasProgressFromSnapshot({
      schemaVersion: 1,
      revision: 2,
      positions: [
        { bookId: "tfe", chapter: 8 },
        { bookId: "elantris", completed: true },
      ],
      updatedAt: fixedClock(),
    });

    expect(progress.chaptersByBook.tfe).toBe(8);
    expect(progress.completedByBook.elantris).toBe(true);
    expect(Object.getPrototypeOf(progress.chaptersByBook)).toBeNull();
    expect(Object.getPrototypeOf(progress.completedByBook)).toBeNull();
    expect(Object.keys(progress.chaptersByBook)).toEqual(["tfe"]);
  });
});
