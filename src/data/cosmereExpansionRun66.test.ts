import { describe, expect, it } from "vitest";
import { evaluateSpoilerGate, normalizeProgress, worksForWorld } from "./cosmereExpansionRun66";

describe("cosmere expansion run66", () => {
  const units = [
    { id: "u1", workId: "work", position: 1, label: "Unidad 1" },
    { id: "u2", workId: "work", position: 2, label: "Unidad 2" },
  ];

  it("fails closed and reports pending units", () => {
    expect(evaluateSpoilerGate({ workId: "work", requiredUnitIds: ["u1", "u2"] }, { workId: "work", completedUnitIds: ["u1"] }, units))
      .toEqual({ allowed: false, reason: "incomplete", pendingUnitIds: ["u2"] });
  });

  it("normalizes duplicate and unknown progress", () => {
    expect(normalizeProgress({ workId: "work", completedUnitIds: ["u1", "u1", "other"] }, units).completedUnitIds).toEqual(["u1"]);
  });

  it("does not infer world membership", () => {
    expect(worksForWorld("scadrial", [{ id: "scadrial", label: "Scadrial" }], [{ id: "w", title: "Título", sourceId: "s" }])).toEqual([]);
  });
});