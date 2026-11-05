import { describe, expect, it } from "vitest";
import { validateCatalogExpansionConsistency } from "./catalogExpansionConsistency";

describe("validateCatalogExpansionConsistency", () => {
  it("accepts progress scoped to declared works and units", () => {
    expect(validateCatalogExpansionConsistency(
      ["mistborn-1"],
      [{ id: "u1", workId: "mistborn-1", position: 1 }],
      [{ workId: "mistborn-1", completedUnitIds: ["u1"] }],
    )).toEqual([]);
  });

  it("reports unknown works and units without inferring replacements", () => {
    expect(validateCatalogExpansionConsistency(
      ["mistborn-1"],
      [{ id: "u2", workId: "unknown", position: 1 }],
      [
        { workId: "unknown", completedUnitIds: [] },
        { workId: "mistborn-1", completedUnitIds: ["u2"] },
      ],
    )).toEqual([
      { code: "unknown_work", layer: "reading_unit", workId: "unknown", unitId: "u2" },
      { code: "unknown_work", layer: "progress", workId: "unknown" },
      { code: "foreign_unit", layer: "progress", workId: "mistborn-1", unitId: "u2" },
    ]);
  });
});
