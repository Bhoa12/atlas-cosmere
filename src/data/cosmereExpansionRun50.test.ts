import { canReveal, validateCatalogue } from "./cosmereExpansionRun50";

describe("cosmere expansion run50", () => {
  it("fails closed until every required unit is completed", () => {
    const units = [
      { id: "u1", workId: "w1", position: 1, label: "Unidad 1" },
      { id: "u2", workId: "w1", position: 2, label: "Unidad 2" },
    ];
    expect(canReveal({ workId: "w1", requiredUnitIds: ["u1", "u2"] }, { workId: "w1", completedUnitIds: ["u1"] }, units)).toBe(false);
    expect(canReveal({ workId: "w1", requiredUnitIds: ["u1", "u2"] }, { workId: "w1", completedUnitIds: ["u1", "u2"] }, units)).toBe(true);
  });

  it("rejects inconsistent catalogue references", () => {
    expect(validateCatalogue([], [], [{ id: "w1", title: "Obra", sourceId: "missing" }], [])).toContain("unknown-source:w1");
  });
});