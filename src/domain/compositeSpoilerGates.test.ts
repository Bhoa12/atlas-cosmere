import { describe, expect, it } from "vitest";
import { isCompositeSpoilerGateUnlocked } from "./compositeSpoilerGates";

describe("isCompositeSpoilerGateUnlocked", () => {
  const gate = { id: "cross-work", requirements: [
    { workId: "work-a", requiredPosition: 2 },
    { workId: "work-b", requiredPosition: 4 },
  ] };

  it("opens only when every explicit requirement is completed", () => {
    expect(isCompositeSpoilerGateUnlocked(gate, [
      { workId: "work-a", completedPositions: [2] },
      { workId: "work-b", completedPositions: [4] },
    ])).toBe(true);
  });

  it("fails closed when a checkpoint is missing or metadata is invalid", () => {
    expect(isCompositeSpoilerGateUnlocked(gate, [
      { workId: "work-a", completedPositions: [2] },
    ])).toBe(false);
    expect(isCompositeSpoilerGateUnlocked({ id: "bad", requirements: [
      { workId: "", requiredPosition: 0 },
    ] }, [])).toBe(false);
  });
});
