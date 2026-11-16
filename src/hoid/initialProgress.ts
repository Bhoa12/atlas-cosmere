/**
 * Safe initial reading state for a fresh Atlas installation.
 *
 * Reading progress is authorization data, not demo content. A new profile
 * must start with no completed books and no chapter positions; sample/demo
 * progress belongs in a separate UI-only fixture and must never enter Hoid.
 */
export type AtlasInitialReadingProgress = Readonly<{
  chaptersByBook: Record<string, number>;
  completedByBook: Record<string, boolean>;
}>;

export function createEmptyAtlasReadingProgress(): AtlasInitialReadingProgress {
  return Object.freeze({
    chaptersByBook: Object.create(null) as Record<string, number>,
    completedByBook: Object.create(null) as Record<string, boolean>,
  });
}
