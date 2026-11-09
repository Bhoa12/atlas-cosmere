import { WorldExpansionQueueEntry } from "./worldExpansionQueue";

export interface WorldExpansionPlanEntry {
  worldId: string;
  priority: number;
  status: WorldExpansionQueueEntry["status"];
  eligible: boolean;
  nextAction: "expand-structure" | "await-structure";
}

export interface WorldExpansionPlanResult {
  status: "valid" | "blocked";
  entries: readonly WorldExpansionPlanEntry[];
}

/**
 * Converts an already validated expansion queue into a presentation-neutral plan.
 * The function does not infer editorial relationships or inspect narrative text:
 * eligibility is copied from the structural queue and every other state remains
 * explicitly pending.
 */
export function resolveWorldExpansionPlan(
  queue: readonly WorldExpansionQueueEntry[],
): WorldExpansionPlanResult {
  const ids = new Set<string>();
  const priorities = new Set<number>();
  const entries: WorldExpansionPlanEntry[] = [];

  for (const item of queue) {
    if (
      !item.worldId ||
      !Number.isInteger(item.priority) ||
      item.priority < 0 ||
      ids.has(item.worldId) ||
      priorities.has(item.priority) ||
      typeof item.eligible !== "boolean" ||
      (item.eligible && item.status !== "structure-ready") ||
      (!item.eligible && item.status === "structure-ready")
    ) {
      return { status: "blocked", entries: [] };
    }

    ids.add(item.worldId);
    priorities.add(item.priority);
    entries.push({
      worldId: item.worldId,
      priority: item.priority,
      status: item.status,
      eligible: item.eligible,
      nextAction: item.eligible ? "expand-structure" : "await-structure",
    });
  }

  return {
    status: "valid",
    entries: entries.slice().sort((left, right) => left.priority - right.priority),
  };
}
