import { ReadingUnit, ReadingProgress } from './readingProgress';

export interface WorkScopedProgressValidationIssue {
  code: 'unknown_work' | 'foreign_unit';
  workId: string;
  unitId?: string;
}

/**
 * Validates persisted progress against the currently declared reading units.
 * It does not infer missing structure: unknown works and foreign unit IDs are
 * reported so callers can quarantine or migrate stale data safely.
 */
export function validateWorkScopedProgress(
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgress[],
): WorkScopedProgressValidationIssue[] {
  const issues: WorkScopedProgressValidationIssue[] = [];
  const unitsByWork = new Map<string, Set<string>>();

  for (const unit of units) {
    const ids = unitsByWork.get(unit.workId) ?? new Set<string>();
    ids.add(unit.id);
    unitsByWork.set(unit.workId, ids);
  }

  for (const entry of progress) {
    const validIds = unitsByWork.get(entry.workId);
    if (!validIds) {
      issues.push({ code: 'unknown_work', workId: entry.workId });
      continue;
    }

    for (const unitId of new Set(entry.completedUnitIds)) {
      if (!validIds.has(unitId)) {
        issues.push({ code: 'foreign_unit', workId: entry.workId, unitId });
      }
    }
  }

  return issues;
}

export function hasValidWorkScopedProgress(
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgress[],
): boolean {
  return validateWorkScopedProgress(units, progress).length === 0;
}
