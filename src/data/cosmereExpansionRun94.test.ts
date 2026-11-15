import { auditCatalogWorks, verifiedIndexCatalog } from "./cosmereExpansionRun94";

describe("catalog-first expansion", () => {
  const sources = [{ id: "cosmere-verified-index", kind: "verified-index" as const }];

  it("keeps the verified index as metadata without editorial inference", () => {
    const audit = auditCatalogWorks(sources, verifiedIndexCatalog);
    expect(audit.errors).toEqual([]);
    expect(audit.validWorkIds).toHaveLength(17);
  });

  it("rejects duplicate work identities instead of merging them", () => {
    const works = [
      { id: "same", title: "Uno", sourceId: "cosmere-verified-index" },
      { id: "same", title: "Dos", sourceId: "cosmere-verified-index" },
    ];
    expect(auditCatalogWorks(sources, works).validWorkIds).toEqual([]);
  });

  it("rejects works with unknown sources", () => {
    const audit = auditCatalogWorks(sources, [
      { id: "unknown", title: "Catálogo", sourceId: "missing" },
    ]);
    expect(audit.errors).toContain("invalid-work:unknown");
  });
});
