import { describe, expect, it } from "vitest";
import {
  emptyHoidUnitProgressSnapshot,
  HoidUnitProgressLedger,
  validateHoidUnitProgressSnapshot,
  type HoidUnitProgressSnapshot,
  type HoidUnitProgressStore,
} from "./unitProgressLedger";
import {
  createHoidUnitProgressCursor,
  type HoidUnitProgressCursor,
} from "./unitProgressCursor";

const fixedNow = () => "2026-11-24T12:00:00.000Z";
const confirmed = Object.freeze({ confirmed: true as const });

class MemoryUnitProgressStore implements HoidUnitProgressStore {
  value: unknown = emptyHoidUnitProgressSnapshot();
  failReads = false;
  failWrites = false;
  writes = 0;

  async read(): Promise<unknown> {
    if (this.failReads) throw new Error("read failed");
    return this.value;
  }

  async compareAndSwap(expectedRevision: number, next: HoidUnitProgressSnapshot): Promise<boolean> {
    if (this.failWrites) throw new Error("write failed");
    const current = validateHoidUnitProgressSnapshot(this.value);
    const candidate = validateHoidUnitProgressSnapshot(next);
    if (current.status !== "valid" || candidate.status !== "valid") return false;
    if (current.snapshot.revision !== expectedRevision) return false;
    this.value = candidate.snapshot;
    this.writes += 1;
    return true;
  }
}

function cursor(bookId: string, chapterNumber: number): HoidUnitProgressCursor {
  const result = createHoidUnitProgressCursor(bookId, { chapterNumber });
  if (result.status !== "ready") throw new Error("Test cursor unavailable");
  return result.cursor;
}

function duplicateCursor(unitId: string): HoidUnitProgressCursor {
  const result = createHoidUnitProgressCursor("sawt", {
    chapterNumber: 12,
    unitId,
  });
  if (result.status !== "ready") throw new Error("Exact duplicate test cursor unavailable");
  return result.cursor;
}

function createLedger(store = new MemoryUnitProgressStore()) {
  return {
    store,
    ledger: new HoidUnitProgressLedger(store, fixedNow),
  };
}

describe("HoidUnitProgressLedger", () => {
  it("starts with an empty v3 snapshot and grants no reading progress", async () => {
    const { ledger } = createLedger();
    expect(await ledger.read()).toMatchObject({
      status: "ready",
      snapshot: { schemaVersion: 3, revision: 0, positions: [], updatedAt: null },
    });
  });

  it("requires an explicit attestation before setting an initial cursor", async () => {
    const { ledger, store } = createLedger();
    expect(await ledger.setInitialCursor("tfe", cursor("tfe", 8), 0, {})).toEqual({
      status: "rejected",
      reason: "progress-confirmation-required",
    });
    expect(store.writes).toBe(0);
  });

  it("allows an explicitly confirmed starting position and records its exact unit", async () => {
    const { ledger } = createLedger();
    const result = await ledger.setInitialCursor("tfe", cursor("tfe", 8), 0, confirmed);
    expect(result).toMatchObject({
      status: "ready",
      operation: "updated",
      snapshot: {
        schemaVersion: 3,
        revision: 1,
        positions: [{ bookId: "tfe", cursor: { reference: { ordinal: 8, chapterNumber: 8 } }, order: 0 }],
      },
    });
  });

  it("rejects a second initial position for the same work", async () => {
    const { ledger } = createLedger();
    await ledger.setInitialCursor("tfe", cursor("tfe", 2), 0, confirmed);
    expect(await ledger.setInitialCursor("tfe", cursor("tfe", 3), 1, confirmed)).toEqual({
      status: "rejected",
      reason: "already-positioned",
    });
  });

  it("advances only to the next exact ordinal", async () => {
    const { ledger } = createLedger();
    await ledger.setInitialCursor("tfe", cursor("tfe", 2), 0, confirmed);
    const result = await ledger.advance("tfe", cursor("tfe", 3), 1, confirmed);
    expect(result).toMatchObject({
      status: "ready",
      operation: "updated",
      snapshot: { revision: 2, positions: [{ bookId: "tfe", cursor: { reference: { ordinal: 3 } } }] },
    });
  });

  it("does not allow a normal advance to skip units", async () => {
    const { ledger, store } = createLedger();
    await ledger.setInitialCursor("tfe", cursor("tfe", 2), 0, confirmed);
    const result = await ledger.advance("tfe", cursor("tfe", 4), 1, confirmed);
    expect(result).toEqual({ status: "rejected", reason: "non-sequential-advance" });
    expect(store.writes).toBe(1);
  });

  it("does not allow normal advance to move backwards", async () => {
    const { ledger } = createLedger();
    await ledger.setInitialCursor("tfe", cursor("tfe", 5), 0, confirmed);
    expect(await ledger.advance("tfe", cursor("tfe", 4), 1, confirmed)).toEqual({
      status: "rejected",
      reason: "regression-requires-confirmation",
    });
  });

  it("requires explicit confirmation to correct a cursor backwards", async () => {
    const { ledger } = createLedger();
    await ledger.setInitialCursor("tfe", cursor("tfe", 8), 0, confirmed);
    expect(await ledger.correctCursor("tfe", cursor("tfe", 4), 1, {})).toEqual({
      status: "rejected",
      reason: "progress-confirmation-required",
    });
    expect(await ledger.correctCursor("tfe", cursor("tfe", 4), 1, confirmed)).toMatchObject({
      status: "ready",
      snapshot: { revision: 2, positions: [{ cursor: { reference: { ordinal: 4 } } }] },
    });
  });

  it("requires an exact unit identity for a duplicated chapter number", async () => {
    const { ledger } = createLedger();
    const first = duplicateCursor("chapter:012:unit:012");
    expect(first.reference).toMatchObject({ chapterNumber: 12, ordinal: 12, labelAmbiguous: true });
    expect(await ledger.setInitialCursor("sawt", first, 0, confirmed)).toMatchObject({
      status: "ready",
      snapshot: { positions: [{ cursor: { reference: { ordinal: 12, unitId: "chapter:012:unit:012" } } }] },
    });
  });

  it("does not unlock a later duplicated unit while the ordinal prefix is incomplete", async () => {
    const { ledger, store } = createLedger();
    const later = createHoidUnitProgressCursor("sawt", {
      chapterNumber: 12,
      unitId: "chapter:012:unit:014",
    });
    expect(later.status).toBe("unavailable");
    expect(store.writes).toBe(0);
  });

  it("does not infer whole-work completion from the final known numbered chapter", async () => {
    const { ledger } = createLedger();
    await ledger.setInitialCursor("tfe", cursor("tfe", 38), 0, confirmed);
    expect(await ledger.read()).toMatchObject({
      status: "ready",
      snapshot: { positions: [{ bookId: "tfe", cursor: { reference: { ordinal: 38 } } }] },
    });
  });

  it("requires a separate explicit attestation to complete a work", async () => {
    const { ledger } = createLedger();
    expect(await ledger.complete("tfe", 0, {})).toEqual({
      status: "rejected",
      reason: "progress-confirmation-required",
    });
    expect(await ledger.complete("tfe", 0, confirmed)).toMatchObject({
      status: "ready",
      snapshot: { revision: 1, positions: [{ bookId: "tfe", completed: true }] },
    });
  });

  it("blocks further advances after explicit completion", async () => {
    const { ledger } = createLedger();
    await ledger.complete("tfe", 0, confirmed);
    expect(await ledger.advance("tfe", cursor("tfe", 1), 1, confirmed)).toEqual({
      status: "rejected",
      reason: "already-completed",
    });
  });

  it("rejects stale expected revisions and returns the latest snapshot", async () => {
    const { ledger } = createLedger();
    await ledger.setInitialCursor("tfe", cursor("tfe", 2), 0, confirmed);
    expect(await ledger.advance("tfe", cursor("tfe", 3), 0, confirmed)).toMatchObject({
      status: "conflict",
      expectedRevision: 0,
      snapshot: { revision: 1 },
    });
  });

  it("detects an atomic compare-and-swap race between independent writers", async () => {
    const { ledger, store } = createLedger();
    const first = new HoidUnitProgressLedger(store, fixedNow);
    const second = new HoidUnitProgressLedger(store, fixedNow);
    const [left, right] = await Promise.all([
      first.setInitialCursor("tfe", cursor("tfe", 1), 0, confirmed),
      second.setInitialCursor("woa", cursor("woa", 1), 0, confirmed),
    ]);
    expect([left.status, right.status].filter(status => status === "ready")).toHaveLength(1);
    expect([left.status, right.status].filter(status => status === "conflict")).toHaveLength(1);
    expect(store.writes).toBe(1);
  });

  it("fails closed when storage is unavailable", async () => {
    const { ledger, store } = createLedger();
    store.failReads = true;
    expect(await ledger.read()).toEqual({ status: "unavailable", reason: "storage-error" });
  });

  it("does not persist when the injected clock is invalid", async () => {
    const store = new MemoryUnitProgressStore();
    const ledger = new HoidUnitProgressLedger(store, () => "not-a-date");
    expect(await ledger.complete("tfe", 0, confirmed)).toEqual({
      status: "unavailable",
      reason: "clock-error",
    });
    expect(store.writes).toBe(0);
  });

  it("rejects corrupted snapshots and duplicate work positions", async () => {
    const { ledger, store } = createLedger();
    store.value = { schemaVersion: 3, revision: 0, positions: [{ bookId: "tfe", completed: true }], updatedAt: null };
    expect(await ledger.read()).toEqual({ status: "unavailable", reason: "corrupt-ledger" });
  });

  it("rejects accessor-backed confirmation without invoking its getter", async () => {
    const { ledger, store } = createLedger();
    let invoked = false;
    const hostile = Object.defineProperty({}, "confirmed", {
      enumerable: true,
      get() {
        invoked = true;
        return true;
      },
    });
    expect(await ledger.complete("tfe", 0, hostile)).toEqual({
      status: "rejected",
      reason: "progress-confirmation-required",
    });
    expect(invoked).toBe(false);
    expect(store.writes).toBe(0);
  });

  it("rejects cursor references belonging to another work", async () => {
    const { ledger, store } = createLedger();
    expect(await ledger.setInitialCursor("woa", cursor("tfe", 2), 0, confirmed)).toEqual({
      status: "rejected",
      reason: "invalid-cursor",
    });
    expect(store.writes).toBe(0);
  });
});
