import { WorldExpansionReadiness } from "./worldExpansionReadiness";

export interface WorldExpansionPriority {
  worldId: string;
  priority: number;
}

export interface WorldExpansionQueueEntry {
  worldId: string;
  priority: number;
  status: WorldExpansionReadiness["status"];
  eligible: boolean;
}

export interface WorldExpansionQueueResult {
  status: "valid" | "blocked";
  entries: readonly WorldExpansionQueueEntry[];
}

/**
 * Orders already-computed world readiness metadata without inventing editorial
 * relationships. Only structure-ready worlds are eligible; cataloged worlds
 * remain visible as pending metadata and blocked readiness never becomes an
 * implicit authorization.
 */
export function resolveWorldExpansionQueue(
  readiness: readonly WorldExpansionReadiness[],
  priorities: readonly WorldExpansionPriority[],
): WorldExpansionQueueResult {
  const readinessByWorld = new Map<string, WorldExpansionReadiness>();
  for (const item of readiness) {
    if (!item.worldId || readinessByWorld.has(item.worldId)) {
      return { status: "blocked", entries: [] };
    }
    readinessByWorld.set(item.worldId, item);
  }

  const priorityIds = new Set<string>();
  const entries: WorldExpansionQueueEntry[] = [];
  for (const priority of priorities) {
    if (
      !priority.worldId ||
      !Number.isInteger(priority.priority) ||
      priority.priority < 0 ||
      priorityIds.has(priority.worldId)
    ) {
      return { status: "blocked", entries: [] };
    }
    priorityIds.add(priority.worldId);

    const item = readinessByWorld.get(priority.worldId);
    if (!item) return { status: "blocked", entries: [] };
    entries.push({
      worldId: priority.worldId,
      priority: priority.priority,
      status: item.status,
      eligible: item.status === "structure-ready",
    });
  }

  for (const worldId of readinessByWorld.keys()) {
    if (!priorityIds.has(worldId)) return { status: "blocked", entries: [] };
  }

  return {
    status: "valid",
    entries: entries.slice().sort((left, right) => left.priority - right.priority),
  };
}
