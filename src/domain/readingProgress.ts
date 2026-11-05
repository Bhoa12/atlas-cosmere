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
  return progress ? new Set(progress.completedUnitIds).size : 0;
}

export function getProgressFraction(
  units: readonly ReadingUnit[],
  progress: ReadingProgress | undefined,
): number {
  if (!progress) return 0;
  const valid = new Set(
    units.filter((unit) => unit.workId === progress.workId).map((unit) => unit.id),
  );
  if (valid.size === 0) return 0;
  const completed = new Set(progress.completedUnitIds.filter((id) => valid.has(id)));
  return completed.size / valid.size;
}

/**
 * Checks completion only when the unit belongs to the same work as the progress.
 * This prevents a globally repeated identifier from unlocking unrelated content.
 */
export function isUnitCompleted(
  progress: ReadingProgress | undefined,
  unit: Pick<ReadingUnit, 'id' | 'workId'>,
): boolean {
  return progress?.workId === unit.workId && progress.completedUnitIds.includes(unit.id);
}
