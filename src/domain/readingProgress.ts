/**
 * Reusable, editorial-content-free reading progress primitives.
 * Unit identifiers and ordering must come from verified source structure.\n * Runtime progress metadata is treated as untrusted and malformed values fail closed.
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

function isCanonicalId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function hasValidProgressShape(progress: unknown): progress is ReadingProgress {
  if (
    !progress ||
    typeof progress !== 'object' ||
    !isCanonicalId((progress as ReadingProgress).workId) ||
    !Array.isArray((progress as ReadingProgress).completedUnitIds) ||
    !(progress as ReadingProgress).completedUnitIds.every(isCanonicalId)
  ) {
    return false;
  }

  // Persisted progress is an ordered collection at the runtime boundary.
  // Reject duplicates instead of silently hiding malformed data with a Set.
  return new Set((progress as ReadingProgress).completedUnitIds).size ===
    (progress as ReadingProgress).completedUnitIds.length;
}

function hasValidUnitShape(unit: unknown): unit is ReadingUnit {
  return Boolean(
    unit &&
    typeof unit === 'object' &&
    isCanonicalId((unit as ReadingUnit).id) &&
    isCanonicalId((unit as ReadingUnit).workId) &&
    Number.isSafeInteger((unit as ReadingUnit).position) &&
    (unit as ReadingUnit).position >= 1,
  );
}

export function getCompletedCount(progress: ReadingProgress | undefined): number {
  return hasValidProgressShape(progress) ? new Set(progress.completedUnitIds).size : 0;
}

export function getProgressFraction(
  units: readonly ReadingUnit[],
  progress: ReadingProgress | undefined,
): number {
  if (!hasValidProgressShape(progress) || !Array.isArray(units)) return 0;
  if (!units.every(hasValidUnitShape)) return 0;
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
  if (!hasValidProgressShape(progress) || !unit || !isCanonicalId(unit.id) || !isCanonicalId(unit.workId)) {
    return false;
  }
  return progress.workId === unit.workId && progress.completedUnitIds.includes(unit.id);
}
