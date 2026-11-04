import { RosharReadingAchievement } from '../gamification';
import { ReadingProgress, ReadingUnit, SpoilerGate } from './model';
import { isNarrativeWorkComplete, getCompletedReadingUnitCount } from './progress';
import { selectVisibleClaims } from './spoilers';
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
 * descriptions. Hidden definitions need an explicit spoiler gate; unlocked
 * achievements always reveal their own presentation.
 */
export function selectVisibleRosharAchievements(
  projections: readonly RosharAchievementProjection[],
  progress: readonly ReadingProgress[]
): RosharAchievementPresentation[] {
  const claims = projections
    .filter(item => item.achievement.spoilerGate)
    .map(item => ({
      id: item.achievement.id,
      entityId: item.achievement.id,
      sectionKey: 'achievement',
      text: item.achievement.id,
      claimType: 'achievement',
      sourceRefs: [],
      confidence: 'confirmed' as const,
      editorialStatus: 'draft' as const,
      spoilerGate: item.achievement.spoilerGate as SpoilerGate
    }));
  const visibleIds = new Set(
    selectVisibleClaims(claims, [...progress], ROSHAR_READING_UNIT_WORK_BY_ID).map(claim => claim.id)
  );

  return projections.map(({ achievement, unlocked }) => {
    const hiddenUntilUnlocked = achievement.hiddenUntilUnlocked === true;
    const gateVisible = !achievement.spoilerGate || visibleIds.has(achievement.id);
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
