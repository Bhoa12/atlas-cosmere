import { canReveal, validateCatalogue, type Catalogue } from "./cosmereExpansionModel";

const catalogue: Catalogue = {
  sources: [{ id: "source-a", label: "Synthetic", status: "verified-index" }],
  worlds: [{ id: "world-a", name: "World A" }],
  works: [{ id: "work-a", title: "Work A", sourceId: "source-a" }],
  relations: [],
  units: [{ id: "unit-a", workId: "work-a", position: 1, label: "Unit 1" }],
};

describe("cosmere expansion model", () => {
  it("accepts explicit, internally consistent metadata", () => {
    expect(validateCatalogue(catalogue)).toEqual([]);
  });

  it("rejects an unknown source", () => {
    const invalid = { ...catalogue, works: [{ ...catalogue.works[0], sourceId: "missing" }] };
    expect(validateCatalogue(invalid)).toContain("unknown source for work: work-a");
  });

  it("fails closed for incomplete or duplicate requirements", () => {
    expect(canReveal({ workId: "work-a", requiredUnitIds: ["unit-a"] }, { workId: "work-a", completedUnitIds: [] })).toBe(false);
    expect(canReveal({ workId: "work-a", requiredUnitIds: ["unit-a", "unit-a"] }, { workId: "work-a", completedUnitIds: ["unit-a"] })).toBe(false);
    expect(canReveal({ workId: "work-a", requiredUnitIds: ["unit-a"] }, { workId: "work-a", completedUnitIds: ["unit-a"] })).toBe(true);
  });
});
