import { ReadingProgress, ReadingUnit } from "./readingProgress";

export interface ReadingProgressSummary {
  workId: string;
  totalUnits: number;
  completedUnits: number;
  fraction: number;
  nextUnitId: string | null;
}

export interface ReadingProgressSummaryResult {
  status: "valid" | "blocked";
  summaries: readonly ReadingProgressSummary[];
}

/**
 * Builds UI-safe progress summaries from explicitly supplied unit structure.
 * It derives only counts and the next declared position; it never infers
 * chapters or editorial structure. Invalid snapshots are blocked entirely.
 */
export function resolveReadingProgressSummaries(
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgress[],
): ReadingProgressSummaryResult {
  const workByUnit = new Map<string, string>();
  const positions = new Map<string, Set<number>>();
  const progressByWork = new Map<string, ReadingProgress>();

  for (const unit of units) {
    if (!unit.id || !unit.workId || !Number.isInteger(unit.position) || unit.position <= 0 || workByUnit.has(unit.id)) {
      return { status: "blocked", summaries: [] };
    }
    const seen = positions.get(unit.workId) ?? new Set<number>();
    if (seen.has(unit.position)) return { status: "blocked", summaries: [] };
    seen.add(unit.position);
    positions.set(unit.workId, seen);
    workByUnit.set(unit.id, unit.workId);
  }

  for (const entry of progress) {
    if (!entry.workId || progressByWork.has(entry.workId)) return { status: "blocked", summaries: [] };
    const completed = new Set<string>();
    for (const unitId of entry.completedUnitIds) {
      if (!unitId || completed.has(unitId) || workByUnit.get(unitId) !== entry.workId) {
        return { status: "blocked", summaries: [] };
      }
      completed.add(unitId);
    }
    progressByWork.set(entry.workId, entry);
  }

  const unitsByWork = new Map<string, ReadingUnit[]>();
  for (const unit of units) {
    const list = unitsByWork.get(unit.workId) ?? [];
    list.push(unit);
    unitsByWork.set(unit.workId, list);
  }

  return {
    status: "valid",
    summaries: [...unitsByWork.entries()].map(([workId, list]) => {
      const ordered = [...list].sort((a, b) => a.position - b.position);
      const completed = new Set(progressByWork.get(workId)?.completedUnitIds ?? []);
      const completedUnits = ordered.filter((unit) => completed.has(unit.id)).length;
      const next = ordered.find((unit) => !completed.has(unit.id));
      return {
        workId,
        totalUnits: ordered.length,
        completedUnits,
        fraction: ordered.length === 0 ? 0 : completedUnits / ordered.length,
        nextUnitId: next?.id ?? null,
      };
    }),
  };
}
