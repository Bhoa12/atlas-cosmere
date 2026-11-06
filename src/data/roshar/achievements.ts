import { RosharReadingAchievement } from '../gamification';
import { ReadingProgress, ReadingUnit } from './model';
import { isNarrativeWorkComplete, getCompletedReadingUnitCount, getUnambiguousReadingProgress } from './progress';
import { isSpoilerGateSatisfied } from './spoilers';
import { ROSHAR_READING_UNIT_WORK_BY_ID } from './catalog/readingUnits';

export interface RosharAchievementProjection {
  achievement: RosharReadingAchievement;
  unlocked: boolean;
}

export interface RosharAchievementPresentation {
  id: string;
  title: string;
  description: string;
  hidden: boolean;
  unlocked: boolean;
  reward?: RosharReadingAchievement['reward'];
}

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
    return { achievement, unlocked: countSatisfied && completionSatisfied };
  });
}

/**
 * Projects achievements for UI without leaking locked spoiler-bearing titles or
 * descriptions. Spoiler-gated presentation is evaluated directly with the
 * shared fail-closed gate evaluator; encyclopedia publication requirements do
 * not apply to achievement metadata.
 */
export function selectVisibleRosharAchievements(
  projections: readonly RosharAchievementProjection[],
  progress: readonly ReadingProgress[],
  persistentlyUnlockedAchievementIds: readonly string[] = []
): RosharAchievementPresentation[] {
  // Ambiguous duplicate work records are fail-closed throughout progress.
  // Do not let conflicting persistence unlock spoiler-gated achievement metadata.
  const workCounts = new Map<string, number>();
  for (const item of progress) {
    workCounts.set(item.workId, (workCounts.get(item.workId) ?? 0) + 1);
  }
  const completedUnitIds = new Set(
    progress
      .filter(item => workCounts.get(item.workId) === 1 && getUnambiguousReadingProgress(progress, item.workId))
      .flatMap(item => item.completedUnitIds)
  );

  const persistentIds = new Set(persistentlyUnlockedAchievementIds);

  return projections.map(({ achievement, unlocked: currentlyUnlocked }) => {
    // Achievement grants are monotonic once persisted. A later correction to
    // reading progress must not make an already granted achievement disappear.
    const unlocked = currentlyUnlocked || persistentIds.has(achievement.id);
    const hiddenUntilUnlocked = achievement.hiddenUntilUnlocked === true;
    const gateVisible = !achievement.spoilerGate || isSpoilerGateSatisfied(
      achievement.spoilerGate,
      completedUnitIds,
      ROSHAR_READING_UNIT_WORK_BY_ID
    );
    const hidden = !unlocked && (hiddenUntilUnlocked || !gateVisible);
    return hidden
      ? { id: achievement.id, title: '???', description: 'Logro aún oculto.', hidden: true, unlocked }
      : {
          id: achievement.id,
          title: achievement.title,
          description: achievement.description,
          hidden: false,
          unlocked,
          ...(unlocked ? { reward: achievement.reward } : {})
        };
  });
}

export function selectUnlockedRosharRewardIds(
  projections: readonly RosharAchievementProjection[]
): string[] {
  return Array.from(new Set(
    projections.filter(item => item.unlocked).map(item => item.achievement.reward.id)
  ));
}
