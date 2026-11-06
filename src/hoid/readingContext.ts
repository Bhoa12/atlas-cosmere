import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { ReadingPosition } from "./types";

/**
 * Provider-neutral, metadata-only reading context.
 *
 * This deliberately contains no plot facts. It gives Hoid a canonical summary
 * of what the reader has explicitly reported, so future response adapters do
 * not need to interpret raw progress independently.
 */
export type HoidReadingContextItem = {
  bookId: string;
  chapter: number;
  completed: boolean;
};

function isKnownBook(bookId: string): boolean {
  return HOID_SOURCE_BIBLIOGRAPHY.some(source => source.id === bookId);
}

/**
 * Canonicalizes reading state conservatively:
 * - unknown sources are ignored;
 * - non-finite and negative chapters become 0;
 * - duplicate positions collapse to the greatest reported chapter;
 * - completion is monotonic.
 */
export function buildReadingContext(
  reading: ReadingPosition[],
): readonly Readonly<HoidReadingContextItem>[] {
  const byBook = new Map<string, HoidReadingContextItem>();

  for (const position of reading) {
    if (!isKnownBook(position.bookId)) continue;
    const chapter = Number.isFinite(position.chapter)
      ? Math.max(0, Math.floor(position.chapter ?? 0))
      : 0;
    const previous = byBook.get(position.bookId);
    byBook.set(position.bookId, {
      bookId: position.bookId,
      chapter: Math.max(previous?.chapter ?? 0, chapter),
      completed: Boolean(previous?.completed || position.completed),
    });
  }

  // Return an immutable snapshot so downstream adapters cannot mutate the
  // canonicalized reading state after authorization decisions are made.
  return Object.freeze(
    [...byBook.values()].map(item => Object.freeze({ ...item })),
  );
}
