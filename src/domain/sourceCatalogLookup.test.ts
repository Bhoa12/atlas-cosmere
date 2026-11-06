import {
  findUniqueDeclaredSourceById,
  findUniqueDeclaredSourceByTitle,
} from "./sourceCatalogLookup";
import type { BibliographicSourceEntry } from "./privateCosmereSourceCatalog";

describe("source catalog lookup", () => {
  const sources: BibliographicSourceEntry[] = [
    { sourceId: "a", title: "Uno", availability: "declared" },
    { sourceId: "b", title: "Dos", availability: "declared" },
  ];

  it("returns an exact unique declared source by id", () => {
    expect(findUniqueDeclaredSourceById(sources, "a")?.title).toBe("Uno");
  });

  it("fails closed for unknown ids", () => {
    expect(findUniqueDeclaredSourceById(sources, "missing")).toBeNull();
  });

  it("fails closed for duplicate ids", () => {
    expect(findUniqueDeclaredSourceById([...sources, { sourceId: "a", title: "Otro", availability: "declared" }], "a")).toBeNull();
  });

  it("returns an exact unique declared source by title", () => {
    expect(findUniqueDeclaredSourceByTitle(sources, "Dos")?.sourceId).toBe("b");
  });

  it("fails closed for duplicate titles", () => {
    expect(findUniqueDeclaredSourceByTitle([...sources, { sourceId: "c", title: "Dos", availability: "declared" }], "Dos")).toBeNull();
  });
});
