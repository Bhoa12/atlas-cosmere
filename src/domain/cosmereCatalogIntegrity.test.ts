import { describe, expect, it } from "vitest";
import { COSMERE_SOURCE_CATALOG } from "./cosmereSourceCatalog";
import { resolveCatalogIntegrity } from "./cosmereCatalogIntegrity";

describe("resolveCatalogIntegrity", () => {
  it("accepts consistent supplied bibliography metadata", () => {
    expect(resolveCatalogIntegrity(COSMERE_SOURCE_CATALOG).status).toBe("valid");
  });
  it("blocks duplicate work identifiers", () => {
    const result = resolveCatalogIntegrity([...COSMERE_SOURCE_CATALOG, COSMERE_SOURCE_CATALOG[0]]);
    expect(result).toEqual(expect.objectContaining({ status: "blocked", reasons: expect.arrayContaining(["duplicate-work-id"]) }));
  });
  it("does not silently trim ambiguous identifiers", () => {
    const altered = COSMERE_SOURCE_CATALOG.map((work, i) => i === 0 ? { ...work, worldId: " scadrial " } : work);
    expect(resolveCatalogIntegrity(altered)).toEqual(expect.objectContaining({ status: "blocked", reasons: expect.arrayContaining(["invalid-world-id"]) }));
  });
});
