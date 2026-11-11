import { resolveCatalogWork } from './cosmereExpansionCatalog';
import { validateReadingUnitCatalogReferences } from './readingUnitCatalogReferenceValidation';
import {
  validateWorkProgressConsistency,
  type WorkProgressConsistencyResult,
} from './workProgressConsistency';

export type WorkScopedSpoilerRequirement = {
  workId: string;
  requiredUnitIds: readonly string[];
};

export type WorkScopedSpoilerRequirementResult =
  | { status: 'valid'; requirement: WorkScopedSpoilerRequirement }
  | {
      status: 'blocked';
      reason:
        | 'invalid_requirement'
        | 'unknown_work'
        | 'invalid_registry'
        | 'unknown_required_unit'
        | 'cross_work_required_unit';
    };

function isCanonicalId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

/**
 * Validates spoiler requirements independently of narrative payload.
 *
 * This boundary establishes only technical consistency between one catalogued
 * work and registered reading-unit IDs. It does not infer chapters, pages,
 * chronology, world membership or narrative facts.
 */
export function validateWorkScopedSpoilerRequirement(
  requirement: unknown,
  registry: unknown,
): WorkScopedSpoilerRequirementResult {
  if (!requirement || typeof requirement !== 'object') {
    return { status: 'blocked', reason: 'invalid_requirement' };
  }

  const candidate = requirement as Partial<WorkScopedSpoilerRequirement>;
  if (!isCanonicalId(candidate.workId) || !Array.isArray(candidate.requiredUnitIds)) {
    return { status: 'blocked', reason: 'invalid_requirement' };
  }

  if (!resolveCatalogWork(candidate.workId)) {
    return { status: 'blocked', reason: 'unknown_work' };
  }

  const registryResult = validateReadingUnitCatalogReferences(registry);
  if (registryResult.status !== 'valid') {
    return { status: 'blocked', reason: 'invalid_registry' };
  }

  const unitsById = new Map(registryResult.units.map((unit) => [unit.id, unit]));
  const seen = new Set<string>();

  for (const unitId of candidate.requiredUnitIds) {
    if (!isCanonicalId(unitId) || seen.has(unitId)) {
      return { status: 'blocked', reason: 'invalid_requirement' };
    }
    seen.add(unitId);

    const unit = unitsById.get(unitId);
    if (!unit) return { status: 'blocked', reason: 'unknown_required_unit' };
    if (unit.workId !== candidate.workId) {
      return { status: 'blocked', reason: 'cross_work_required_unit' };
    }
  }

  return {
    status: 'valid',
    requirement: {
      workId: candidate.workId,
      requiredUnitIds: candidate.requiredUnitIds,
    },
  };
}

export type WorkScopedSpoilerUnlockResult =
  | { status: 'visible' }
  | {
      status: 'blocked';
      reason:
        | WorkProgressConsistencyResult extends { status: 'blocked'; reason: infer R } ? R : never
        | 'invalid_requirement'
        | 'unknown_required_unit'
        | 'cross_work_required_unit'
        | 'incomplete_progress';
    };

export function resolveWorkScopedSpoilerUnlock(
  requirement: unknown,
  progress: unknown,
  registry: unknown,
): WorkScopedSpoilerUnlockResult {
  const progressResult = validateWorkProgressConsistency(progress, registry);
  if (progressResult.status !== 'valid') return progressResult;

  const requirementResult = validateWorkScopedSpoilerRequirement(requirement, registry);
  if (requirementResult.status !== 'valid') return requirementResult;

  if (requirementResult.requirement.workId !== progressResult.progress.workId) {
    return { status: 'blocked', reason: 'cross_work_required_unit' };
  }

  const completed = new Set(progressResult.progress.completedUnitIds);
  for (const unitId of requirementResult.requirement.requiredUnitIds) {
    if (!completed.has(unitId)) {
      return { status: 'blocked', reason: 'incomplete_progress' };
    }
  }

  return { status: 'visible' };
}
