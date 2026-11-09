import { describe, expect, it } from "vitest";
import { resolveReadingProgressIntegrity } from "./readingProgressIntegrity";

describe("resolveReadingProgressIntegrity", () => {
  const units = [
    { id: "unit-1", workId: "work-a", position: 1 },
    { id: "unit-2", workId: "work-a", position: 2 },
    { id: "unit-3", workId: "work-b", position: 1 },
  ];

  it("accepts explicitly structured units and matching progress", () => {
    expect(resolveReadingProgressIntegrity(units, [
      { workId: "work-a", completedUnitIds: ["unit-1"] },
    ])).toMatchObject({ status: "valid", blockedUnitIds: [], blockedWorkIds: [] });
  });

  it("blocks duplicate unit identifiers or positions within a work", () => {
    const result = resolveReadingProgressIntegrity([
      ...units,
      { id: "unit-1", workId: "work-b", position: 1 },
    ], []);

    expect(result.status).toBe("blocked");
    expect(result.blockedUnitIds).toContain("unit-1");
    expect(result.blockedWorkIds).toContain("work-b");
  });

  it("blocks progress that completes an unknown or cross-work unit", () => {
    const result = resolveReadingProgressIntegrity(units, [
      { workId: "work-a", completedUnitIds: ["unit-3", "missing"] },
    ]);

    expect(result.status).toBe("blocked");
    expect(result.blockedWorkIds).toContain("work-a");
    expect(result.blockedUnitIds).toEqual(expect.arrayContaining(["unit-3", "missing"]));
    expect(result.validProgress).toEqual([]);
  });

  it("blocks duplicate progress records for the same work", () => {
    expect(resolveReadingProgressIntegrity(units, [
      { workId: "work-a", completedUnitIds: [] },
      { workId: "work-a", completedUnitIds: [] },
    ]).status).toBe("blocked");
  });
});
