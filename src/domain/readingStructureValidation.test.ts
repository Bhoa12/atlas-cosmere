import { describe, expect, it } from "vitest";
import { validateReadingStructure } from "./readingStructureValidation";

describe("validateReadingStructure", () => {
  it("accepts explicit, unique positive positions", () => {
    expect(validateReadingStructure([
      { id: "a1", workId: "work-a", position: 1 },
      { id: "a2", workId: "work-a", position: 2 },
      { id: "b1", workId: "work-b", position: 1 },
    ])).toEqual([]);
  });

  it("reports structural conflicts without guessing replacements", () => {
    expect(validateReadingStructure([
      { id: "a1", workId: "work-a", position: 1 },
      { id: "a1", workId: "work-a", position: 2 },
      { id: "a3", workId: "work-a", position: 1 },
      { id: "bad", workId: "work-b", position: 0 },
    ])).toEqual([
      { code: "duplicate_unit_id", workId: "work-a", unitId: "a1", conflictingUnitId: "a1" },
      { code: "duplicate_position", workId: "work-a", unitId: "a3", conflictingUnitId: "a1" },
      { code: "invalid_position", workId: "work-b", unitId: "bad" },
    ]);
  });
});
