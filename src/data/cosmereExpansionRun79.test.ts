import { evaluateSpoilerGate, reconcileProgress, validateReadingUnits } from "./cosmereExpansionRun79";

const sources = [
  { id: "index", access: "catalog-metadata" as const },
  { id: "text", access: "editorial-accessible" as const },
];

const units = [
  { id: "u1", workId: "work", position: 1, sourceId: "text" },
  { id: "u2", workId: "work", position: 2, sourceId: "text" },
];

describe("cosmere expansion run 79", () => {
  it("rejects reading structure backed only by catalog metadata", () => {
    expect(validateReadingUnits([{ id: "u1", workId: "work", position: 1, sourceId: "index" }], sources))
      .toContain("unverified-reading-structure:u1");
  });

  it("reconciles only known units from the requested work", () => {
    expect(reconcileProgress("work", units, [
      { workId: "other", completedUnitIds: ["u1"] },
      { workId: "work", completedUnitIds: ["unknown", "u2", "u1", "u1"] },
    ])).toEqual(["u1", "u2"]);
  });

  it("fails closed until every explicit requirement is complete", () => {
    const gate = { workId: "work", requiredUnitIds: ["u1", "u2"] };
    expect(evaluateSpoilerGate(gate, units, [{ workId: "work", completedUnitIds: ["u1"] }], sources))
      .toMatchObject({ visible: false, pendingUnitIds: ["u2"] });
    expect(evaluateSpoilerGate(gate, units, [{ workId: "work", completedUnitIds: ["u1", "u2"] }], sources))
      .toMatchObject({ visible: true, pendingUnitIds: [] });
  });

  it("blocks malformed requirements", () => {
    const decision = evaluateSpoilerGate({ workId: "work", requiredUnitIds: ["u1", "u1"] }, units, [], sources);
    expect(decision.visible).toBe(false);
    expect(decision.reasons).toContain("duplicate-requirements");
  });
});
