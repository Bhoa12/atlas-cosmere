import { ReadingUnit, resolveReadingUnitRegistry } from "./readingUnitRegistry";

export interface ReadingProgressEntry {
  unitId: string;
  completed: boolean;
}

export interface ReadingProgressResolution {
  status: "valid" | "blocked";
  completedUnitIds: readonly string[];
}

/**
 * Resolves explicit completion state against a validated reading-unit registry.
 * Completion is structural state only and does not authorize narrative reveals.
 */
export function resolveReadingProgressState(
  declaredWorkIds: readonly string[],
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgressEntry[],
): ReadingProgressResolution {
  const registry = resolveReadingUnitRegistry(declaredWorkIds, units);
  if (registry.status !== "valid") return { status: "blocked", completedUnitIds: [] };

  const known = new Set(registry.units.map((unit) => unit.id));
  const seen = new Set<string>();
  const completed = new Set<string>();
  for (const entry of progress) {
    const unitId = typeof entry.unitId === "string" ? entry.unitId.trim() : "";
    if (!unitId || !known.has(unitId) || seen.has(unitId) || typeof entry.completed !== "boolean") {
      return { status: "blocked", completedUnitIds: [] };
    }
    seen.add(unitId);
    if (entry.completed) completed.add(unitId);
  }
  const order = new Map(registry.units.map((unit, index) => [unit.id, index]));
  return { status: "valid", completedUnitIds: [...completed].sort((a,b) => order.get(a)! - order.get(b)!) };
}
