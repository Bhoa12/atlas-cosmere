import { toHoidReadingPositions, type AtlasReadingProgress } from "./progressAdapter";
import {
  createHoidReadingCursor,
  type HoidReadingCursor,
} from "./readingManifest";

export type HoidCursorReadingPosition =
  | Readonly<{ bookId: string; completed: true }>
  | Readonly<{ bookId: string; cursor: HoidReadingCursor }>;

/**
 * Parallel v2 projection of Atlas progress.
 *
 * The existing EvidenceRuntime still consumes ReadingPosition. This adapter
 * introduces edition-bound cursors without silently changing the persisted
 * ledger schema. Migration must be explicit and versioned before these cursors
 * become the authoritative stored progress format.
 */
export function toHoidReadingCursorPositions(
  progress: AtlasReadingProgress,
): readonly HoidCursorReadingPosition[] {
  const legacyPositions = toHoidReadingPositions(progress);
  const result: HoidCursorReadingPosition[] = [];

  for (const position of legacyPositions) {
    if (position.completed === true) {
      result.push(Object.freeze({ bookId: position.bookId, completed: true }));
      continue;
    }

    if (typeof position.chapter !== "number") continue;
    const cursorResult = createHoidReadingCursor(position.bookId, position.chapter);
    if (cursorResult.status !== "ready") continue;

    result.push(Object.freeze({
      bookId: position.bookId,
      cursor: cursorResult.cursor,
    }));
  }

  return Object.freeze(result);
}
