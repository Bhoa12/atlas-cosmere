import { ReadingProgress, ReadingUnit } from './model';
import { getUnambiguousReadingProgress, isRequiredForNarrativeCompletion, summarizeReadingWork } from './progress';

export interface RosharReadingStreak {
  completedConsecutiveUnits: number;
  firstGapUnitId?: string;
  currentUnitIsCompleted: boolean;
}

/**
 * Measures the contiguous reading frontier without assuming that later completed
 * units imply earlier completion. Supplementary units do not break a narrative
 * streak because they are optional for narrative completion.
 */
export function summarizeNarrativeReadingStreak(
  workId: string,
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgress[]
): RosharReadingStreak {
  const required = units
    .filter(unit => unit.workId === workId && isRequiredForNarrativeCompletion(unit))
    .sort((a, b) => a.ordinal - b.ordinal);
  const workProgress = getUnambiguousReadingProgress(progress, workId);
  const completed = new Set(workProgress?.completedUnitIds ?? []);
  const firstGap = required.find(unit => !completed.has(unit.id));
  const completedConsecutiveUnits = firstGap
    ? required.findIndex(unit => unit.id === firstGap.id)
    : required.length;
  const currentUnitId = workProgress?.currentUnitId;
  return {
    completedConsecutiveUnits,
    ...(firstGap ? { firstGapUnitId: firstGap.id } : {}),
    currentUnitIsCompleted: Boolean(
      currentUnitId &&
      completed.has(currentUnitId) &&
      required.some(unit => unit.id === currentUnitId)
    )
  };
}

export interface RosharReadingDashboard {
  workId: string;
  percent: number;
  narrativeComplete: boolean;
  nextNarrativeUnitId?: string;
  completedConsecutiveUnits: number;
  firstGapUnitId?: string;
}

/** UI-oriented projection built entirely from explicit granular progress. */
export function buildRosharReadingDashboard(
  workId: string,
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgress[]
): RosharReadingDashboard {
  const summary = summarizeReadingWork(workId, units, progress);
  const streak = summarizeNarrativeReadingStreak(workId, units, progress);
  const required = units
    .filter(unit => unit.workId === workId && isRequiredForNarrativeCompletion(unit))
    .sort((a, b) => a.ordinal - b.ordinal);
  return {
    workId,
    percent: summary.percent,
    narrativeComplete: summary.narrativeComplete,
    nextNarrativeUnitId: required.find(unit => unit.id === streak.firstGapUnitId)?.id,
    completedConsecutiveUnits: streak.completedConsecutiveUnits,
    ...(streak.firstGapUnitId ? { firstGapUnitId: streak.firstGapUnitId } : {})
  };
}
