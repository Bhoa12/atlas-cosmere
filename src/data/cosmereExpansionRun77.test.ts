import {
  canBackEditorialSummary,
  listCatalogWorks,
  validateCatalogSources,
} from "./cosmereExpansionRun77";

describe("cosmere expansion run77", () => {
  const sources = [
    { id: "index", evidence: "verified-index" as const, accessible: false },
    { id: "private", evidence: "declared-private" as const, accessible: false },
    { id: "accessible", evidence: "editorial-accessible" as const, accessible: true },
  ];

  it("keeps catalog metadata without inventing editorial access", () => {
    expect(canBackEditorialSummary("index", sources)).toBe(false);
    expect(canBackEditorialSummary("private", sources)).toBe(false);
    expect(canBackEditorialSummary("accessible", sources)).toBe(true);
  });

  it("filters works with unknown provenance", () => {
    expect(listCatalogWorks([
      { id: "a", title: "Obra A", sourceId: "index" },
      { id: "b", title: "Obra B", sourceId: "missing" },
    ], sources).map(work => work.id)).toEqual(["a"]);
  });

  it("detects inconsistent source declarations and unknown work sources", () => {
    const errors = validateCatalogSources(
      [{ id: "a", title: "Obra A", sourceId: "missing" }],
      [{ id: "index", evidence: "verified-index", accessible: true }],
    );
    expect(errors).toContain("inconsistent-source-access:index");
    expect(errors).toContain("unknown-work-source:a");
  });
});
