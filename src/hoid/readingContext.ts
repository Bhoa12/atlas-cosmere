import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { validReadingPositions } from "./readingValidation";
import { ReadingPosition } from "./types";

/**
 * Provider-neutral, metadata-only reading context.
 *
 * This deliberately contains no plot facts. It gives Hoid a canonical summary
 * of what the reader has explicitly reported, so future response adapters do
 * not need to interpret raw progress independently.
 *
 * The same validation boundary used by authorization is applied here. Context
 * must not merge duplicate or malformed positions into greater progress,
 * because this function is also used by the spoiler guard and provider
 * snapshots.
 */
export type HoidReadingContextItem = {
  bookId: string;
  chapter: number;
  completed: boolean;
};

function isKnownBook(bookId: string): boolean {
  return HOID_SOURCE_BIBLIOGRAPHY.some(source => source.id === bookId);
}

export function buildReadingContext(
  reading: ReadingPosition[],
): readonly Readonly<HoidReadingContextItem>[] {
  const validated = validReadingPositions(reading);
  if (!validated) return Object.freeze([]);

  const context = validated
    .filter(position => isKnownBook(position.bookId))
    .map(position => Object.freeze({
      bookId: position.bookId,
      chapter: position.chapter ?? 0,
      completed: position.completed === true,
    }));

  return Object.freeze(context);
}
