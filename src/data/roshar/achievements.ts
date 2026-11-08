import { RosharReadingAchievement } from '../gamification';
import { ReadingProgress, ReadingUnit } from './model';
import { isNarrativeWorkComplete, getUnambiguousReadingProgress } from './progress';
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
  // Count only catalog units that belong to an unambiguous progress record.
  // Raw persistence may contain unknown or cross-work IDs; those must not grant achievements.
  // Runtime persistence/imports can bypass TypeScript, so malformed collections fail closed.
  const safeAchievements = Array.isArray(achievements) ? achievements : [];
  const safeUnits = Array.isArray(units) ? units : [];
  const safeProgress = Array.isArray(progress) ? progress.filter((item): item is ReadingProgress => Boolean(item && typeof item === 'object' && typeof item.workId === 'string' && Array.isArray(item.completedUnitIds))) : [];
  const unitWorkById = new Map(safeUnits.filter((unit): unit is ReadingUnit => Boolean(unit && typeof unit === 'object' && typeof unit.id === 'string' && typeof unit.workId === 'string')).map(unit => [unit.id, unit.workId]));
  const workCounts = new Map<string, number>();
  for (const item of safeProgress) {
    workCounts.set(item.workId, (workCounts.get(item.workId) ?? 0) + 1);
  }
  const totalCompleted = safeProgress
    .filter(item => workCounts.get(item.workId) === 1)
    .reduce((total, item) => total + new Set(
      item.completedUnitIds.filter(id => unitWorkById.get(id) === item.workId)
    ).size, 0);
  return safeAchievements.filter((achievement): achievement is RosharReadingAchievement => Boolean(achievement && typeof achievement === 'object')).map(achievement => {
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
  const safeProjections = Array.isArray(projections) ? projections : [];
  const safeProgress = Array.isArray(progress) ? progress.filter((item): item is ReadingProgress => Boolean(item && typeof item === 'object' && typeof item.workId === 'string' && Array.isArray(item.completedUnitIds))) : [];
  const safePersistentIds = Array.isArray(persistentlyUnlockedAchievementIds) ? persistentlyUnlockedAchievementIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map(id => id.trim()) : [];
  const workCounts = new Map<string, number>();
  for (const item of safeProgress) {
    workCounts.set(item.workId, (workCounts.get(item.workId) ?? 0) + 1);
  }
  const completedUnitIds = new Set(
    safeProgress
      .filter(item => workCounts.get(item.workId) === 1 && getUnambiguousReadingProgress(safeProgress, item.workId))
      .flatMap(item => item.completedUnitIds)
  );

  const persistentIds = new Set(safePersistentIds);

  return safeProjections.filter((projection): projection is RosharAchievementProjection => Boolean(projection && typeof projection === 'object' && projection.achievement && typeof projection.achievement.id === 'string')).map(({ achievement, unlocked: currentlyUnlocked }) => {
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
  const safeProjections = Array.isArray(projections) ? projections : [];
  return Array.from(new Set(
    safeProjections
      .filter((item): item is RosharAchievementProjection => Boolean(item && typeof item === 'object' && item.unlocked && item.achievement && item.achievement.reward && typeof item.achievement.reward.id === 'string' && item.achievement.reward.id.trim().length > 0))
      .map(item => item.achievement.reward.id.trim())
  ));
}
