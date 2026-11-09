import { WorldCatalogExpansionReadiness } from "./worldCatalogExpansionReadiness";
import { WorldExpansionPriority } from "./worldExpansionQueue";

export interface CatalogExpansionPlanEntry {
  worldId: string;
  priority: number;
  status: WorldCatalogExpansionReadiness["status"];
  action: "expand-structure" | "await-catalog" | "blocked";
}

export interface CatalogExpansionPlanResult {
  status: "valid" | "blocked";
  entries: readonly CatalogExpansionPlanEntry[];
}

/**
 * Turns catalog-derived readiness into an ordered, non-editorial work plan.
 * Priorities and readiness are explicit metadata; this function never infers
 * world membership, reading units, narrative facts, or spoiler permissions.
 */
export function resolveCatalogExpansionPlan(
  readiness: readonly WorldCatalogExpansionReadiness[],
  priorities: readonly WorldExpansionPriority[],
): CatalogExpansionPlanResult {
  const byWorld = new Map<string, WorldCatalogExpansionReadiness>();
  for (const item of readiness) {
    if (!item || typeof item.worldId !== "string" || !item.worldId.trim() || byWorld.has(item.worldId)) {
      return { status: "blocked", entries: [] };
    }
    if (item.status !== "ready" && item.status !== "cataloged" && item.status !== "blocked") {
      return { status: "blocked", entries: [] };
    }
    byWorld.set(item.worldId, item);
  }

  const priorityWorlds = new Set<string>();
  const priorityValues = new Set<number>();
  const entries: CatalogExpansionPlanEntry[] = [];
  for (const priority of priorities) {
    if (
      !priority ||
      typeof priority.worldId !== "string" ||
      !priority.worldId.trim() ||
      !Number.isInteger(priority.priority) ||
      priority.priority < 0 ||
      priorityWorlds.has(priority.worldId) ||
      priorityValues.has(priority.priority)
    ) return { status: "blocked", entries: [] };

    const item = byWorld.get(priority.worldId);
    if (!item) return { status: "blocked", entries: [] };
    priorityWorlds.add(priority.worldId);
    priorityValues.add(priority.priority);

    entries.push({
      worldId: item.worldId,
      priority: priority.priority,
      status: item.status,
      action: item.status === "ready"
        ? "expand-structure"
        : item.status === "cataloged"
          ? "await-catalog"
          : "blocked",
    });
  }

  if (byWorld.size !== priorityWorlds.size) return { status: "blocked", entries: [] };

  return {
    status: "valid",
    entries: entries.slice().sort((a, b) => a.priority - b.priority),
  };
}
