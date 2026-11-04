import { ReadingProgress } from './model';
import { sanitizeReadingProgress } from './progress';

export const READING_PROGRESS_STORAGE_KEY = '@atlas-cosmere/reading-progress-v2';
export const READING_PROGRESS_SCHEMA_VERSION = 2;

export interface AsyncKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export type ReadingProgressLoadStatus = 'loaded' | 'empty' | 'invalid' | 'unavailable';

export interface ReadingProgressLoadResult {
  progress: ReadingProgress[];
  status: ReadingProgressLoadStatus;
}

/**
 * Reads only the v2 granular key. It never consumes, overwrites or deletes state-v1.
 */
export async function loadReadingProgress(
  storage: AsyncKeyValueStorage,
  workIds: readonly string[],
  unitWorkById: ReadonlyMap<string, string>,
  updatedAt: string
): Promise<ReadingProgressLoadResult> {
  try {
    const serialized = await storage.getItem(READING_PROGRESS_STORAGE_KEY);
    if (serialized === null) {
      return { progress: sanitizeReadingProgress(null, workIds, unitWorkById, updatedAt), status: 'empty' };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      return { progress: sanitizeReadingProgress(null, workIds, unitWorkById, updatedAt), status: 'invalid' };
    }
    if (!parsed || typeof parsed !== 'object' ||
        (parsed as { version?: unknown }).version !== READING_PROGRESS_SCHEMA_VERSION ||
        !Array.isArray((parsed as { progress?: unknown }).progress)) {
      return { progress: sanitizeReadingProgress(null, workIds, unitWorkById, updatedAt), status: 'invalid' };
    }
    return {
      progress: sanitizeReadingProgress(
        (parsed as { progress: unknown }).progress,
        workIds,
        unitWorkById,
        updatedAt
      ),
      status: 'loaded'
    };
  } catch {
    return { progress: sanitizeReadingProgress(null, workIds, unitWorkById, updatedAt), status: 'unavailable' };
  }
}

/** Writes only the v2 key after sanitizing; callers retain their in-memory state on failure. */
export async function saveReadingProgress(
  storage: AsyncKeyValueStorage,
  progress: ReadingProgress[],
  workIds: readonly string[],
  unitWorkById: ReadonlyMap<string, string>,
  updatedAt: string
): Promise<boolean> {
  const safeProgress = sanitizeReadingProgress(progress, workIds, unitWorkById, updatedAt);
  try {
    await storage.setItem(READING_PROGRESS_STORAGE_KEY, JSON.stringify({
      version: READING_PROGRESS_SCHEMA_VERSION,
      progress: safeProgress
    }));
    return true;
  } catch {
    return false;
  }
}
