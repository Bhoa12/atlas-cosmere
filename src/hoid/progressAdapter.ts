import { ReadingPosition } from "./types";

/**
 * Minimal, UI-agnostic snapshot of Atlas reading progress.
 * This adapter deliberately depends on plain records so Hoid does not import
 * React context or any screen-specific state.
 */
export type AtlasReadingProgress = {
  chaptersByBook?: Record<string, number | undefined>;
  completedByBook?: Record<string, boolean | undefined>;
};

/**
 * Converts Atlas progress into Hoid's provider-independent contract.
 *
 * Invalid chapter values are omitted rather than coerced upward: when progress
 * is uncertain, downstream authorization remains conservative.
 */
export function toHoidReadingPositions(
  progress: AtlasReadingProgress,
): ReadingPosition[] {
  const ids = new Set([
    ...Object.keys(progress.chaptersByBook ?? {}),
    ...Object.keys(progress.completedByBook ?? {}),
  ]);

  return [...ids]
    .filter(bookId => bookId.trim().length > 0)
    .sort()
    .map(bookId => {
      const rawChapter = progress.chaptersByBook?.[bookId];
      const chapter = typeof rawChapter === "number" &&
        Number.isFinite(rawChapter) &&
        rawChapter >= 0
        ? Math.floor(rawChapter)
        : undefined;
      const completed = progress.completedByBook?.[bookId] === true;

      return {
        bookId,
        ...(chapter !== undefined ? { chapter } : {}),
        ...(completed ? { completed: true } : {}),
      };
    });
}
