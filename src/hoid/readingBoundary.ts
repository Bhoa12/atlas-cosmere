import { validateHoidReadingCursor } from "./readingManifest";
import type { HoidCursorProgressPosition } from "./cursorProgressLedger";
import type { ReadingPosition } from "./types";

export type HoidReaderBoundary =
  | Readonly<{
      kind: "in-progress";
      bookId: string;
      currentChapter: number;
      /** Last chapter known to be fully finished; null means none. */
      completedThroughChapter: number | null;
      order?: number;
    }>
  | Readonly<{
      kind: "completed";
      bookId: string;
      completedThrough: "entire-work";
      order?: number;
    }>;

export type HoidCursorBoundaryProjection = Readonly<{
  boundary: HoidReaderBoundary;
  /** Null is a valid state when the reader is currently on chapter one. */
  safeReadingPosition: ReadingPosition | null;
}>;

/**
 * A v2 cursor records the chapter currently open/in progress in Atlas.
 * It does not assert that the reader has finished that chapter.
 *
 * Therefore, chapter N authorizes summaries only through chapter N-1.
 * Explicit completion is the only state that authorizes the entire work.
 * This exclusive boundary prevents a chapter's own summary from appearing
 * while the reader is still on that chapter.
 */
export function projectHoidCursorPositionToBoundary(
  position: HoidCursorProgressPosition,
): HoidCursorBoundaryProjection | null {
  if (
    !position ||
    typeof position.bookId !== "string" ||
    position.bookId.length === 0 ||
    position.bookId !== position.bookId.trim() ||
    (position.order !== undefined &&
      (!Number.isSafeInteger(position.order) || position.order < 0 || position.order > 1_000_000))
  ) return null;

  if ("completed" in position) {
    if (position.completed !== true || "cursor" in position) return null;
    const boundary: HoidReaderBoundary = Object.freeze({
      kind: "completed",
      bookId: position.bookId,
      completedThrough: "entire-work",
      ...(position.order === undefined ? {} : { order: position.order }),
    });
    return Object.freeze({
      boundary,
      safeReadingPosition: Object.freeze({
        bookId: position.bookId,
        completed: true,
        ...(position.order === undefined ? {} : { order: position.order }),
      }),
    });
  }

  const validation = validateHoidReadingCursor(position.cursor);
  if (validation.status !== "valid" || validation.cursor.bookId !== position.bookId) return null;

  const currentChapter = validation.cursor.chapterNumber;
  const completedThroughChapter = currentChapter > 1 ? currentChapter - 1 : null;
  const boundary: HoidReaderBoundary = Object.freeze({
    kind: "in-progress",
    bookId: position.bookId,
    currentChapter,
    completedThroughChapter,
    ...(position.order === undefined ? {} : { order: position.order }),
  });

  return Object.freeze({
    boundary,
    safeReadingPosition: completedThroughChapter === null
      ? null
      : Object.freeze({
          bookId: position.bookId,
          chapter: completedThroughChapter,
          ...(position.order === undefined ? {} : { order: position.order }),
        }),
  });
}
