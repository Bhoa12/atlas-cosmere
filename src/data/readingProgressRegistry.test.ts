import { validateReadingProgress } from "./readingProgressRegistry";

const registry = {
  isKnownWork: (workId: string) => workId === "example-work",
  isKnownUnit: (workId: string, unitId: string) =>
    workId === "example-work" && ["unit-1", "unit-2"].includes(unitId),
};

describe("validateReadingProgress", () => {
  it("accepts known units for a known work", () => {
    expect(validateReadingProgress({ workId: "example-work", completedUnitIds: ["unit-1"] }, registry)).toBe(true);
  });

  it("rejects duplicate or unknown units", () => {
    expect(validateReadingProgress({ workId: "example-work", completedUnitIds: ["unit-1", "unit-1"] }, registry)).toBe(false);
    expect(validateReadingProgress({ workId: "example-work", completedUnitIds: ["unknown"] }, registry)).toBe(false);
  });

  it("rejects unknown works", () => {
    expect(validateReadingProgress({ workId: "unknown-work", completedUnitIds: [] }, registry)).toBe(false);
  });
});