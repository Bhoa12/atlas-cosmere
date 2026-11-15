import { auditExpansionManifest, isGateUnlocked, reconciledProgress } from "./cosmereExpansionRun91";

const source = { id: "editorial", kind: "editorial-accessible" as const, accessible: true };
const units = [
  { id: "u1", workId: "work", position: 1, sourceId: "editorial" },
  { id: "u2", workId: "work", position: 2, sourceId: "editorial" },
];

describe("cosmere expansion run91", () => {
  it("audits cross-domain references conservatively", () => {
    const issues = auditExpansionManifest({
      sources: [source],
      works: [{ id: "work", title: "Synthetic", sourceId: "editorial" }],
      units,
      gates: [{ id: "gate", workId: "work", requiredUnitIds: ["missing"] }],
    });
    expect(issues.map((issue) => issue.code)).toContain("invalid-gate-requirements");
  });

  it("orders validated progress and unlocks only complete gates", () => {
    expect(reconciledProgress(units, { workId: "work", completedUnitIds: ["u2", "u1"] })).toEqual(["u1", "u2"]);
    expect(isGateUnlocked({ id: "gate", workId: "work", requiredUnitIds: ["u1", "u2"] }, units, { workId: "work", completedUnitIds: ["u1"] })).toBe(false);
    expect(isGateUnlocked({ id: "gate", workId: "work", requiredUnitIds: ["u1", "u2"] }, units, { workId: "work", completedUnitIds: ["u1", "u2"] })).toBe(true);
  });
});
