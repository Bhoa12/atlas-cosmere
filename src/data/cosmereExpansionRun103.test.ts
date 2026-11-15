import { auditCatalogIntegrity, isSourceAllowedForClaim } from "./cosmereExpansionRun103";

describe("cosmereExpansionRun103", () => {
  const sources = [
    { id: "index", kind: "verified-index" as const, accessible: true },
    { id: "private", kind: "declared-private" as const, accessible: false },
    { id: "editorial", kind: "editorial-accessible" as const, accessible: true },
  ];

  it("reports catalog gaps without inventing links", () => {
    const report = auditCatalogIntegrity({
      sources,
      works: [
        { id: "mistborn", title: "El Imperio Final", sourceId: "index" },
        { id: "elantris", title: "Elantris", sourceId: "index" },
      ],
      worlds: [{ id: "scadrial", name: "Scadrial" }],
      links: [{ workId: "mistborn", worldId: "scadrial", sourceId: "index" }],
    });
    expect(report.valid).toBe(true);
    expect(report.orphanWorkIds).toEqual(["elantris"]);
  });

  it("fails closed for reading structure and summaries", () => {
    expect(isSourceAllowedForClaim(sources[1], "reading-structure")).toBe(false);
    expect(isSourceAllowedForClaim(sources[0], "original-summary")).toBe(false);
    expect(isSourceAllowedForClaim(sources[2], "original-summary")).toBe(true);
  });

  it("rejects duplicate and unknown references", () => {
    const report = auditCatalogIntegrity({
      sources,
      works: [{ id: "w", title: "Obra", sourceId: "missing" }],
      worlds: [{ id: "x", name: "Mundo" }],
      links: [
        { workId: "w", worldId: "x", sourceId: "index" },
        { workId: "w", worldId: "x", sourceId: "index" },
      ],
    });
    expect(report.valid).toBe(false);
    expect(report.errors).toContain("unknown-work-source:w");
    expect(report.errors).toContain("duplicate-link:w:x");
  });
});
