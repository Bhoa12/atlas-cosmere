import { describe, expect, it } from "vitest";
import { catalogProgressToCheckpointStates, toCheckpointStates } from "./readingCheckpointAdapters";

describe("reading checkpoint adapters", () => {
  it("maps only declared units belonging to the same work", () => {
    expect(toCheckpointStates(
      [
        { id: "a", workId: "work-a", position: 1 },
        { id: "b", workId: "work-a", position: 2 },
        { id: "shared", workId: "work-b", position: 9 },
      ],
      [{ workId: "work-a", completedUnitIds: ["b", "shared", "missing", "b"] }],
    )).toEqual([{ workId: "work-a", completedPositions: [2] }]);
  });

  it("preserves only valid catalog checkpoints", () => {
    expect(catalogProgressToCheckpointStates([
      { workId: "a", completedUnitOrder: 3 },
      { workId: "b", completedUnitOrder: 0 },
      { workId: "c", completedUnitOrder: 2.5 },
    ])).toEqual([{ workId: "a", completedPositions: [3] }]);
  });
});
