import { describe, expect, it } from "vitest";
import {
  emptyHoidProgressLedger,
  type HoidProgressLedgerSnapshot,
  type HoidProgressStore,
} from "./progressLedger";
import { HoidProgressCoordinator } from "./progressCoordinator";
import { setAtlasChapterProgress } from "./atlasProgressActions";

class MemoryProgressStore implements HoidProgressStore {
  value: unknown = emptyHoidProgressLedger();

  async read(): Promise<unknown> {
    return this.value;
  }

  async compareAndSwap(expectedRevision: number, next: HoidProgressLedgerSnapshot): Promise<boolean> {
    const current = this.value as HoidProgressLedgerSnapshot;
    if (current.revision !== expectedRevision) return false;
    this.value = next;
    return true;
  }
}

const fixedClock = () => "2026-11-16T22:00:00.000Z";

describe("Atlas chapter action policy", () => {
  it("allows ordinary forward progress without correction flags", async () => {
    const coordinator = new HoidProgressCoordinator(new MemoryProgressStore(), fixedClock);

    const result = await setAtlasChapterProgress(coordinator, "tfe", 8);

    expect(result).toMatchObject({
      status: "ready",
      snapshot: { positions: [{ bookId: "tfe", chapter: 8 }] },
    });
  });

  it("does not silently authorize a backwards correction", async () => {
    const coordinator = new HoidProgressCoordinator(new MemoryProgressStore(), fixedClock);
    await setAtlasChapterProgress(coordinator, "tfe", 8);

    const result = await setAtlasChapterProgress(coordinator, "tfe", 5);

    expect(result).toEqual({
      status: "rejected",
      reason: "regression-requires-confirmation",
    });
    expect(coordinator.getSnapshot()?.positions).toEqual([{ bookId: "tfe", chapter: 8 }]);
  });

  it("does not reopen a completed work through the ordinary chapter setter", async () => {
    const coordinator = new HoidProgressCoordinator(new MemoryProgressStore(), fixedClock);
    await coordinator.setCompleted("tfe", true);

    const result = await setAtlasChapterProgress(coordinator, "tfe", 4);

    expect(result).toEqual({ status: "rejected", reason: "already-completed" });
    expect(coordinator.getSnapshot()?.positions).toEqual([{ bookId: "tfe", completed: true }]);
  });
});
