import { describe, expect, it } from "vitest";
import { resolveReadingUnitProgressStatus } from "./readingUnitProgressSnapshot";

const units = [
  { id: "unit-1", order: 1 },
  { id: "unit-2", order: 2 },
];

describe("resolveReadingUnitProgressStatus", () => {
  it("distinguishes valid progress states", () => {
    expect(resolveReadingUnitProgressStatus({ units, completedUnitIds: [] })).toBe("not-started");
    expect(resolveReadingUnitProgressStatus({ units, completedUnitIds: ["unit-1"] })).toBe("in-progress");
    expect(resolveReadingUnitProgressStatus({ units, completedUnitIds: ["unit-1", "unit-2"] })).toBe("complete");
  });

  it("fails closed for skipped or ambiguous progress", () => {
    expect(resolveReadingUnitProgressStatus({ units, completedUnitIds: ["unit-2"] })).toBe("blocked");
    expect(resolveReadingUnitProgressStatus({
      units: [{ id: "unit-1", order: 1 }, { id: "unit-1", order: 2 }],
      completedUnitIds: [],
    })).toBe("blocked");
  });

  it("fails closed for an undeclared unit structure", () => {
    expect(resolveReadingUnitProgressStatus({ units: [], completedUnitIds: [] })).toBe("blocked");
  });
});
