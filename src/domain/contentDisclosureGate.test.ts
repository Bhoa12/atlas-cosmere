import { resolveContentDisclosure } from "./contentDisclosureGate";

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

describe("resolveContentDisclosure", () => {
  it("requires both evidence and completed spoiler prerequisites", () => {
    expect(resolveContentDisclosure(catalog, bindings, ["work-a"], units, [{ unitId: "unit-a", completed: true }], evidence, request).status).toBe("available");
    expect(resolveContentDisclosure(catalog, bindings, ["work-a"], units, [], evidence, request).status).toBe("withheld");
  });

  it("does not disclose content when the evidence gate is unavailable", () => {
    const catalogOnly = [{ ...catalog[0], access: "cataloged" as const }];
    expect(resolveContentDisclosure(catalogOnly, bindings, ["work-a"], units, [{ unitId: "unit-a", completed: true }], evidence, request).status).toBe("unavailable");
  });

  it("fails closed when the two content identifiers disagree or provenance is invalid", () => {
    expect(resolveContentDisclosure(catalog, bindings, ["work-a"], units, [], evidence, {
      ...request, contentId: "other-content",
    }).status).toBe("blocked");
    expect(resolveContentDisclosure(catalog, [{ sourceId: "source-a", workId: "other-work" }], ["work-a"], units, [], evidence, request).status).toBe("blocked");
  });
});
