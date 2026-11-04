import { RosharReadingAchievement } from '../gamification';
import { ReadingProgress, ReadingUnit } from './model';
import { getCompletedReadingUnitCount, isNarrativeWorkComplete } from './progress';

export interface RosharAchievementProjection {
  achievement: RosharReadingAchievement;
  unlocked: boolean;
}

/**
 * Evaluates reading achievements from explicit progress only. This function does
 * not persist rewards, so repeated evaluation cannot duplicate an unlock.
 */
export function evaluateRosharReadingAchievements(
  achievements: readonly RosharReadingAchievement[],
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgress[]
): RosharAchievementProjection[] {
  const totalCompleted = getCompletedReadingUnitCount(progress);

  return achievements.map(achievement => {
    const countSatisfied = achievement.requiredCompletedUnits === undefined ||
      totalCompleted >= achievement.requiredCompletedUnits;
    const completionSatisfied = !achievement.requiresNarrativeCompletion ||
      Boolean(achievement.workId && isNarrativeWorkComplete(achievement.workId, units, progress));

    return {
      achievement,
      unlocked: countSatisfied && completionSatisfied
    };
  });
}

/** Returns stable reward IDs without duplicates when multiple achievements share one reward. */
export function selectUnlockedRosharRewardIds(
  projections: readonly RosharAchievementProjection[]
): string[] {
  return Array.from(new Set(
    projections.filter(item => item.unlocked).map(item => item.achievement.reward.id)
  ));
}
