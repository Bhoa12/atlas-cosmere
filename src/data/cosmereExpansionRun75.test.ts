import { catalogView, sourceCapabilities, validateCatalogProvenance } from "./cosmereExpansionRun75";

describe("run75 source capability boundary", () => {
  const sources = [
    { id: "index", access: "verified-index" as const, scope: "catalog-metadata" as const, label: "Verified index" },
    { id: "private", access: "declared-private" as const, scope: "private-uninspected" as const, label: "Private EPUB" },
    { id: "open", access: "accessible" as const, scope: "editorial-accessible" as const, label: "Accessible material" },
  ];

  it("does not let an index or uninspected EPUB back editorial summaries", () => {
    expect(sourceCapabilities(sources[0]).canBackSummary).toBe(false);
    expect(sourceCapabilities(sources[1]).canInspectStructure).toBe(false);
    expect(sourceCapabilities(sources[2]).canBackSummary).toBe(true);
  });

  it("keeps catalogue titles as explicit metadata without inferred worlds", () => {
    const works = [
      { id: "a", title: "Título B", sourceId: "index", catalogSourceId: "index", worldIds: [] },
      { id: "b", title: "Título A", sourceId: "index", catalogSourceId: "index", worldIds: [] },
    ];
    expect(validateCatalogProvenance(sources, works)).toEqual([]);
    expect(catalogView("index", works)).toEqual({ sourceId: "index", titleCount: 2, titles: ["Título A", "Título B"] });
    expect(works.every(work => work.worldIds.length === 0)).toBe(true);
  });

  it("rejects mismatched provenance", () => {
    const works = [{ id: "a", title: "Synthetic", sourceId: "index", catalogSourceId: "private", worldIds: [] }];
    expect(validateCatalogProvenance(sources, works)).toContain("mismatched-work-source:a");
  });
});
