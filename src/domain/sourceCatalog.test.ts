import { describe, expect, it } from "vitest";
import { findCatalogEntry, hasValidSourceCatalog } from "./sourceCatalog";

const catalog = [
  { id: "mistborn-final-empire", title: "El Imperio Final", sourceCollectionId: "cosmere.epub", access: "verified-structure" as const },
  { id: "elantris", title: "Elantris", sourceCollectionId: "cosmere.epub", access: "verified-structure" as const },
];

describe("source catalog", () => {
  it("accepts unique bibliographic entries", () => {
    expect(hasValidSourceCatalog(catalog)).toBe(true);
  });

  it("rejects empty and duplicate identifiers", () => {
    expect(hasValidSourceCatalog([])).toBe(false);
    expect(hasValidSourceCatalog([...catalog, { ...catalog[0] }])).toBe(false);
  });

  it("fails closed when lookup input is invalid", () => {
    expect(findCatalogEntry(catalog, "elantris")?.title).toBe("Elantris");
    expect(findCatalogEntry(catalog, "")).toBeNull();
    expect(findCatalogEntry([{ ...catalog[0] }, { ...catalog[0] }], "mistborn-final-empire")).toBeNull();
  });
});
