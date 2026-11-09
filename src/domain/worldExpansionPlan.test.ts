import { describe, expect, it } from "vitest";
import { resolveWorldExpansionPlan } from "./worldExpansionPlan";

describe("resolveWorldExpansionPlan", () => {
  it("turns validated readiness metadata into explicit next actions", () => {
    expect(resolveWorldExpansionPlan([
      { worldId: "sel", priority: 2, status: "cataloged", eligible: false },
      { worldId: "scadrial", priority: 1, status: "structure-ready", eligible: true },
    ])).toEqual({
      status: "valid",
      entries: [
        { worldId: "scadrial", priority: 1, status: "structure-ready", eligible: true, nextAction: "expand-structure" },
        { worldId: "sel", priority: 2, status: "cataloged", eligible: false, nextAction: "await-structure" },
      ],
    });
  });

  it("blocks ambiguous or contradictory queue metadata fail-closed", () => {
    expect(resolveWorldExpansionPlan([
      { worldId: "sel", priority: 1, status: "structure-ready", eligible: false },
    ])).toEqual({ status: "blocked", entries: [] });

    expect(resolveWorldExpansionPlan([
      { worldId: "sel", priority: 1, status: "cataloged", eligible: false },
      { worldId: "nalthis", priority: 1, status: "cataloged", eligible: false },
    ])).toEqual({ status: "blocked", entries: [] });

    expect(resolveWorldExpansionPlan([
      { worldId: "sel", priority: 1, status: "unknown" as never, eligible: false },
    ])).toEqual({ status: "valid", entries: [
      { worldId: "sel", priority: 1, status: "unknown", eligible: false, nextAction: "await-structure" },
    ]});
  });
});
