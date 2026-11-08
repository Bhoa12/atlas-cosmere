import { resolveContentDisclosureDecisionBatch } from "./contentDisclosureDecisionBatch";

const catalog = [{
  id: "source-a", title: "Private catalog entry", sourceCollectionId: "collection-a",
  access: "verified-structure" as const,
}];
const bindings = [{ sourceId: "source-a", workId: "work-a" }];
const units = [{ id: "unit-a", workId: "work-a", position: 0 }];

describe("resolveContentDisclosureDecisionBatch", () => {
  it("returns presentation-safe decisions for a valid one-to-one batch", () => {
    expect(resolveContentDisclosureDecisionBatch(
      catalog, bindings, ["work-a"], units, [{ unitId: "unit-a", completed: true }],
      [{ contentId: "content-a", workId: "work-a", sourceId: "source-a", evidenceKind: "original-summary" }],
      [{ contentId: "content-a", requiredUnitIds: ["unit-a"] }],
    )).toEqual({
      status: "ready",
      decisions: [{ status: "available", reason: "ready" }],
      blockedContentIds: [],
    });
  });

  it("fails closed without partial decisions for unmatched or duplicate identifiers", () => {
    const result = resolveContentDisclosureDecisionBatch(
      catalog, bindings, ["work-a"], units, [],
      [
        { contentId: "content-a", workId: "work-a", sourceId: "source-a", evidenceKind: "original-summary" },
        { contentId: "content-a", workId: "work-a", sourceId: "source-a", evidenceKind: "original-summary" },
      ],
      [{ contentId: "content-b", requiredUnitIds: [] }],
    );
    expect(result.status).toBe("blocked");
    expect(result.decisions).toEqual([]);
    expect(result.blockedContentIds).toEqual(expect.arrayContaining(["content-a", "content-b"]));
  });
});
