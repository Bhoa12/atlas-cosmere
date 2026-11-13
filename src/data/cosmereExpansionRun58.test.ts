import { buildBibliographyWorks, canReveal, validateCatalog, type AtlasCatalog } from "./cosmereExpansionRun58";

const catalog: AtlasCatalog = {
  sources: [{ id: "index", kind: "verified-index", label: "verified bibliography index" }],
  worlds: [
    { id: "scadrial", label: "Scadrial" },
    { id: "sel", label: "Sel" },
    { id: "nalthis", label: "Nalthis" },
    { id: "taldain", label: "Taldain" },
  ],
  works: [{ id: "work", title: "Synthetic work", sourceId: "index" }],
  units: [
    { id: "u1", workId: "work", position: 1, label: "Unit 1" },
    { id: "u2", workId: "work", position: 2, label: "Unit 2" },
  ],
};

describe("cosmereExpansionRun58", () => {
  it("accepts a structurally valid source-safe catalog", () => {
    expect(validateCatalog(catalog)).toEqual([]);
  });

  it("does not reveal until every required unit is completed", () => {
    const gate = { workId: "work", requiredUnitIds: ["u1", "u2"] };
    expect(canReveal(catalog, { workId: "work", completedUnitIds: ["u1"] }, gate)).toBe(false);
    expect(canReveal(catalog, { workId: "work", completedUnitIds: ["u1", "u2"] }, gate)).toBe(true);
  });

  it("fails closed for duplicated or cross-work requirements", () => {
    expect(canReveal(catalog, { workId: "work", completedUnitIds: ["u1"] }, { workId: "work", requiredUnitIds: ["u1", "u1"] })).toBe(false);
    expect(canReveal(catalog, { workId: "work", completedUnitIds: ["u1"] }, { workId: "work", requiredUnitIds: ["missing"] })).toBe(false);
  });

  it("keeps bibliography entries free of inferred world assignments", () => {
    const works = buildBibliographyWorks("index", ["El Imperio Final", "Elantris"]);
    expect(works.map((work) => work.worldId)).toEqual([undefined, undefined]);
  });
});
