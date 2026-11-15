import { auditSpoilerGate, isGateUnlocked, reconcileProgress } from "./cosmereExpansionRun96";

const units = [
  { id: "a-1", workId: "a", position: 1, sourceId: "editorial" },
  { id: "a-2", workId: "a", position: 2, sourceId: "editorial" },
  { id: "b-1", workId: "b", position: 1, sourceId: "editorial" },
];

describe("cosmere expansion run 96", () => {
  it("rejects invalid spoiler requirements conservatively", () => {
    expect(auditSpoilerGate({ id: "g", workId: "a", requiredUnitIds: [] }, ["a", "b"], units).valid).toBe(false);
    expect(auditSpoilerGate({ id: "g", workId: "a", requiredUnitIds: ["b-1"] }, ["a", "b"], units).reason).toBe("cross-work-unit");
  });

  it("reconciles progress in explicit reading order", () => {
    expect(reconcileProgress("a", units, { workId: "a", completedUnitIds: ["a-2", "a-1", "missing"] })).toEqual(["a-1", "a-2"]);
  });

  it("fails closed until every valid requirement is complete", () => {
    const gate = { id: "g", workId: "a", requiredUnitIds: ["a-1", "a-2"] };
    expect(isGateUnlocked(gate, ["a", "b"], units, { workId: "a", completedUnitIds: ["a-1"] })).toBe(false);
    expect(isGateUnlocked(gate, ["a", "b"], units, { workId: "a", completedUnitIds: ["a-1", "a-2"] })).toBe(true);
  });
});
