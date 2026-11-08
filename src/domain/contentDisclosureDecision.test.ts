import { resolveContentDisclosureDecision } from "./contentDisclosureDecision";

const catalog = [{
  id: "source-a", title: "Private catalog entry", sourceCollectionId: "collection-a",
  access: "verified-structure" as const,
}];
const bindings = [{ sourceId: "source-a", workId: "work-a" }];
const units = [{ id: "unit-a", workId: "work-a", position: 0 }];
const evidence = {
  contentId: "content-a", workId: "work-a", sourceId: "source-a", evidenceKind: "original-summary" as const,
};
const request = { contentId: "content-a", requiredUnitIds: ["unit-a"] };

describe("resolveContentDisclosureDecision", () => {
  it("returns a non-narrative reason for every disclosure state", () => {
    expect(resolveContentDisclosureDecision(catalog, bindings, ["work-a"], units, [{ unitId: "unit-a", completed: true }], evidence, request))
      .toEqual({ status: "available", reason: "ready" });
    expect(resolveContentDisclosureDecision(catalog, bindings, ["work-a"], units, [], evidence, request))
      .toEqual({ status: "withheld", reason: "missing-reading-progress" });
    expect(resolveContentDisclosureDecision([{ ...catalog[0], access: "cataloged" as const }], bindings, ["work-a"], units, [{ unitId: "unit-a", completed: true }], evidence, request))
      .toEqual({ status: "unavailable", reason: "insufficient-evidence" });
  });

  it("does not expose prerequisites or source passages when blocked", () => {
    expect(resolveContentDisclosureDecision(catalog, bindings, ["work-a"], units, [], evidence, {
      ...request, contentId: "other-content",
    })).toEqual({ status: "blocked", reason: "invalid-request" });
  });
});
