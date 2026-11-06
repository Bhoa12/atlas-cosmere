import { describe, expect, it } from "vitest";
import { hasConsistentReadingUnitProgress } from "./readingUnitProgress";

const units = [
  { id: "unit-1", order: 1 },
  { id: "unit-2", order: 2 },
  { id: "unit-3", order: 3 },
];

describe("hasConsistentReadingUnitProgress", () => {
  it("accepts an empty or contiguous completed prefix", () => {
    expect(hasConsistentReadingUnitProgress({ units, completedUnitIds: [] })).toBe(true);
    expect(hasConsistentReadingUnitProgress({ units, completedUnitIds: ["unit-1", "unit-2"] })).toBe(true);
  });

  it("rejects progress that skips a declared unit", () => {
    expect(hasConsistentReadingUnitProgress({ units, completedUnitIds: ["unit-2"] })).toBe(false);
  });

  it("rejects unknown or duplicate completed identifiers", () => {
    expect(hasConsistentReadingUnitProgress({ units, completedUnitIds: ["missing"] })).toBe(false);
    expect(hasConsistentReadingUnitProgress({ units, completedUnitIds: ["unit-1", "unit-1"] })).toBe(false);
  });

  it("fails closed for ambiguous unit structure", () => {
    expect(hasConsistentReadingUnitProgress({
      units: [{ id: "unit-1", order: 1 }, { id: "unit-1", order: 2 }],
      completedUnitIds: [],
    })).toBe(false);
    expect(hasConsistentReadingUnitProgress({ units: [], completedUnitIds: [] })).toBe(false);
  });
});
