import { describe, expect, it } from "vitest";
import { canUnlockAtReadingUnit } from "./readingProgressUnlockGate";

const units = [
  { id: "unit-1", order: 1 },
  { id: "unit-2", order: 2 },
  { id: "unit-3", order: 3 },
];

describe("canUnlockAtReadingUnit", () => {
  it("unlocks only when the declared requirement is completed", () => {
    const progress = { units, completedUnitIds: ["unit-1", "unit-2"] };

    expect(canUnlockAtReadingUnit({ unitId: "unit-1" }, progress)).toBe(true);
    expect(canUnlockAtReadingUnit({ unitId: "unit-2" }, progress)).toBe(true);
    expect(canUnlockAtReadingUnit({ unitId: "unit-3" }, progress)).toBe(false);
  });

  it("fails closed for skipped or ambiguous progress", () => {
    expect(
      canUnlockAtReadingUnit(
        { unitId: "unit-2" },
        { units, completedUnitIds: ["unit-2"] },
      ),
    ).toBe(false);

    expect(
      canUnlockAtReadingUnit(
        { unitId: "unit-1" },
        { units: [], completedUnitIds: ["unit-1"] },
      ),
    ).toBe(false);
  });

  it("rejects undeclared or malformed requirements", () => {
    const progress = { units, completedUnitIds: ["unit-1"] };

    expect(canUnlockAtReadingUnit({ unitId: "unknown" }, progress)).toBe(false);
    expect(canUnlockAtReadingUnit({ unitId: " " }, progress)).toBe(false);
  });
});
