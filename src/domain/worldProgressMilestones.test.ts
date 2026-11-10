import { describe, expect, it } from "vitest";
import { resolveWorldProgressMilestones } from "./worldProgressMilestones";

describe("resolveWorldProgressMilestones", () => {
  it("derives narrative-free milestones independently for multiple worlds", () => {
    const result = resolveWorldProgressMilestones("valid", [
      { worldId: "sel", totalUnits: 2, completedUnits: 0, pendingUnits: 2, completionRatio: 0 },
      { worldId: "scadrial", totalUnits: 3, completedUnits: 1, pendingUnits: 2, completionRatio: 1 / 3 },
      { worldId: "nalthis", totalUnits: 1, completedUnits: 1, pendingUnits: 0, completionRatio: 1 },
    ]);

    expect(result).toEqual({
      status: "valid",
      milestones: [
        { worldId: "nalthis", milestone: "complete" },
        { worldId: "scadrial", milestone: "started" },
        { worldId: "sel", milestone: "not-started" },
      ],
    });
  });

  it("blocks malformed totals instead of approximating a milestone", () => {
    expect(resolveWorldProgressMilestones("valid", [
      { worldId: "taldain", totalUnits: 2, completedUnits: 2, pendingUnits: 1, completionRatio: 1 },
    ])).toEqual({ status: "blocked", milestones: [] });
  });

  it("blocks duplicate worlds and blocked upstream summaries", () => {
    const world = { worldId: "scadrial", totalUnits: 1, completedUnits: 0, pendingUnits: 1, completionRatio: 0 };
    expect(resolveWorldProgressMilestones("valid", [world, world])).toEqual({ status: "blocked", milestones: [] });
    expect(resolveWorldProgressMilestones("blocked", [world])).toEqual({ status: "blocked", milestones: [] });
  });
});
