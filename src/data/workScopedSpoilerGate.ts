import { resolveSpoilerGate, type SpoilerGateResult } from './antiSpoilerPolicy';
import { validateWorkProgressConsistency, type WorkProgressSnapshot } from './workProgressConsistency';

export type WorkScopedSpoilerContent<T> = {
  workId: string;
  requiredUnitIds: readonly string[];
  payload: T;
};

export type WorkScopedSpoilerGateResult<T> =
  | SpoilerGateResult<T>
  | {
      status: 'blocked';
      reason:
        | 'invalid_progress'
        | 'unknown_work'
        | 'invalid_registry'
        | 'unknown_completed_unit'
        | 'cross_work_completed_unit'
        | 'invalid_content'
        | 'cross_work_required_unit';
    };

/**
 * Resolves protected content only after progress has been validated against
 * one technical work. This function establishes identifier consistency only:
 * it does not infer chapters, chronology or narrative facts.
 */
export function resolveWorkScopedSpoilerGate<T>(
  content: unknown,
  progress: unknown,
  registry: unknown,
): WorkScopedSpoilerGateResult<T> {
  const progressResult = validateWorkProgressConsistency(progress, registry);
  if (progressResult.status !== 'valid') return progressResult;

  if (!content || typeof content !== 'object') {
    return { status: 'blocked', reason: 'invalid_content' };
  }

  const candidate = content as Partial<WorkScopedSpoilerContent<T>>;
  if (
    typeof candidate.workId !== 'string' ||
    candidate.workId.length === 0 ||
    candidate.workId.trim() !== candidate.workId ||
    !Array.isArray(candidate.requiredUnitIds)
  ) {
    return { status: 'blocked', reason: 'invalid_content' };
  }

  const validatedProgress: WorkProgressSnapshot = progressResult.progress;
  if (candidate.workId !== validatedProgress.workId) {
    return { status: 'blocked', reason: 'cross_work_required_unit' };
  }

  const completed = new Set(validatedProgress.completedUnitIds);
  for (const unitId of candidate.requiredUnitIds) {
    if (typeof unitId !== 'string' || unitId.length === 0 || unitId.trim() !== unitId) {
      return { status: 'blocked', reason: 'invalid_content' };
    }
    if (!completed.has(unitId)) return { status: 'blocked', reason: 'locked' };
  }

  return resolveSpoilerGate<T>(
    { requiredUnitIds: candidate.requiredUnitIds, payload: candidate.payload as T },
    validatedProgress.completedUnitIds,
  );
}
