import { canReveal, validateRegistry } from "./readingProgressRegistry";

const sources = [{ id: "catalogue", label: "Índice verificado", kind: "verified-index" as const }];
const worlds = [{ id: "scadrial", label: "Scadrial" }];
const works = [{ id: "work", title: "Obra sintética", sourceId: "catalogue", worldId: "scadrial" }];
const units = [
  { id: "u1", workId: "work", position: 1, label: "Unidad 1" },
  { id: "u2", workId: "work", position: 2, label: "Unidad 2" },
];

describe("readingProgressRegistry", () => {
  it("accepts explicit, internally consistent metadata", () => {
    expect(validateRegistry(sources, worlds, works, units)).toEqual([]);
  });
  it("fails closed until every required unit is completed", () => {
    const gate = { workId: "work", requiredUnitIds: ["u1", "u2"] };
    expect(canReveal(gate, { workId: "work", completedUnitIds: ["u1"] }, units)).toBe(false);
    expect(canReveal(gate, { workId: "work", completedUnitIds: ["u1", "u2"] }, units)).toBe(true);
  });
  it("rejects duplicated or foreign requirements", () => {
    expect(canReveal({ workId: "work", requiredUnitIds: ["u1", "u1"] }, { workId: "work", completedUnitIds: ["u1"] }, units)).toBe(false);
    expect(canReveal({ workId: "work", requiredUnitIds: ["missing"] }, { workId: "work", completedUnitIds: ["missing"] }, units)).toBe(false);
  });
});