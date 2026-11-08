import { ReadingPosition } from "./types";

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

  const positions: ReadingPosition[] = [];
  const seenBookIds = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const bookId = typeof candidate.bookId === "string" ? candidate.bookId.trim() : "";
    if (!bookId) continue;

    const chapter = candidate.chapter;
    const validChapter = typeof chapter === "number" && Number.isFinite(chapter) && chapter >= 0 && Number.isInteger(chapter)
      ? chapter
      : undefined;
    const completed = candidate.completed === true;

    // A position without either a valid chapter or explicit completion cannot
    // grant authorization. Ignore it instead of coercing it to a chapter.
    if (validChapter === undefined && !completed) continue;

    // Multiple valid positions for the same book are ambiguous. Never merge
    // them toward the greatest progress because an untrusted duplicate could
    // otherwise unlock more narrative knowledge.
    if (seenBookIds.has(bookId)) return null;
    seenBookIds.add(bookId);

    // Keep the canonical series order when it is a valid non-negative integer.
    // It is metadata only: authorization still depends on the catalog and never
    // on the caller array position.
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
