import type { WorldProgressMilestoneResult } from "./worldProgressMilestones";

export interface WorldProgressAvailability {
  worldId: string;
  available: boolean;
}

/**
 * Converts validated technical milestones into explicit world availability.
 * World identifiers are canonical metadata: empty, padded, malformed or
 * ambiguous identifiers block the complete result rather than being silently
 * normalized, so downstream layers cannot merge distinct source records.
 */
export function resolveWorldProgressAvailability(
  milestones: WorldProgressMilestoneResult,
): { status: "valid" | "blocked"; worlds: readonly WorldProgressAvailability[] } {
  if (milestones.status !== "valid") return { status: "blocked", worlds: [] };
  const seen = new Set<string>();
  const worlds: WorldProgressAvailability[] = [];
  for (const entry of milestones.milestones) {
    if (!entry || typeof entry.worldId !== "string" || !entry.worldId.trim() ||
      entry.worldId !== entry.worldId.trim() || seen.has(entry.worldId) ||
      !["not-started", "started", "complete"].includes(entry.milestone)) {
      return { status: "blocked", worlds: [] };
    }
    seen.add(entry.worldId);
    worlds.push({ worldId: entry.worldId, available: entry.milestone !== "not-started" });
  }
  return { status: "valid", worlds: worlds.sort((a, b) => a.worldId.localeCompare(b.worldId)) };
}
