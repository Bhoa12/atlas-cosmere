import { ReadingProgress } from './readingProgress';

export interface SpoilerRequirement {
  workId: string;
  completedUnitId?: string;
}

export type ContentVisibility = 'visible' | 'blocked';

/**
 * Evaluates only explicit unlock requirements. It does not infer lore or
 * reading order from titles; callers provide verified unit completion state.
 */
export function evaluateSpoilerAccess(
  requirements: readonly SpoilerRequirement[],
  progressByWork: Readonly<Record<string, ReadingProgress | undefined>>,
): ContentVisibility {
  return requirements.every((requirement) => {
    const progress = progressByWork[requirement.workId];
    if (!progress) return false;
    if (!requirement.completedUnitId) return progress.completedUnitIds.length > 0;
    return progress.completedUnitIds.includes(requirement.completedUnitId);
  }) ? 'visible' : 'blocked';
}
