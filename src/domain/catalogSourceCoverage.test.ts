import { describe, expect, it } from "vitest";
import { validateCatalogSourceCoverage } from "./catalogSourceCoverage";

const worlds = [{
  id: "scadrial",
  name: "Scadrial",
  works: [{
    id: "work-a",
    worldId: "scadrial",
    title: "Declared Work",
    sequence: 1,
    format: "novel" as const,
    units: [],
  }],
}];

describe("validateCatalogSourceCoverage", () => {
  it("accepts a declared work with explicit provenance", () => {
    expect(validateCatalogSourceCoverage(worlds, [{
      workId: "work-a",
      sourceId: "private-catalog",
    }])).toEqual([]);
  });

  it("reports missing provenance without inventing a source", () => {
    expect(validateCatalogSourceCoverage(worlds, [])).toEqual([
      { code: "missing_provenance", workId: "work-a" },
    ]);
  });

  it("reports provenance for an unknown work", () => {
    expect(validateCatalogSourceCoverage(worlds, [{
      workId: "missing-work",
      sourceId: "private-catalog",
    }])).toEqual([
      { code: "missing_provenance", workId: "work-a" },
      {
        code: "provenance_for_unknown_work",
        workId: "missing-work",
        sourceId: "private-catalog",
      },
    ]);
  });
});
