import { auditCatalog } from "./cosmereExpansionRun90";

describe("cosmere expansion run 90", () => {
  const sources = [
    { id: "index", kind: "verified-index" as const, accessible: true },
    { id: "private", kind: "declared-private" as const, accessible: false },
    { id: "editorial", kind: "editorial-accessible" as const, accessible: true },
  ];

  it("keeps catalog metadata while hiding unbacked narrative content", () => {
    const result = auditCatalog(
      sources,
      [
        { id: "work-a", title: "Catalog title", sourceId: "index" },
        { id: "work-b", title: "Unknown source", sourceId: "missing" },
      ],
      [
        { id: "meta", workId: "work-a", kind: "metadata", sourceId: "index" },
        { id: "summary", workId: "work-a", kind: "original-summary", sourceId: "private" },
        { id: "safe-summary", workId: "work-a", kind: "original-summary", sourceId: "editorial" },
        { id: "orphan", workId: "work-b", kind: "metadata", sourceId: "index" },
      ],
    );

    expect(result.validWorks.map((work) => work.id)).toEqual(["work-a"]);
    expect(result.rejectedWorkIds).toEqual(["work-b"]);
    expect(result.visibleDescriptorIds).toEqual(["meta", "safe-summary"]);
    expect(result.hiddenDescriptorIds).toEqual(["summary", "orphan"]);
  });

  it("rejects duplicate work identities instead of merging them", () => {
    const result = auditCatalog(
      sources,
      [
        { id: "work-a", title: "First", sourceId: "index" },
        { id: "work-a", title: "Second", sourceId: "index" },
      ],
      [],
    );

    expect(result.validWorks).toHaveLength(1);
    expect(result.rejectedWorkIds).toEqual(["work-a"]);
  });
});
