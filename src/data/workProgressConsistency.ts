import { resolveCatalogWork } from './cosmereExpansionCatalog';
import { validateReadingUnitCatalogReferences } from './readingUnitCatalogReferenceValidation';

/**
 * Validates a reader progress snapshot against one technical work.
 *
 * This boundary establishes only identifier consistency. It deliberately does
 * not infer editorial order, chapters, pages, chronology or narrative facts.
 */
export type WorkProgressSnapshot = {
  workId: string;
  completedUnitIds: readonly string[];
};

export type WorkProgressConsistencyResult =
  | { status: 'valid'; progress: WorkProgressSnapshot }
  | {
      status: 'blocked';
      reason:
        | 'invalid_progress'
        | 'unknown_work'
        | 'invalid_registry'
        | 'unknown_completed_unit'
        | 'cross_work_completed_unit';
    };

function isCanonicalId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

export function validateWorkProgressConsistency(
  progress: unknown,
  registry: unknown,
): WorkProgressConsistencyResult {
  if (!progress || typeof progress !== 'object') {
    return { status: 'blocked', reason: 'invalid_progress' };
  }

  const candidate = progress as Partial<WorkProgressSnapshot>;
  if (!isCanonicalId(candidate.workId) || !Array.isArray(candidate.completedUnitIds)) {
    return { status: 'blocked', reason: 'invalid_progress' };
  }

  if (!resolveCatalogWork(candidate.workId)) {
    return { status: 'blocked', reason: 'unknown_work' };
  }

  const registryResult = validateReadingUnitCatalogReferences(registry);
  if (registryResult.status !== 'valid') {
    return {
      status: 'blocked',
      reason: registryResult.reason === 'invalid_registry'
        ? 'invalid_registry'
        : 'unknown_completed_unit',
    };
  }

  const seen = new Set<string>();
  const unitsById = new Map(registryResult.units.map((unit) => [unit.id, unit]));

  for (const unitId of candidate.completedUnitIds) {
    if (!isCanonicalId(unitId) || seen.has(unitId)) {
      return { status: 'blocked', reason: 'invalid_progress' };
    }
    seen.add(unitId);

    const unit = unitsById.get(unitId);
    if (!unit) {
      return { status: 'blocked', reason: 'unknown_completed_unit' };
    }
    if (unit.workId !== candidate.workId) {
      return { status: 'blocked', reason: 'cross_work_completed_unit' };
    }
  }

  return {
    status: 'valid',
    progress: {
      workId: candidate.workId,
      completedUnitIds: candidate.completedUnitIds,
    },
  };
}
