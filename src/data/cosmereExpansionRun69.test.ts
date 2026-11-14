import { describe, expect, it } from "vitest";
import { auditProgress, evaluateGate, readingPlan } from "./cosmereExpansionRun69";

describe("cosmere expansion run69", () => {
  const units = [
    { id: "u1", workId: "w", position: 1, label: "Uno" },
    { id: "u2", workId: "w", position: 2, label: "Dos" },
    { id: "other", workId: "x", position: 1, label: "Ajena" },
  ];

  it("orders only explicit units for the requested work", () => {
    expect(readingPlan("w", [...units].reverse()).map(unit => unit.id)).toEqual(["u1", "u2"]);
  });

  it("fails closed when positions are ambiguous", () => {
    expect(readingPlan("w", [...units, { id: "duplicate-position", workId: "w", position: 2, label: "Duplicada" }])).toEqual([]);
  });

  it("audits foreign and unknown progress without accepting it", () => {
    expect(auditProgress("w", [
      { workId: "w", completedUnitIds: ["u2", "unknown", "u2"] },
      { workId: "x", completedUnitIds: ["u1", "other"] },
    ], units)).toEqual({ accepted: ["u2"], ignored: ["other", "u1", "unknown"] });
  });

  it("unlocks only after every explicit requirement is accepted", () => {
    expect(evaluateGate("w", ["u1", "u2"], [{ workId: "w", completedUnitIds: ["u1"] }], units).state).toBe("blocked");
    expect(evaluateGate("w", ["u1", "u2"], [{ workId: "w", completedUnitIds: ["u2", "u1"] }], units)).toEqual({ state: "unlocked", pendingUnitIds: [] });
  });

  it("rejects empty, duplicate, and unknown requirements", () => {
    expect(evaluateGate("w", [], [], units).state).toBe("blocked");
    expect(evaluateGate("w", ["u1", "u1"], [], units).state).toBe("blocked");
    expect(evaluateGate("w", ["unknown"], [], units).state).toBe("blocked");
  });
});
