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

function isValidAchievement(achievement: unknown): achievement is RosharReadingAchievement {
  return Boolean(
    achievement &&
    typeof achievement === 'object' &&
    typeof (achievement as RosharReadingAchievement).id === 'string' &&
    (achievement as RosharReadingAchievement).id.trim().length > 0 &&
    ((achievement as RosharReadingAchievement).requiredCompletedUnits === undefined ||
      (typeof (achievement as RosharReadingAchievement).requiredCompletedUnits === 'number' &&
        Number.isSafeInteger((achievement as RosharReadingAchievement).requiredCompletedUnits) &&
        (achievement as RosharReadingAchievement).requiredCompletedUnits >= 0)) &&
    ((achievement as RosharReadingAchievement).requiresNarrativeCompletion === undefined ||
      typeof (achievement as RosharReadingAchievement).requiresNarrativeCompletion === 'boolean') &&
    ((achievement as RosharReadingAchievement).workId === undefined ||
      (typeof (achievement as RosharReadingAchievement).workId === 'string' &&
        (achievement as RosharReadingAchievement).workId.trim().length > 0))
  );
}

function uniqueValidAchievements(achievements: readonly RosharReadingAchievement[]): RosharReadingAchievement[] {
  const seen = new Set<string>();
  return (Array.isArray(achievements) ? achievements : []).filter(isValidAchievement).filter(achievement => {
    const id = achievement.id.trim();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function evaluateRosharReadingAchievements(
  achievements: readonly RosharReadingAchievement[],
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgress[]
): RosharAchievementProjection[] {
  const safeAchievements = uniqueValidAchievements(achievements);
  const safeUnits = Array.isArray(units) ? units : [];
  const safeProgress = Array.isArray(progress) ? progress.filter((item): item is ReadingProgress => Boolean(item && typeof item === 'object' && typeof item.workId === 'string' && Array.isArray(item.completedUnitIds))) : [];
  const unitWorkById = new Map(safeUnits.filter((unit): unit is ReadingUnit => Boolean(unit && typeof unit === 'object' && typeof unit.id === 'string' && typeof unit.workId === 'string')).map(unit => [unit.id, unit.workId]));
  const workCounts = new Map<string, number>();
  for (const item of safeProgress) workCounts.set(item.workId, (workCounts.get(item.workId) ?? 0) + 1);
  const totalCompleted = safeProgress.filter(item => workCounts.get(item.workId) === 1).reduce((total, item) => total + new Set(item.completedUnitIds.filter(id => unitWorkById.get(id) === item.workId)).size, 0);
  return safeAchievements.map(achievement => {
    const countSatisfied = achievement.requiredCompletedUnits === undefined || totalCompleted >= achievement.requiredCompletedUnits;
    const completionSatisfied = !achievement.requiresNarrativeCompletion || Boolean(achievement.workId && isNarrativeWorkComplete(achievement.workId, safeUnits, safeProgress));
    return { achievement, unlocked: countSatisfied && completionSatisfied };
  });
}

export function selectVisibleRosharAchievements(
  projections: readonly RosharAchievementProjection[],
  progress: readonly ReadingProgress[],
  persistentlyUnlockedAchievementIds: readonly string[] = []
): RosharAchievementPresentation[] {
  const safeProjections = Array.isArray(projections) ? projections : [];
  const safeProgress = Array.isArray(progress) ? progress.filter((item): item is ReadingProgress => Boolean(item && typeof item === 'object' && typeof item.workId === 'string' && Array.isArray(item.completedUnitIds))) : [];
  const safePersistentIds = Array.isArray(persistentlyUnlockedAchievementIds) ? persistentlyUnlockedAchievementIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map(id => id.trim()) : [];
  const workCounts = new Map<string, number>();
  for (const item of safeProgress) workCounts.set(item.workId, (workCounts.get(item.workId) ?? 0) + 1);
  const completedUnitIds = new Set(safeProgress.filter(item => workCounts.get(item.workId) === 1 && getUnambiguousReadingProgress(safeProgress, item.workId)).flatMap(item => item.completedUnitIds));
  const persistentIds = new Set(safePersistentIds);
  const seen = new Set<string>();

  return safeProjections.filter((projection): projection is RosharAchievementProjection => {
    if (!projection || typeof projection !== 'object' || typeof projection.unlocked !== 'boolean' || !isValidAchievement(projection.achievement)) return false;
    const id = projection.achievement.id.trim();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map(({ achievement, unlocked: currentlyUnlocked }) => {
    const id = achievement.id.trim();
    const unlocked = currentlyUnlocked || persistentIds.has(id);
    const hiddenUntilUnlocked = achievement.hiddenUntilUnlocked === true;
    const gateVisible = !achievement.spoilerGate || isSpoilerGateSatisfied(achievement.spoilerGate, completedUnitIds, ROSHAR_READING_UNIT_WORK_BY_ID);
    const hidden = !unlocked && (hiddenUntilUnlocked || !gateVisible);
    return hidden
      ? { id, title: '???', description: 'Logro aún oculto.', hidden: true, unlocked }
      : { id, title: achievement.title, description: achievement.description, hidden: false, unlocked, ...(unlocked ? { reward: achievement.reward } : {}) };
  });
}

export function selectUnlockedRosharRewardIds(
  projections: readonly RosharAchievementProjection[]
): string[] {
  const safeProjections = Array.isArray(projections) ? projections : [];
  return Array.from(new Set(safeProjections.filter((item): item is RosharAchievementProjection => Boolean(item && typeof item === 'object' && item.unlocked && item.achievement && item.achievement.reward && typeof item.achievement.reward.id === 'string' && item.achievement.reward.id.trim().length > 0)).map(item => item.achievement.reward.id.trim())));
}
