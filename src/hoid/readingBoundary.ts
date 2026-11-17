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

const POSITION_KEYS = new Set(["bookId", "cursor", "completed", "order"]);
const MAX_ORDER = 1_000_000;

function canonicalPosition(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !POSITION_KEYS.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }

    if (!Object.prototype.hasOwnProperty.call(result, "bookId")) return null;
    const hasCursor = Object.prototype.hasOwnProperty.call(result, "cursor");
    const hasCompleted = Object.prototype.hasOwnProperty.call(result, "completed");
    if (hasCursor === hasCompleted) return null;
    if (hasCompleted && result.completed !== true) return null;
    if (
      Object.prototype.hasOwnProperty.call(result, "order") &&
      (typeof result.order !== "number" ||
        !Number.isSafeInteger(result.order) ||
        result.order < 0 ||
        result.order > MAX_ORDER)
    ) return null;

    return result;
  } catch {
    return null;
  }
}

/**
 * A v2 cursor records the chapter currently open/in progress in Atlas.
 * It does not assert that the reader has finished that chapter.
 *
 * Therefore, chapter N authorizes summaries only through chapter N-1.
 * Explicit completion is the only state that authorizes the entire work.
 * This exclusive boundary prevents a chapter's own summary from appearing
 * while the reader is still on that chapter.
 *
 * This is also a public trust boundary: it canonicalizes own data properties
 * and rejects accessors, inherited values, unknown keys and hostile traps.
 */
export function projectHoidCursorPositionToBoundary(
  position: HoidCursorProgressPosition | unknown,
): HoidCursorBoundaryProjection | null {
  const record = canonicalPosition(position);
  if (record === null) return null;

  const bookId = record.bookId;
  if (
    typeof bookId !== "string" ||
    bookId.length === 0 ||
    bookId !== bookId.trim()
  ) return null;

  const order = record.order as number | undefined;
  if (record.completed === true) {
    const boundary: HoidReaderBoundary = Object.freeze({
      kind: "completed",
      bookId,
      completedThrough: "entire-work",
      ...(order === undefined ? {} : { order }),
    });
    return Object.freeze({
      boundary,
      safeReadingPosition: Object.freeze({
        bookId,
        completed: true,
        ...(order === undefined ? {} : { order }),
      }),
    });
  }

  const validation = validateHoidReadingCursor(record.cursor);
  if (validation.status !== "valid" || validation.cursor.bookId !== bookId) return null;

  const currentChapter = validation.cursor.chapterNumber;
  const completedThroughChapter = currentChapter > 1 ? currentChapter - 1 : null;
  const boundary: HoidReaderBoundary = Object.freeze({
    kind: "in-progress",
    bookId,
    currentChapter,
    completedThroughChapter,
    ...(order === undefined ? {} : { order }),
  });

  return Object.freeze({
    boundary,
    safeReadingPosition: completedThroughChapter === null
      ? null
      : Object.freeze({
          bookId,
          chapter: completedThroughChapter,
          ...(order === undefined ? {} : { order }),
        }),
  });
}
