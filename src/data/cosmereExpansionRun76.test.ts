import {
  evaluateSpoilerPolicy,
  reconcileProgress,
  validateReadingUnits,
  type ReadingUnit,
} from "./cosmereExpansionRun76";

const units: ReadingUnit[] = [
  { id: "u1", workId: "work", position: 0, label: "Unidad 1", sourceScope: "editorial-accessible" },
  { id: "u2", workId: "work", position: 1, label: "Unidad 2", sourceScope: "editorial-accessible" },
];

describe("cosmere expansion run76", () => {
  it("rejects uninspected sources as reading structure", () => {
    expect(validateReadingUnits([{ ...units[0], sourceScope: "private-uninspected" }]))
      .toContain("unverified-reading-structure:u1");
  });

  it("reconciles only known progress for the requested work", () => {
    expect(reconcileProgress("work", units, [
      { workId: "other", completedUnitIds: ["u1"] },
      { workId: "work", completedUnitIds: ["unknown", "u2", "u1", "u1"] },
    ])).toEqual(["u1", "u2"]);
  });

  it("fails closed until every explicit requirement is completed", () => {
    const partial = evaluateSpoilerPolicy("work", units, [{ workId: "work", completedUnitIds: ["u1"] }], { requiredUnitIds: ["u1", "u2"] });
    expect(partial.visible).toBe(false);
    expect(partial.pendingUnitIds).toEqual(["u2"]);

    const complete = evaluateSpoilerPolicy("work", units, [{ workId: "work", completedUnitIds: ["u1", "u2"] }], { requiredUnitIds: ["u1", "u2"] });
    expect(complete.visible).toBe(true);
  });
});
