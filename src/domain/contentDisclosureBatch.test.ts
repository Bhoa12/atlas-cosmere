import { resolveContentDisclosureBatch } from "./contentDisclosureBatch";

const catalog = [{
  id: "source-a", title: "Private catalog entry", sourceCollectionId: "collection-a",
  access: "verified-structure" as const,
}];
const bindings = [{ sourceId: "source-a", workId: "work-a" }];
const units = [{ id: "unit-a", workId: "work-a", position: 0 }];
const evidence = {
  contentId: "content-a", workId: "work-a", sourceId: "source-a",
  evidenceKind: "original-summary" as const,
};
const request = { contentId: "content-a", requiredUnitIds: ["unit-a"] };

describe("resolveContentDisclosureBatch", () => {
  it("preserves declared evidence order while resolving non-narrative decisions", () => {
    expect(resolveContentDisclosureBatch(
      catalog, bindings, ["work-a"], units,
      [{ unitId: "unit-a", completed: true }],
      [evidence],
      [request],
    )).toEqual({
      status: "resolved",
      decisions: [{ status: "available", reason: "ready" }],
    });
  });

  it("fails closed when the batch has an unmatched identifier", () => {
    expect(resolveContentDisclosureBatch(
      catalog, bindings, ["work-a"], units, [],
      [evidence],
      [{ ...request, contentId: "other-content" }],
    )).toEqual({ status: "blocked", decisions: [] });
  });

  it("fails closed instead of accepting duplicate content identifiers", () => {
    expect(resolveContentDisclosureBatch(
      catalog, bindings, ["work-a"], units, [],
      [evidence, { ...evidence }],
      [request, { ...request, requiredUnitIds: [] }],
    )).toEqual({ status: "blocked", decisions: [] });
  });
});
