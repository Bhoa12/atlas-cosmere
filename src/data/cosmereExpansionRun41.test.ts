import { validateCatalogue, resolveVisibility } from "./cosmereExpansionRun41";

const catalogue = {
  sources: [{ id: "cosmere-index", label: "Verified catalogue index", status: "verified-index" as const }],
  worlds: [{ id: "scadrial", label: "Scadrial" }, { id: "sel", label: "Sel" }],
  works: [{ id: "sample-work", title: "Sample work", sourceId: "cosmere-index" }],
  readingUnits: [{ id: "unit-1", workId: "sample-work", position: 1, label: "Unit 1" }],
};

describe("cosmere expansion catalogue", () => {
  it("accepts explicit metadata", () => expect(validateCatalogue(catalogue)).toEqual([]));
  it("rejects an unknown source", () => expect(validateCatalogue({ ...catalogue, works: [{ id: "other", title: "Other", sourceId: "missing" }] })).not.toEqual([]));
  it("fails closed when progress is incomplete or duplicated", () => {
    expect(resolveVisibility(["unit-1"], { workId: "sample-work", completedUnitIds: [] })).toBe("locked");
    expect(resolveVisibility(["unit-1", "unit-1"], { workId: "sample-work", completedUnitIds: ["unit-1"] })).toBe("locked");
  });
});