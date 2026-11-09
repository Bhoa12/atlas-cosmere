import { describe, expect, it } from "vitest";
import { resolveSourceCollectionCoverage } from "./sourceCollectionCoverage";

const catalog = [
  { id: "mistborn-final-empire", title: "El Imperio Final", sourceCollectionId: "cosmere.epub", access: "verified-structure" as const },
  { id: "elantris", title: "Elantris", sourceCollectionId: "cosmere.epub", access: "verified-structure" as const },
];

describe("source collection coverage", () => {
  it("reports complete coverage from explicit metadata", () => {
    expect(resolveSourceCollectionCoverage(catalog, {
      sourceCollectionId: "cosmere.epub",
      expectedEntryIds: ["mistborn-final-empire", "elantris"],
    })).toEqual({
      status: "complete",
      sourceCollectionId: "cosmere.epub",
      missingEntryIds: [],
    });
  });

  it("reports only explicitly missing identifiers", () => {
    const result = resolveSourceCollectionCoverage(catalog, {
      sourceCollectionId: "cosmere.epub",
      expectedEntryIds: ["elantris", "warbreaker"],
    });
    expect(result.status).toBe("incomplete");
    expect(result.missingEntryIds).toEqual(["warbreaker"]);
  });

  it("fails closed for malformed catalogs and duplicate expectations", () => {
    expect(resolveSourceCollectionCoverage([...catalog, { ...catalog[0] }], {
      sourceCollectionId: "cosmere.epub",
      expectedEntryIds: ["elantris"],
    }).status).toBe("blocked");

    expect(resolveSourceCollectionCoverage(catalog, {
      sourceCollectionId: "cosmere.epub",
      expectedEntryIds: ["elantris", "elantris"],
    }).status).toBe("blocked");
  });
});
