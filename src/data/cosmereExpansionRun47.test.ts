import { canReveal, validateExpansion } from "./cosmereExpansionRun47";

describe("cosmere expansion run47", () => {
  it("validates explicit metadata and unlocks only completed requirements", () => {
    const sources = [{ id: "s", label: "Index", kind: "verified-index" as const }];
    const worlds = [{ id: "scadrial", label: "Scadrial" }];
    const works = [{ id: "w", title: "Synthetic work", sourceId: "s", worldId: "scadrial" }];
    const units = [{ id: "u1", workId: "w", position: 1, label: "Part 1" }];
    expect(validateExpansion({ sources, worlds, works, units })).toEqual([]);
    expect(canReveal({ workId: "w", requiredUnitIds: ["u1"] }, { workId: "w", completedUnitIds: ["u1"] }, units)).toBe(true);
  });

  it("fails closed for duplicate requirements and inconsistent references", () => {
    const units = [{ id: "u1", workId: "w", position: 1, label: "Part 1" }];
    expect(canReveal({ workId: "w", requiredUnitIds: ["u1", "u1"] }, { workId: "w", completedUnitIds: ["u1"] }, units)).toBe(false);
    expect(validateExpansion({ sources: [], worlds: [], works: [{ id: "w", title: "X", sourceId: "missing" }], units })).toContain("unknown-source");
  });
});
