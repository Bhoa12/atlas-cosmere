import { ReadingPosition } from "./types";

export const DEFAULT_MAX_READING_POSITIONS = 256;
export const DEFAULT_MAX_READING_POSITION_BOOK_ID_LENGTH = 256;

/**
 * Runtime trust boundary for reader progress.
 *
 * Progress normally comes from application state, but Hoid treats it as
 * untrusted at its public boundary. Malformed entries are discarded rather
 * than repaired, so bad runtime data can never unlock narrative knowledge.
 *
 * A book may appear only once. Duplicate positions are ambiguous at this
 * boundary, so the whole reading state is rejected instead of merging toward
 * the greatest chapter.
 */
export function validReadingPositions(value: unknown): ReadingPosition[] | null {
  if (!Array.isArray(value)) return null;

  // A partial prefix would make authorization depend on caller ordering.
  // Oversized progress payloads therefore fail closed as a complete state.
  if (value.length > DEFAULT_MAX_READING_POSITIONS) return null;

  const positions: ReadingPosition[] = [];
  const seenBookIds = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const candidate = item as Record<string, unknown>;
    const rawBookId = typeof candidate.bookId === "string" ? candidate.bookId : "";
    // Bound untrusted identifiers before trimming or normalization-like work.
    // An oversized identifier cannot unlock any knowledge.
    if (rawBookId.length > DEFAULT_MAX_READING_POSITION_BOOK_ID_LENGTH) continue;
    const bookId = rawBookId.trim();
    if (!bookId) continue;

    const chapter = candidate.chapter;
    const validChapter = typeof chapter === "number" && Number.isFinite(chapter) && chapter >= 0 && Number.isInteger(chapter)
      ? chapter
      : undefined;
    const completed = candidate.completed === true;

    if (validChapter === undefined && !completed) continue;

    if (seenBookIds.has(bookId)) return null;
    seenBookIds.add(bookId);

    const order = candidate.order;
    const validOrder = typeof order === "number" && Number.isFinite(order) && order >= 0 && Number.isInteger(order)
      ? order
      : undefined;

    positions.push({
      bookId,
      ...(validChapter === undefined ? {} : { chapter: validChapter }),
      ...(completed ? { completed: true } : {}),
      ...(validOrder === undefined ? {} : { order: validOrder }),
    });
  }

  return positions;
}
