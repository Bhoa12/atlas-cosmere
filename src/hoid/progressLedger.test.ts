import { describe, expect, it } from "vitest";
import {
  emptyHoidProgressLedger,
  HoidProgressLedger,
  type HoidProgressLedgerSnapshot,
  type HoidProgressStore,
} from "./progressLedger";

class MemoryProgressStore implements HoidProgressStore {
  value: unknown = emptyHoidProgressLedger();
  rejectNextWrite = false;
  throwOnRead = false;
  throwOnWrite = false;

  async read(): Promise<unknown> {
    if (this.throwOnRead) throw new Error("read failed");
    return this.value;
  }

  async compareAndSwap(expectedRevision: number, next: HoidProgressLedgerSnapshot): Promise<boolean> {
    if (this.throwOnWrite) throw new Error("write failed");
    const currentRevision = (this.value as { revision?: number } | null)?.revision;
    if (this.rejectNextWrite || currentRevision !== expectedRevision) {
      this.rejectNextWrite = false;
      return false;
    }
    this.value = next;
    return true;
  }
}

const fixedClock = () => "2026-11-16T12:00:00.000Z";

describe("Hoid progress ledger", () => {
  it("starts with an empty, versioned snapshot", async () => {
    const ledger = new HoidProgressLedger(new MemoryProgressStore(), fixedClock);
    const result = await ledger.read();
    expect(result).toMatchObject({
      status: "ready",
      snapshot: { schemaVersion: 1, revision: 0, positions: [], updatedAt: null },
    });
  });

  it("advances one work without changing another work's progress", async () => {
    const store = new MemoryProgressStore();
    store.value = {
      schemaVersion: 1,
      revision: 4,
      positions: [{ bookId: "tfe", chapter: 8 }, { bookId: "elantris", chapter: 12 }],
      updatedAt: "2026-11-15T12:00:00.000Z",
    };
    const ledger = new HoidProgressLedger(store, fixedClock);
    const result = await ledger.update({ expectedRevision: 4, bookId: "tfe", chapter: 9 });
    expect(result).toMatchObject({
      status: "updated",
      snapshot: {
        revision: 5,
        positions: [{ bookId: "elantris", chapter: 12 }, { bookId: "tfe", chapter: 9 }],
      },
    });
  });

  it("rejects a stale expected revision before writing", async () => {
    const store = new MemoryProgressStore();
    const ledger = new HoidProgressLedger(store, fixedClock);
    const result = await ledger.update({ expectedRevision: 3, bookId: "tfe", chapter: 1 });
    expect(result).toEqual({ status: "conflict", expectedRevision: 3 });
    expect((store.value as HoidProgressLedgerSnapshot).revision).toBe(0);
  });

  it("requires explicit confirmation before moving progress backwards", async () => {
    const store = new MemoryProgressStore();
    store.value = {
      schemaVersion: 1,
      revision: 2,
      positions: [{ bookId: "tfe", chapter: 8 }],
      updatedAt: "2026-11-15T12:00:00.000Z",
    };
    const ledger = new HoidProgressLedger(store, fixedClock);
    const result = await ledger.update({ expectedRevision: 2, bookId: "tfe", chapter: 5 });
    expect(result).toEqual({ status: "rejected", reason: "regression-requires-confirmation" });
  });

  it("allows a deliberate correction when regression is explicitly confirmed", async () => {
    const store = new MemoryProgressStore();
    store.value = {
      schemaVersion: 1,
      revision: 2,
      positions: [{ bookId: "tfe", chapter: 8 }],
      updatedAt: "2026-11-15T12:00:00.000Z",
    };
    const ledger = new HoidProgressLedger(store, fixedClock);
    const result = await ledger.update({
      expectedRevision: 2,
      bookId: "tfe",
      chapter: 5,
      allowRegression: true,
    });
    expect(result).toMatchObject({ status: "updated", snapshot: { revision: 3, positions: [{ bookId: "tfe", chapter: 5 }] } });
  });

  it("requires an explicit completion confirmation", async () => {
    const store = new MemoryProgressStore();
    const ledger = new HoidProgressLedger(store, fixedClock);
    const result = await ledger.update({ expectedRevision: 0, bookId: "tfe", complete: true });
    expect(result).toEqual({ status: "rejected", reason: "completion-not-confirmed" });
  });

  it("records completion as a distinct state without inventing a final chapter", async () => {
    const store = new MemoryProgressStore();
    const ledger = new HoidProgressLedger(store, fixedClock);
    const result = await ledger.update({
      expectedRevision: 0,
      bookId: "tfe",
      complete: true,
      confirmCompletion: true,
    });
    expect(result).toMatchObject({
      status: "updated",
      snapshot: { revision: 1, positions: [{ bookId: "tfe", completed: true }] },
    });
  });

  it("does not reopen a completed work unless the caller explicitly requests it", async () => {
    const store = new MemoryProgressStore();
    store.value = {
      schemaVersion: 1,
      revision: 1,
      positions: [{ bookId: "tfe", completed: true }],
      updatedAt: "2026-11-15T12:00:00.000Z",
    };
    const ledger = new HoidProgressLedger(store, fixedClock);
    const result = await ledger.update({ expectedRevision: 1, bookId: "tfe", chapter: 3 });
    expect(result).toEqual({ status: "rejected", reason: "already-completed" });
  });

  it("supports an explicitly requested reopening of a completed work", async () => {
    const store = new MemoryProgressStore();
    store.value = {
      schemaVersion: 1,
      revision: 1,
      positions: [{ bookId: "tfe", completed: true }],
      updatedAt: "2026-11-15T12:00:00.000Z",
    };
    const ledger = new HoidProgressLedger(store, fixedClock);
    const result = await ledger.update({
      expectedRevision: 1,
      bookId: "tfe",
      chapter: 3,
      reopenCompleted: true,
    });
    expect(result).toMatchObject({ status: "updated", snapshot: { revision: 2, positions: [{ bookId: "tfe", chapter: 3 }] } });
  });

  it("rejects numeric positions for works without verified numeric segmentation", async () => {
    const ledger = new HoidProgressLedger(new MemoryProgressStore(), fixedClock);
    const result = await ledger.update({ expectedRevision: 0, bookId: "arcanum", chapter: 3 });
    expect(result).toEqual({ status: "rejected", reason: "unsupported-position" });
  });

  it("rejects unknown works instead of silently dropping their progress", async () => {
    const ledger = new HoidProgressLedger(new MemoryProgressStore(), fixedClock);
    const result = await ledger.update({ expectedRevision: 0, bookId: "unknown-work", chapter: 3 });
    expect(result).toEqual({ status: "rejected", reason: "unknown-work" });
  });

  it("rejects malformed snapshots and duplicate work positions", async () => {
    const store = new MemoryProgressStore();
    store.value = {
      schemaVersion: 1,
      revision: 2,
      positions: [{ bookId: "tfe", chapter: 3 }, { bookId: "tfe", chapter: 7 }],
      updatedAt: "2026-11-15T12:00:00.000Z",
    };
    const ledger = new HoidProgressLedger(store, fixedClock);
    expect(await ledger.read()).toEqual({ status: "unavailable", reason: "corrupt-ledger" });
  });

  it("rejects a compare-and-swap race without claiming the write succeeded", async () => {
    const store = new MemoryProgressStore();
    store.rejectNextWrite = true;
    const ledger = new HoidProgressLedger(store, fixedClock);
    const result = await ledger.update({ expectedRevision: 0, bookId: "tfe", chapter: 1 });
    expect(result).toEqual({ status: "conflict", expectedRevision: 0 });
    expect((store.value as HoidProgressLedgerSnapshot).revision).toBe(0);
  });

  it("fails closed when the store cannot be read or written", async () => {
    const readStore = new MemoryProgressStore();
    readStore.throwOnRead = true;
    const readLedger = new HoidProgressLedger(readStore, fixedClock);
    expect(await readLedger.read()).toEqual({ status: "unavailable", reason: "storage-error" });

    const writeStore = new MemoryProgressStore();
    writeStore.throwOnWrite = true;
    const writeLedger = new HoidProgressLedger(writeStore, fixedClock);
    expect(await writeLedger.update({ expectedRevision: 0, bookId: "tfe", chapter: 1 }))
      .toEqual({ status: "rejected", reason: "storage-error" });
  });

  it("rejects a non-canonical clock value before attempting persistence", async () => {
    const store = new MemoryProgressStore();
    const ledger = new HoidProgressLedger(store, () => "tomorrow");
    const result = await ledger.update({ expectedRevision: 0, bookId: "tfe", chapter: 1 });
    expect(result).toEqual({ status: "rejected", reason: "invalid-clock" });
    expect((store.value as HoidProgressLedgerSnapshot).revision).toBe(0);
  });
});
