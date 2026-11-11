import { ReadingUnit } from './readingProgress';

export interface ReadingUnitValidationIssue {
  code:
    | 'invalid_collection_shape'
    | 'invalid_unit_shape'
    | 'empty_id'
    | 'non_canonical_id'
    | 'duplicate_id'
    | 'empty_work_id'
    | 'non_canonical_work_id'
    | 'invalid_position'
    | 'duplicate_position';
  unitId?: string;
  workId?: string;
}

/**
 * Validates structural reading-unit metadata without inspecting editorial content.
 * Ordering is checked independently per work so the same position can exist in
 * different works. Persisted/imported collections are treated as untrusted.
 */
export function validateReadingUnits(
  units: readonly ReadingUnit[],
): ReadingUnitValidationIssue[] {
  if (!Array.isArray(units)) {
    return [{ code: 'invalid_collection_shape' }];
  }

  const issues: ReadingUnitValidationIssue[] = [];
  const ids = new Set<string>();
  const positionsByWork = new Map<string, Set<number>>();

  for (const unit of units) {
    if (
      !unit ||
      typeof unit.id !== 'string' ||
      typeof unit.workId !== 'string' ||
      typeof unit.position !== 'number'
    ) {
      issues.push({ code: 'invalid_unit_shape' });
      continue;
    }

    if (!unit.id.trim()) {
      issues.push({ code: 'empty_id', unitId: unit.id });
    } else if (unit.id !== unit.id.trim()) {
      issues.push({ code: 'non_canonical_id', unitId: unit.id });
    } else if (ids.has(unit.id)) {
      issues.push({ code: 'duplicate_id', unitId: unit.id });
    } else {
      ids.add(unit.id);
    }

    if (!unit.workId.trim()) {
      issues.push({ code: 'empty_work_id', unitId: unit.id });
      continue;
    }

    if (unit.workId !== unit.workId.trim()) {
      issues.push({ code: 'non_canonical_work_id', unitId: unit.id, workId: unit.workId });
      continue;
    }

    if (!Number.isSafeInteger(unit.position) || unit.position < 1) {
      issues.push({ code: 'invalid_position', unitId: unit.id, workId: unit.workId });
      continue;
    }

    const positions = positionsByWork.get(unit.workId) ?? new Set<number>();
    if (positions.has(unit.position)) {
      issues.push({ code: 'duplicate_position', unitId: unit.id, workId: unit.workId });
    }
    positions.add(unit.position);
    positionsByWork.set(unit.workId, positions);
  }

  return issues;
}

export function hasValidReadingUnits(units: readonly ReadingUnit[]): boolean {
  return validateReadingUnits(units).length === 0;
}
