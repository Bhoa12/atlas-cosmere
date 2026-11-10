import { describe, expect, it } from "vitest";
import { COSMERE_SOURCE_CATALOG, listCatalogWorksForWorld } from "./cosmereSourceCatalog";

describe("COSMERE_SOURCE_CATALOG", () => {
  it("exposes the verified supplied bibliography as metadata only", () => {
    expect(COSMERE_SOURCE_CATALOG).toHaveLength(17);
    expect(listCatalogWorksForWorld("scadrial").map((work) => work.id)).toHaveLength(7);
    expect(listCatalogWorksForWorld("sel").map((work) => work.title)).toEqual(["Elantris"]);
    expect(listCatalogWorksForWorld("nalthis").map((work) => work.title))
      .toEqual(["El aliento de los dioses"]);
    expect(listCatalogWorksForWorld("taldain")).toHaveLength(3);
  });

  it("does not silently normalize world identifiers", () => {
    expect(listCatalogWorksForWorld(" scadrial ")).toEqual([]);
    expect(listCatalogWorksForWorld("")).toEqual([]);
  });

  it("keeps unassigned entries explicit instead of inventing metadata", () => {
    expect(COSMERE_SOURCE_CATALOG.find((work) => work.id === "arcanum-ilimitado")?.worldId)
      .toBeNull();
  });
});
