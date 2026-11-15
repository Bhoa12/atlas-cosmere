import {
  groupCatalogWorksBySource,
  searchCatalogWorks,
} from "./cosmereExpansionRun98";
import { verifiedIndexCatalog } from "./cosmereExpansionRun94";

describe("catalog query helpers", () => {
  it("searches verified metadata without inventing editorial structure", () => {
    const results = searchCatalogWorks(verifiedIndexCatalog, "metal perdido");
    expect(results).toHaveLength(1);
    expect(results[0].work.title).toBe("El metal perdido");
    expect(results[0].match).toBe("title");
  });

  it("returns no results for an empty query", () => {
    expect(searchCatalogWorks(verifiedIndexCatalog, "   ")).toEqual([]);
  });

  it("groups works by their declared provenance", () => {
    const grouped = groupCatalogWorksBySource(verifiedIndexCatalog);
    expect(grouped.get("cosmere-verified-index")).toHaveLength(17);
  });
});
