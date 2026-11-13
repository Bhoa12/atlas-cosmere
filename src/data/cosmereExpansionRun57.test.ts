import { canReveal, validateCatalogue } from "./cosmereExpansionRun57";

const units = [
  { id: "u1", workId: "w", position: 1, label: "Unidad 1" },
  { id: "u2", workId: "w", position: 2, label: "Unidad 2" },
];

describe("cosmere expansion run57", () => {
  it("validates source and reading structure", () => {
    expect(validateCatalogue(
      [{ id: "s", kind: "verified-index", label: "Índice" }],
      [{ id: "world", label: "Mundo" }],
      [{ id: "w", title: "Obra", sourceId: "s" }],
      units,
    )).toEqual([]);
  });

  it("fails closed until every required unit is complete", () => {
    const gate = { workId: "w", requiredUnitIds: ["u1", "u2"] };
    expect(canReveal(gate, units, { workId: "w", completedUnitIds: ["u1"] })).toBe(false);
    expect(canReveal(gate, units, { workId: "w", completedUnitIds: ["u1", "u2"] })).toBe(true);
  });

  it("rejects duplicate requirements", () => {
    expect(canReveal({ workId: "w", requiredUnitIds: ["u1", "u1"] }, units,
      { workId: "w", completedUnitIds: ["u1"] })).toBe(false);
  });
});
