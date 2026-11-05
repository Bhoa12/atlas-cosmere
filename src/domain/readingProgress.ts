/**
 * Reusable, editorial-content-free reading progress primitives.
 * Unit identifiers and ordering must come from verified source structure.
 */
export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
}

export interface ReadingProgress {
  workId: string;
  completedUnitIds: readonly string[];
}

export function getCompletedCount(progress: ReadingProgress | undefined): number {
  return progress?.completedUnitIds.length ?? 0;
}

export function getProgressFraction(
  units: readonly ReadingUnit[],
  progress: ReadingProgress | undefined,
): number {
  if (units.length === 0 || !progress) return 0;
  const valid = new Set(
    units.filter((unit) => unit.workId === progress.workId).map((unit) => unit.id),
  );
  const completed = new Set(progress.completedUnitIds.filter((id) => valid.has(id)));
  return completed.size / valid.size || 0;
}

export function isUnitCompleted(
  progress: ReadingProgress | undefined,
  unitId: string,
): boolean {
  return progress?.completedUnitIds.includes(unitId) ?? false;
}
