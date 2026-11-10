import type { WorldReadingProgressSummary } from "./worldReadingProgressSummary";

export type WorldProgressMilestone =
  | "not-started"
  | "started"
  | "complete";

export interface WorldProgressMilestoneResult {
  status: "valid" | "blocked";
  milestones: readonly {
    worldId: string;
    milestone: WorldProgressMilestone;
  }[];
}

/**
 * Converts validated per-world progress totals into a small UI-safe state.
 * It carries no titles, passages, summaries, reading order or editorial facts.
 * The conversion is fail-closed: malformed or ambiguous summary metadata yields
 * no milestones.
 */
export function resolveWorldProgressMilestones(
  summaryStatus: "valid" | "blocked",
  worlds: readonly WorldReadingProgressSummary[],
): WorldProgressMilestoneResult {
  if (summaryStatus !== "valid") return { status: "blocked", milestones: [] };

  const seen = new Set<string>();
  const milestones: WorldProgressMilestoneResult["milestones"][number][] = [];

  for (const world of worlds) {
    if (
      !world ||
      !world.worldId.trim() ||
      seen.has(world.worldId) ||
      !Number.isInteger(world.totalUnits) ||
      !Number.isInteger(world.completedUnits) ||
      !Number.isInteger(world.pendingUnits) ||
      world.totalUnits <= 0 ||
      world.completedUnits < 0 ||
      world.pendingUnits < 0 ||
      world.completedUnits + world.pendingUnits !== world.totalUnits ||
      typeof world.completionRatio !== "number" ||
      !Number.isFinite(world.completionRatio) ||
      world.completionRatio < 0 ||
      world.completionRatio > 1 ||
      world.completionRatio !== world.completedUnits / world.totalUnits
    ) {
      return { status: "blocked", milestones: [] };
    }

    seen.add(world.worldId);
    milestones.push({
      worldId: world.worldId,
      milestone:
        world.completedUnits === 0
          ? "not-started"
          : world.pendingUnits === 0
            ? "complete"
            : "started",
    });
  }

  return {
    status: "valid",
    milestones: milestones.sort((a, b) => a.worldId.localeCompare(b.worldId)),
  };
}
