import {
  validateHoidCursorProgressSnapshot,
  type HoidCursorProgressSnapshot,
} from "./cursorProgressLedger";

/**
 * Read-only compatibility projection for Atlas UI components that display the
 * chapter currently open in each work.
 *
 * The v2 cursor is authoritative. Its chapterNumber is the reader's current
 * open chapter, so this display projection preserves N exactly. It must never
 * be used as the completed-through position for spoiler authorization:
 * cursorToLegacyReadingPosition deliberately maps N to N-1 for that purpose.
 */
export type AtlasCursorProgressProjection =
  | Readonly<{
      status: "ready";
      snapshot: HoidCursorProgressSnapshot;
      /** Current/open chapter for display only; never an authorization cursor. */
      chaptersByBook: Readonly<Record<string, number>>;
      completedByBook: Readonly<Record<string, true>>;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-snapshot" | "cursor-unavailable";
    }>;

export function atlasProgressFromCursorSnapshot(
  value: unknown,
): AtlasCursorProgressProjection {
  const validation = validateHoidCursorProgressSnapshot(value);
  if (validation.status !== "valid") {
    return Object.freeze({ status: "unavailable", reason: "invalid-snapshot" });
  }

  const chapters = Object.create(null) as Record<string, number>;
  const completed = Object.create(null) as Record<string, true>;

  for (const position of validation.snapshot.positions) {
    if ("completed" in position) {
      completed[position.bookId] = true;
      continue;
    }

    // Snapshot validation has already bound this cursor to its exact edition
    // manifest. Preserve the open chapter for Atlas display; do not project
    // through the legacy completed-through helper (which intentionally yields
    // N-1 and null for chapter 1).
    chapters[position.bookId] = position.cursor.chapterNumber;
  }

  return Object.freeze({
    status: "ready",
    snapshot: validation.snapshot,
    chaptersByBook: Object.freeze(chapters),
    completedByBook: Object.freeze(completed),
  });
}
