import { canReveal, resolveWorldForWork, validateCatalogue } from "./catalogueScopeRun42";

const sources = [{ id: "index", label: "verified metadata", status: "verified-index" as const }];
const worlds = [{ id: "world-a", label: "World A" }];
const works = [{ id: "work-a", title: "Synthetic Work", sourceId: "index" }];
const links = [{ worldId: "world-a", workId: "work-a", sourceId: "index" }];
const units = [{ id: "unit-1", workId: "work-a", position: 1, label: "Unit 1" }];

describe("catalogue scope", () => {
  it("accepts explicit synthetic metadata", () => {
    expect(validateCatalogue({ sources, worlds, works, links, units })).toEqual([]);
  });
  it("does not infer ambiguous world links", () => {
    expect(resolveWorldForWork("work-a", [...links, { worldId: "world-a", workId: "work-a", sourceId: "index" }])).toBeNull();
  });
  it("fails closed for missing progress", () => {
    expect(canReveal("work-a", ["unit-1"], units, { workId: "work-a", completedUnitIds: [] })).toBe(false);
  });
  it("rejects unknown provenance", () => {
    expect(validateCatalogue({ sources, worlds, works: [{ ...works[0], sourceId: "missing" }], links, units }))
      .toContain("work work-a references unknown source");
  });
});
