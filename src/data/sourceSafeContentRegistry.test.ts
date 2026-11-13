import { evaluateSpoilerGate } from "./cosmereExpansionRun53";
import { validateSourceSafeCatalogue, resolveContentCard } from "./sourceSafeContentRegistry";

const units = [{ id: "u1", workId: "w1", order: 1 }, { id: "u2", workId: "w1", order: 2 }];

describe("sourceSafeContentRegistry", () => {
  it("keeps a card hidden until its explicit requirements are complete", () => {
    const card = { id: "c1", workId: "w1", title: "Synthetic", summary: "Original synthetic metadata.", gate: { workId: "w1", requiredUnitIds: ["u1", "u2"] }, sourceIds: ["s1"] };
    expect(resolveContentCard(card, units, { workId: "w1", completedUnitIds: ["u1"] }).visible).toBe(false);
    expect(resolveContentCard(card, units, { workId: "w1", completedUnitIds: ["u1", "u2"] }).visible).toBe(true);
  });

  it("rejects unknown sources and mismatched gates", () => {
    const errors = validateSourceSafeCatalogue(
      [{ id: "s1", label: "Synthetic index", status: "verified-index" }],
      [{ id: "w1", title: "Synthetic work", sourceId: "missing" }],
      units,
      [{ id: "c1", workId: "w1", title: "Card", summary: "Synthetic.", gate: { workId: "other", requiredUnitIds: ["u1"] }, sourceIds: ["s1"] }],
    );
    expect(errors).toContain("unknown-work-source");
    expect(errors).toContain("mismatched-card-gate");
  });

  it("preserves the fail-closed evaluator contract", () => {
    expect(evaluateSpoilerGate({ workId: "w1", requiredUnitIds: [] }, units, { workId: "w1", completedUnitIds: ["u1", "u2"] }).revealed).toBe(false);
  });
});
