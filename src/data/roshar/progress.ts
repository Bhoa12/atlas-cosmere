import { ReadingProgress, ReadingUnit } from './model';

export interface ReadingProgressIssue {
  code: 'unknown-work' | 'duplicate-work' | 'unknown-unit' | 'wrong-work' | 'duplicate-unit' | 'invalid-current-unit';
  workId: string;
  readingUnitId?: string;
}

/** Creates empty granular progress. Legacy chapter counters are intentionally not accepted here. */
export function createEmptyReadingProgress(workIds: readonly string[], updatedAt: string): ReadingProgress[] {
  return workIds.map(workId => ({
    workId,
    completedUnitIds: [],
    updatedAt
  }));
}

/**
 * Sets the current position without marking anything as completed.
 * This distinction prevents opening a chapter from silently granting its content.
 */
export function setCurrentReadingUnit(
  progress: ReadingProgress[],
  workId: string,
  readingUnitId: string,
  unitWorkById: ReadonlyMap<string, string>,
  updatedAt: string
): ReadingProgress[] {
  if (unitWorkById.get(readingUnitId) !== workId) return progress;
  const current = progress.find(item => item.workId === workId);
  const next: ReadingProgress = current
    ? { ...current, currentUnitId: readingUnitId, updatedAt }
    : { workId, completedUnitIds: [], currentUnitId: readingUnitId, updatedAt };
  return [...progress.filter(item => item.workId !== workId), next];
}

/**
 * Completes exactly one explicitly selected unit. No earlier or later unit is inferred.
 */
export function markReadingUnitCompleted(
  progress: ReadingProgress[],
  workId: string,
  readingUnitId: string,
  unitWorkById: ReadonlyMap<string, string>,
  updatedAt: string
): ReadingProgress[] {
  if (unitWorkById.get(readingUnitId) !== workId) return progress;
  const current = progress.find(item => item.workId === workId);
  const completedUnitIds = Array.from(new Set([...(current?.completedUnitIds ?? []), readingUnitId]));
  const next: ReadingProgress = {
    workId,
    completedUnitIds,
    currentUnitId: readingUnitId,
    updatedAt
  };
  return [...progress.filter(item => item.workId !== workId), next];
}

/** Sanitizes only the new explicit-unit schema; it never translates legacy chapter numbers. */
export function sanitizeReadingProgress(
  value: unknown,
  workIds: readonly string[],
  unitWorkById: ReadonlyMap<string, string>,
  updatedAt: string
): ReadingProgress[] {
  const empty = createEmptyReadingProgress(workIds, updatedAt);
  if (!Array.isArray(value)) return empty;
  const knownWorks = new Set(workIds);
  const byWork = new Map<string, ReadingProgress>();

  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue;
    const item = candidate as Partial<ReadingProgress>;
    if (typeof item.workId !== 'string' || !knownWorks.has(item.workId)) continue;
    const completedUnitIds = Array.isArray(item.completedUnitIds)
      ? Array.from(new Set(item.completedUnitIds.filter((id): id is string =>
          typeof id === 'string' && unitWorkById.get(id) === item.workId
        )))
      : [];
    const currentUnitId = typeof item.currentUnitId === 'string' &&
      unitWorkById.get(item.currentUnitId) === item.workId
      ? item.currentUnitId
      : undefined;
    byWork.set(item.workId, {
      workId: item.workId,
      completedUnitIds,
      ...(currentUnitId ? { currentUnitId } : {}),
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : updatedAt
    });
  }

  return empty.map(item => byWork.get(item.workId) ?? item);
}

/** Checks the explicit completion/current-unit contract without repairing data. */
export function validateReadingProgress(
  progress: ReadingProgress[],
  workIds: readonly string[],
  unitWorkById: ReadonlyMap<string, string>
): ReadingProgressIssue[] {
  const issues: ReadingProgressIssue[] = [];
  const knownWorks = new Set(workIds);
  const seenWorks = new Set<string>();

  for (const item of progress) {
    if (!knownWorks.has(item.workId)) {
      issues.push({ code: 'unknown-work', workId: item.workId });
      continue;
    }
    if (seenWorks.has(item.workId)) issues.push({ code: 'duplicate-work', workId: item.workId });
    seenWorks.add(item.workId);
    const seenUnits = new Set<string>();
    for (const id of item.completedUnitIds) {
      if (seenUnits.has(id)) issues.push({ code: 'duplicate-unit', workId: item.workId, readingUnitId: id });
      seenUnits.add(id);
      if (!unitWorkById.has(id)) issues.push({ code: 'unknown-unit', workId: item.workId, readingUnitId: id });
      else if (unitWorkById.get(id) !== item.workId) issues.push({ code: 'wrong-work', workId: item.workId, readingUnitId: id });
    }
    if (item.currentUnitId && unitWorkById.get(item.currentUnitId) !== item.workId) {
      issues.push({ code: 'invalid-current-unit', workId: item.workId, readingUnitId: item.currentUnitId });
    }
  }
  return issues;
}

/**
 * Returns whether a catalog unit is required to declare the narrative work read.
 * Structural sections are not ReadingUnits and therefore cannot be passed here.
 * Supplementary matter remains trackable but does not block narrative completion.
 * Unknown 'other' entries are treated as required until editorially classified,
 * preventing an unreviewed narrative entry from being silently skipped.
 */
export function isRequiredForNarrativeCompletion(unit: ReadingUnit): boolean {
  return !(
    unit.kind === 'ars-arcanum' ||
    unit.kind === 'afterword' ||
    unit.kind === 'acknowledgements' ||
    unit.kind === 'appendix'
  );
}
