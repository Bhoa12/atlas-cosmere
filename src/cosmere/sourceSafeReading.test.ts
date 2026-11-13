import { canReveal, sourceCatalogue, validateCatalogue } from "./sourceSafeReading";

const units = [
  { id: "u1", workId: "w1", position: 1, label: "Unidad 1" },
  { id: "u2", workId: "w1", position: 2, label: "Unidad 2" }
];

describe("source-safe reading core", () => {
  it("acepta el catálogo semilla", () => {
    expect(validateCatalogue(sourceCatalogue)).toEqual([]);
  });

  it("mantiene el contenido bloqueado hasta completar todos los requisitos", () => {
    const gate = { workId: "w1", requiredUnitIds: ["u1", "u2"] };
    expect(canReveal(gate, { workId: "w1", completedUnitIds: ["u1"] }, units)).toBe(false);
    expect(canReveal(gate, { workId: "w1", completedUnitIds: ["u1", "u2"] }, units)).toBe(true);
  });

  it("falla de forma conservadora ante requisitos duplicados o ajenos", () => {
    expect(canReveal({ workId: "w1", requiredUnitIds: ["u1", "u1"] }, { workId: "w1", completedUnitIds: ["u1"] }, units)).toBe(false);
    expect(canReveal({ workId: "w1", requiredUnitIds: ["u2"] }, { workId: "otra", completedUnitIds: ["u2"] }, units)).toBe(false);
  });
});
