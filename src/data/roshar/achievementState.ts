import { RosharAchievementProjection } from './achievements';

export interface RosharAchievementState {
  unlockedAchievementIds: string[];
  unlockedRewardIds: string[];
  updatedAt: string;
}

/** Creates a persistence-ready state with no granted achievements or rewards. */
export function createEmptyRosharAchievementState(updatedAt: string): RosharAchievementState {
  return { unlockedAchievementIds: [], unlockedRewardIds: [], updatedAt };
}

/**
 * Merges the current deterministic evaluation into persistent achievement state.
 * Unlocks are monotonic: a later progress correction or re-read never revokes a
 * reward that was already granted. IDs are deduplicated and order is stable.
 */
export function applyRosharAchievementProjections(
  state: RosharAchievementState | undefined,
  projections: readonly RosharAchievementProjection[],
  updatedAt: string
): RosharAchievementState {
  const previous = sanitizeRosharAchievementState(state, updatedAt);
  const achievementIds = new Set(previous.unlockedAchievementIds);
  const rewardIds = new Set(previous.unlockedRewardIds);

  for (const projection of Array.isArray(projections) ? projections : []) {
    if (!projection || typeof projection !== 'object' || !projection.unlocked) continue;
    const achievement = projection.achievement;
    if (!achievement || typeof achievement.id !== 'string' || achievement.id.trim().length === 0) continue;
    const reward = achievement.reward;
    if (!reward || typeof reward.id !== 'string' || reward.id.trim().length === 0) continue;
    achievementIds.add(achievement.id.trim());
    rewardIds.add(reward.id.trim());
  }

  return {
    unlockedAchievementIds: Array.from(achievementIds),
    unlockedRewardIds: Array.from(rewardIds),
    updatedAt
  };
}

/** Accepts only the small explicit persistence schema and discards malformed IDs. */
export function sanitizeRosharAchievementState(
  value: unknown,
  updatedAt: string
): RosharAchievementState {
  if (!value || typeof value !== 'object') return createEmptyRosharAchievementState(updatedAt);
  const candidate = value as Partial<RosharAchievementState>;
  const strings = (items: unknown): string[] => Array.isArray(items)
    ? Array.from(new Set(items.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())))
    : [];

  return {
    unlockedAchievementIds: strings(candidate.unlockedAchievementIds),
    unlockedRewardIds: strings(candidate.unlockedRewardIds),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : updatedAt
  };
}
