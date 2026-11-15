import { auditCatalogClaims } from "./cosmereExpansionRun101";

describe("cosmere expansion run 101", () => {
  const sources = [
    { id: "index", access: "verified-index" as const, accessible: false },
    { id: "private", access: "declared-private" as const, accessible: false },
    { id: "editorial", access: "editorial-accessible" as const, accessible: true },
  ];

  it("allows a verified index to support catalog metadata only", () => {
    const result = auditCatalogClaims(sources, [
      { id: "catalog", sourceId: "index", kind: "metadata" },
      { id: "structure", sourceId: "index", kind: "reading-structure" },
    ]);

    expect(result.accepted.map(claim => claim.id)).toEqual(["catalog"]);
    expect(result.rejectedIds).toEqual(["structure"]);
  });

  it("does not let a declared private source authorize editorial claims", () => {
    const result = auditCatalogClaims(sources, [
      { id: "metadata", sourceId: "private", kind: "metadata" },
      { id: "summary", sourceId: "private", kind: "original-summary" },
    ]);

    expect(result.accepted).toEqual([]);
    expect(result.rejectedIds).toEqual(["metadata", "summary"]);
  });

  it("requires an explicitly accessible editorial source for structure and summaries", () => {
    const result = auditCatalogClaims(sources, [
      { id: "structure", sourceId: "editorial", kind: "reading-structure" },
      { id: "summary", sourceId: "editorial", kind: "original-summary" },
      { id: "duplicate", sourceId: "editorial", kind: "metadata" },
      { id: "duplicate", sourceId: "editorial", kind: "metadata" },
    ]);

    expect(result.accepted.map(claim => claim.id)).toEqual(["structure", "summary", "duplicate"]);
    expect(result.rejectedIds).toEqual(["duplicate"]);
  });
});
