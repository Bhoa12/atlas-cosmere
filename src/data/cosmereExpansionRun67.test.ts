import { describe, expect, it } from "vitest";
import { evaluateSpoilerGate, reconcileProgress, worksForWorld } from "./cosmereExpansionRun67";

describe("cosmere expansion run67", () => {
  const units = [
    { id: "u2", workId: "work", position: 2, label: "Unidad 2" },
    { id: "u1", workId: "work", position: 1, label: "Unidad 1" },
    { id: "other", workId: "other-work", position: 1, label: "Ajena" },
  ];

  it("reconciles multiple snapshots without trusting unknown or cross-work IDs", () => {
    expect(reconcileProgress("work", [
      { workId: "work", completedUnitIds: ["u2", "unknown"] },
      { workId: "other-work", completedUnitIds: ["other"] },
      { workId: "work", completedUnitIds: ["u1", "u2"] },
    ], units)).toEqual({ workId: "work", completedUnitIds: ["u1", "u2"] });
  });

  it("uses reconciled progress for spoiler gates", () => {
    expect(evaluateSpoilerGate(
      { workId: "work", requiredUnitIds: ["u1", "u2"] },
      [{ workId: "work", completedUnitIds: ["u1"] }, { workId: "work", completedUnitIds: ["u2"] }],
      units,
    )).toEqual({ allowed: true, reason: "ready", pendingUnitIds: [] });
  });

  it("fails closed when no matching work snapshot exists", () => {
    expect(evaluateSpoilerGate(
      { workId: "work", requiredUnitIds: ["u1"] },
      [{ workId: "other-work", completedUnitIds: ["other"] }],
      units,
    )).toEqual({ allowed: false, reason: "wrong-work", pendingUnitIds: ["u1"] });
  });

  it("does not infer world membership", () => {
    expect(worksForWorld("scadrial", [{ id: "scadrial", label: "Scadrial" }],
      [{ id: "w", title: "Título", sourceId: "source" }])).toEqual([]);
  });
});
