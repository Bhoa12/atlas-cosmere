import { RosharAchievementState, createEmptyRosharAchievementState, sanitizeRosharAchievementState } from './achievementState';
import { AsyncKeyValueStorage } from './progressStorage';

export const ROSHAR_ACHIEVEMENT_STORAGE_KEY = '@atlas-cosmere/roshar-achievements-v1';
export const ROSHAR_ACHIEVEMENT_STORAGE_VERSION = 1;

export type RosharAchievementLoadStatus = 'loaded' | 'empty' | 'invalid' | 'unavailable';

export interface RosharAchievementLoadResult {
  state: RosharAchievementState;
  status: RosharAchievementLoadStatus;
}

/** Reads only the versioned Roshar achievement key and never mutates progress state. */
export async function loadRosharAchievementState(
  storage: AsyncKeyValueStorage,
  updatedAt: string
): Promise<RosharAchievementLoadResult> {
  try {
    const serialized = await storage.getItem(ROSHAR_ACHIEVEMENT_STORAGE_KEY);
    if (serialized === null) return { state: createEmptyRosharAchievementState(updatedAt), status: 'empty' };
    let parsed: unknown;
    try { parsed = JSON.parse(serialized); } catch {
      return { state: createEmptyRosharAchievementState(updatedAt), status: 'invalid' };
    }
    if (!parsed || typeof parsed !== 'object' ||
      (parsed as { version?: unknown }).version !== ROSHAR_ACHIEVEMENT_STORAGE_VERSION ||
      !('state' in (parsed as object))) {
      return { state: createEmptyRosharAchievementState(updatedAt), status: 'invalid' };
    }
    return {
      state: sanitizeRosharAchievementState((parsed as { state: unknown }).state, updatedAt),
      status: 'loaded'
    };
  } catch {
    return { state: createEmptyRosharAchievementState(updatedAt), status: 'unavailable' };
  }
}

/** Writes sanitized achievement state; failure leaves caller-owned memory untouched. */
export async function saveRosharAchievementState(
  storage: AsyncKeyValueStorage,
  state: RosharAchievementState,
  updatedAt: string
): Promise<boolean> {
  const safeState = sanitizeRosharAchievementState(state, updatedAt);
  try {
    await storage.setItem(ROSHAR_ACHIEVEMENT_STORAGE_KEY, JSON.stringify({
      version: ROSHAR_ACHIEVEMENT_STORAGE_VERSION,
      state: safeState
    }));
    return true;
  } catch {
    return false;
  }
}
