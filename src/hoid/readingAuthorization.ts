import { HoidKnowledgeCatalog, HoidKnowledgeEntry } from "./catalog";
import { ReadingPosition } from "./types";

/**
 * Conservative authorization for catalog knowledge.
 *
 * Invalid or ambiguous progress never grants access. Multiple positions for the
 * same book are reduced to the greatest valid chapter; completion is accepted
 * only for the exact book being evaluated.
 */
export function normalizeReadingPositions(reading: ReadingPosition[]): ReadingPosition[] {
  const byBook = new Map<string, ReadingPosition>();

  for (const item of reading) {
    const bookId = item.bookId?.trim();
    if (!bookId) continue;

    const chapter = item.chapter;
    const validChapter = typeof chapter === "number" && Number.isFinite(chapter) && chapter >= 0
      ? chapter
      : undefined;
    const completed = item.completed === true;

    if (!completed && validChapter === undefined) continue;

    const previous = byBook.get(bookId);
    byBook.set(bookId, {
      bookId,
      chapter: Math.max(previous?.chapter ?? 0, validChapter ?? 0),
      completed: previous?.completed === true || completed,
    });
  }

  return [...byBook.values()];
}

export function isKnowledgeUnlocked(
  entry: HoidKnowledgeEntry,
  reading: ReadingPosition[],
): boolean {
  return new HoidKnowledgeCatalog([entry]).isUnlocked(
    entry,
    normalizeReadingPositions(reading),
  );
}
