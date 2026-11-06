import { describe, expect, it } from "vitest";
import { hasConsistentProgress } from "./progressConsistency";

describe("hasConsistentProgress", () => {
  it("accepts consistent structural progress", () => {
    expect(
      hasConsistentProgress({
        declaredPositions: 3,
        completedPositions: 1,
        next: { position: 2 },
      }),
    ).toBe(true);
  });

  it("rejects a completed total with a contradictory next position", () => {
    expect(
      hasConsistentProgress({
        declaredPositions: 3,
        completedPositions: 3,
        next: { position: 4 },
      }),
    ).toBe(false);
  });

  it("rejects malformed counts", () => {
    expect(
      hasConsistentProgress({
        declaredPositions: 0,
        completedPositions: 0,
        next: null,
      }),
    ).toBe(false);
    expect(
      hasConsistentProgress({
        declaredPositions: 2,
        completedPositions: 3,
        next: null,
      }),
    ).toBe(false);
  });
});
