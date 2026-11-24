import { describe, expect, it } from "vitest";
import {
  emptyHoidUnitProgressSnapshot,
  HoidUnitProgressLedger,
  validateHoidUnitProgressSnapshot,
  type HoidUnitProgressSnapshot,
  type HoidUnitProgressStore,
} from "./unitProgressLedger";
import { createHoidUnitProgressCursor } from "./unitProgressCursor";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";

const fixedNow = () => "2026-11-24T14:00:00.000Z";
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

function cursor(bookId: string, chapterNumber: number) {
  const result = createHoidUnitProgressCursor(bookId, { chapterNumber });
  if (result.status !== "ready") throw new Error("Test cursor unavailable");
  return result.cursor;
}

function duplicateCursor(unitId: string) {
  const result = createHoidUnitProgressCursor("sawt", { chapterNumber: 12, unitId });
  if (result.status !== "ready") throw new Error("Exact duplicate cursor unavailable");
  return result.cursor;
}

function setup(store = new MemoryUnitProgressStore()) {
  return {
    store,
    coordinator: new HoidUnitProgressCoordinator(store, fixedNow),
  };
}

describe("HoidUnitProgressCoordinator", () => {
  it("initializes without emitting a progress-change event", async () => {
    const { coordinator } = setup();
    let events = 0;
    coordinator.subscribe(() => { events += 1; });

    expect(await coordinator.initialize()).toMatchObject({
      status: "ready",
      operation: "loaded",
      snapshot: { schemaVersion: 3, revision: 0, positions: [] },
    });
    expect(events).toBe(0);
  });

  it("emits a payload-free event only after a durable initial-position commit", async () => {
    const { coordinator } = setup();
    let eventArguments = -1;
    let events = 0;
    coordinator.subscribe((...args: unknown[]) => {
      eventArguments = args.length;
      events += 1;
    });
    await coordinator.initialize();

    const result = await coordinator.setInitialCursor("tfe", cursor("tfe", 1), 0, confirmed);
    expect(result).toMatchObject({
      status: "ready",
      operation: "updated",
      snapshot: { revision: 1, positions: [{ bookId: "tfe" }] },
    });
    expect(events).toBe(1);
    expect(eventArguments).toBe(0);
  });

  it("serializes local mutations and rejects a second action with a stale displayed revision", async () => {
    const { coordinator, store } = setup();
    await coordinator.initialize();

    const [first, second] = await Promise.all([
      coordinator.setInitialCursor("tfe", cursor("tfe", 1), 0, confirmed),
      coordinator.setInitialCursor("warbreaker", cursor("warbreaker", 1), 0, confirmed),
    ]);

    expect(first).toMatchObject({ status: "ready", snapshot: { revision: 1 } });
    expect(second).toMatchObject({
      status: "conflict",
      expectedRevision: 0,
      snapshot: { revision: 1 },
    });
    expect(store.writes).toBe(1);
  });

  it("refresh detects a durable change made by another coordinator and notifies listeners", async () => {
    const { coordinator, store } = setup();
    await coordinator.initialize();
    let events = 0;
    coordinator.subscribe(() => { events += 1; });

    const otherLedger = new HoidUnitProgressLedger(store, fixedNow);
    expect(await otherLedger.setInitialCursor("tfe", cursor("tfe", 1), 0, confirmed))
      .toMatchObject({ status: "ready", operation: "updated" });

    expect(await coordinator.refresh()).toMatchObject({
      status: "ready",
      operation: "refreshed",
      snapshot: { revision: 1 },
    });
    expect(events).toBe(1);
  });

  it("does not notify when refresh reads the same canonical snapshot", async () => {
    const { coordinator } = setup();
    await coordinator.initialize();
    let events = 0;
    coordinator.subscribe(() => { events += 1; });

    await coordinator.refresh();
    await coordinator.refresh();
    expect(events).toBe(0);
  });

  it("requires the caller's expected revision to match the latest durable snapshot", async () => {
    const { coordinator, store } = setup();
    await coordinator.initialize();
    const otherLedger = new HoidUnitProgressLedger(store, fixedNow);
    await otherLedger.setInitialCursor("tfe", cursor("tfe", 1), 0, confirmed);

    const result = await coordinator.setInitialCursor("warbreaker", cursor("warbreaker", 1), 0, confirmed);
    expect(result).toMatchObject({
      status: "conflict",
      expectedRevision: 0,
      snapshot: { revision: 1 },
    });
    expect(coordinator.getSnapshot()).toMatchObject({ revision: 1 });
  });

  it("keeps exact duplicate chapter identity in the local snapshot without inventing a numeric projection", async () => {
    const { coordinator } = setup();
    await coordinator.initialize();

    const result = await coordinator.setInitialCursor(
      "sawt",
      duplicateCursor("chapter:012:unit:012"),
      0,
      confirmed,
    );
    expect(result).toMatchObject({
      status: "ready",
      snapshot: {
        positions: [{
          bookId: "sawt",
          cursor: { reference: { chapterNumber: 12, ordinal: 12, labelAmbiguous: true } },
        }],
      },
    });
    if (result.status !== "ready") throw new Error("Expected a ready snapshot");
    const reference = result.snapshot.positions[0];
    if (!("cursor" in reference)) throw new Error("Expected a cursor position");
    expect(Object.keys(reference.cursor.reference)).not.toContain("locatorId");
  });

  it("emits no event for rejected jumps or unchanged progress", async () => {
    const { coordinator } = setup();
    await coordinator.initialize();
    let events = 0;
    coordinator.subscribe(() => { events += 1; });

    expect(await coordinator.advance("tfe", cursor("tfe", 3), 0, confirmed))
      .toMatchObject({ status: "rejected", reason: "non-sequential-advance" });
    expect(await coordinator.setInitialCursor("tfe", cursor("tfe", 1), 0, confirmed))
      .toMatchObject({ status: "ready", operation: "updated" });
    expect(await coordinator.advance("tfe", cursor("tfe", 1), 1, confirmed))
      .toMatchObject({ status: "ready", operation: "unchanged" });
    expect(events).toBe(1);
  });

  it("isolates listener exceptions from a successful ledger commit", async () => {
    const { coordinator, store } = setup();
    await coordinator.initialize();
    coordinator.subscribe(() => { throw new Error("listener failed"); });

    const result = await coordinator.setInitialCursor("tfe", cursor("tfe", 1), 0, confirmed);
    expect(result).toMatchObject({ status: "ready", operation: "updated" });
    expect(store.writes).toBe(1);
  });

  it("invalidates the local snapshot when durable storage becomes unavailable", async () => {
    const { coordinator, store } = setup();
    await coordinator.initialize();
    await coordinator.setInitialCursor("tfe", cursor("tfe", 1), 0, confirmed);
    let events = 0;
    coordinator.subscribe(() => { events += 1; });
    store.failReads = true;

    expect(await coordinator.refresh()).toEqual({ status: "unavailable", reason: "storage-error" });
    expect(coordinator.getSnapshot()).toBeNull();
    expect(events).toBe(1);
  });

  it("supports explicit correction and explicit whole-work completion", async () => {
    const { coordinator } = setup();
    await coordinator.initialize();
    await coordinator.setInitialCursor("tfe", cursor("tfe", 5), 0, confirmed);

    expect(await coordinator.correctCursor("tfe", cursor("tfe", 3), 1, {}))
      .toMatchObject({ status: "rejected", reason: "progress-confirmation-required" });
    expect(await coordinator.correctCursor("tfe", cursor("tfe", 3), 1, confirmed))
      .toMatchObject({ status: "ready", operation: "updated", snapshot: { revision: 2 } });
    expect(await coordinator.complete("tfe", 2, confirmed))
      .toMatchObject({
        status: "ready",
        operation: "updated",
        snapshot: { revision: 3, positions: [{ bookId: "tfe", completed: true }] },
      });
  });

  it("notifies once on disposal and rejects subsequent operations", async () => {
    const { coordinator } = setup();
    await coordinator.initialize();
    await coordinator.setInitialCursor("tfe", cursor("tfe", 1), 0, confirmed);
    let events = 0;
    coordinator.subscribe(() => { events += 1; });

    coordinator.dispose();
    coordinator.dispose();
    expect(events).toBe(1);
    expect(coordinator.getSnapshot()).toBeNull();
    expect(await coordinator.refresh()).toEqual({ status: "unavailable", reason: "disposed" });
    expect(await coordinator.complete("tfe", 1, confirmed))
      .toEqual({ status: "unavailable", reason: "disposed" });
  });
});
