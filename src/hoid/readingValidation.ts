import { ReadingPosition } from "./types";

/**
 * Runtime trust boundary for reader progress.
 *
 * Progress normally comes from application state, but Hoid treats it as
 * untrusted at its public boundary. Malformed entries are discarded rather
 * than repaired, so bad runtime data can never unlock narrative knowledge.
 */
export function validReadingPositions(value: unknown): ReadingPosition[] | null {
  if (!Array.isArray(value)) return null;

  const positions: ReadingPosition[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const bookId = typeof candidate.bookId === "string" ? candidate.bookId.trim() : "";
    if (!bookId) continue;

    const chapter = candidate.chapter;
    const validChapter = typeof chapter === "number" && Number.isFinite(chapter) && chapter >= 0
      ? chapter
      : undefined;
    const completed = candidate.completed === true;

    // A position without either a valid chapter or explicit completion cannot
    // grant authorization. Ignore it instead of coercing it to a chapter.
    if (validChapter === undefined && !completed) continue;

    positions.push({
      bookId,
      ...(validChapter === undefined ? {} : { chapter: validChapter }),
      ...(completed ? { completed: true } : {}),
    });
  }

  return positions;
}
