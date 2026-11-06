import { describe, expect, it } from "vitest";
import { normalizeCheckpointStates } from "./readingCheckpointNormalization";

describe("checkpoint normalization", () => {
  it("merges duplicate work states and removes invalid coordinates", () => {
    expect(normalizeCheckpointStates([
      { workId: "scadrial-a", completedPositions: [3, 1, 3, 0, 2.5] },
      { workId: "scadrial-a", completedPositions: [2, -1] },
    ])).toEqual([
      { workId: "scadrial-a", completedPositions: [1, 2, 3] },
    ]);
  });

  it("ignores blank work identifiers without guessing replacements", () => {
    expect(normalizeCheckpointStates([
      { workId: " ", completedPositions: [1] },
      { workId: "sel-a", completedPositions: [4] },
    ])).toEqual([
      { workId: "sel-a", completedPositions: [4] },
    ]);
  });
});
