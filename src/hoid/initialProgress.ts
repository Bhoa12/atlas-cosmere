import type { HoidReaderBoundary } from "./readingBoundary";

/**
 * Safe initial reading state for a fresh Atlas installation.
 *
 * Reading progress is authorization data, not demo content. A new profile
 * must start with no completed books, no chapter positions and no community
 * spoiler boundaries; sample/demo progress belongs in a separate UI-only
 * fixture and must never enter Hoid.
 */
export type AtlasInitialReadingProgress = Readonly<{
  chaptersByBook: Readonly<Record<string, number>>;
  completedByBook: Readonly<Record<string, boolean>>;
  communityBoundariesByBook: Readonly<Record<string, HoidReaderBoundary>>;
}>;

export function createEmptyAtlasReadingProgress(): AtlasInitialReadingProgress {
  return Object.freeze({
    chaptersByBook: Object.freeze(Object.create(null) as Record<string, number>),
    completedByBook: Object.freeze(Object.create(null) as Record<string, boolean>),
    communityBoundariesByBook: Object.freeze(
      Object.create(null) as Record<string, HoidReaderBoundary>,
    ),
  });
}
