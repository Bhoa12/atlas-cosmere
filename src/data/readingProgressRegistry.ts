export type WorkId = string;
export type ReadingUnitId = string;

export interface ReadingProgress {
  workId: WorkId;
  completedUnitIds: readonly ReadingUnitId[];
}

export interface ProgressRegistry {
  isKnownWork(workId: WorkId): boolean;
  isKnownUnit(workId: WorkId, unitId: ReadingUnitId): boolean;
}

/**
 * Validates progress without inferring editorial structure.
 * Unknown works/units and duplicates are rejected (fail-closed).
 */
export function validateReadingProgress(
  progress: ReadingProgress,
  registry: ProgressRegistry,
): boolean {
  if (!isCanonicalId(progress.workId) || !registry.isKnownWork(progress.workId)) return false;
  const seen = new Set<string>();
  for (const unitId of progress.completedUnitIds) {
    if (!isCanonicalId(unitId) || seen.has(unitId)) return false;
    if (!registry.isKnownUnit(progress.workId, unitId)) return false;
    seen.add(unitId);
  }
  return true;
}

export function isCanonicalId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}