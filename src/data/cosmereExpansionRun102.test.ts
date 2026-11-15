import { auditCatalogCoverage } from "./cosmereExpansionRun102";

describe("auditCatalogCoverage", () => {
  const sources = [
    { id: "index", access: "verified-index" as const, accessible: true },
    { id: "private", access: "declared-private" as const, accessible: false },
    { id: "editorial", access: "editorial-accessible" as const, accessible: true },
  ];

  it("keeps catalog metadata separate from accessible reading structure", () => {
    const coverage = auditCatalogCoverage(
      sources,
      [
        { id: "work-a", title: "Catalog A", sourceId: "index" },
        { id: "work-b", title: "Catalog B", sourceId: "private" },
        { id: "work-c", title: "Catalog C", sourceId: "editorial" },
      ],
      [
        { id: "unit-private", workId: "work-b", sourceId: "private", accessible: true },
        { id: "unit-editorial", workId: "work-c", sourceId: "editorial", accessible: true },
      ],
    );

    expect(coverage.map((item) => item.hasAccessibleReadingStructure)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it("rejects duplicate works and unknown sources instead of guessing", () => {
    expect(() =>
      auditCatalogCoverage(
        sources,
        [
          { id: "duplicate", title: "One", sourceId: "index" },
          { id: "duplicate", title: "Two", sourceId: "index" },
        ],
        [],
      ),
    ).toThrow();

    expect(() =>
      auditCatalogCoverage(
        sources,
        [{ id: "unknown", title: "Unknown", sourceId: "missing" }],
        [],
      ),
    ).toThrow();
  });
});
