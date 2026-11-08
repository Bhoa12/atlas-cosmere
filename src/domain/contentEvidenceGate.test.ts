import { resolveContentEvidence } from "./contentEvidenceGate";

const catalog = [{
  id: "source-a",
  title: "Private catalog entry",
  sourceCollectionId: "collection-a",
  access: "verified-structure" as const,
}];
const bindings = [{ sourceId: "source-a", workId: "work-a" }];

describe("resolveContentEvidence", () => {
  it("allows metadata and evidence-backed original summaries", () => {
    expect(resolveContentEvidence(catalog, bindings, {
      contentId: "meta-a", workId: "work-a", sourceId: "source-a", evidenceKind: "metadata",
    }).status).toBe("available");
    expect(resolveContentEvidence(catalog, bindings, {
      contentId: "summary-a", workId: "work-a", sourceId: "source-a", evidenceKind: "original-summary",
    }).status).toBe("available");
  });

  it("does not treat a catalog-only source as sufficient for an original summary", () => {
    const catalogOnly = [{ ...catalog[0], access: "cataloged" as const }];
    expect(resolveContentEvidence(catalogOnly, bindings, {
      contentId: "summary-a", workId: "work-a", sourceId: "source-a", evidenceKind: "original-summary",
    }).status).toBe("unavailable");
  });

  it("fails closed for unknown or structurally invalid provenance", () => {
    expect(resolveContentEvidence(catalog, bindings, {
      contentId: "x", workId: "other-work", sourceId: "source-a", evidenceKind: "metadata",
    }).status).toBe("blocked");
    expect(resolveContentEvidence(catalog, [{ sourceId: "source-a", workId: "work-a" }, { sourceId: "source-a", workId: "work-b" }], {
      contentId: "x", workId: "work-a", sourceId: "source-a", evidenceKind: "metadata",
    }).status).toBe("blocked");
  });
});
