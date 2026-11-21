import {
  validateHoidCursorProgressSnapshot,
  type HoidCursorProgressSnapshot,
} from "./cursorProgressLedger";
import {
  projectHoidCursorPositionToBoundary,
  type HoidReaderBoundary,
} from "./readingBoundary";

/**
 * Read-only compatibility projection for Atlas and Community UI components.
 *
 * chaptersByBook preserves the currently open chapter for display.
 * communityBoundariesByBook is the only supported input for Community spoiler
 * authorization. Neither projection may authorize Hoid narrative evidence.
 */
export type AtlasCursorProgressProjection =
  | Readonly<{
      status: "ready";
      snapshot: HoidCursorProgressSnapshot;
      chaptersByBook: Readonly<Record<string, number>>;
      completedByBook: Readonly<Record<string, true>>;
      communityBoundariesByBook: Readonly<Record<string, HoidReaderBoundary>>;
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
  const communityBoundaries = Object.create(null) as Record<string, HoidReaderBoundary>;

  for (const position of validation.snapshot.positions) {
    const projection = projectHoidCursorPositionToBoundary(position);
    if (projection === null) {
      return Object.freeze({ status: "unavailable", reason: "cursor-unavailable" });
    }

    communityBoundaries[position.bookId] = projection.boundary;
    if (projection.boundary.kind === "completed") {
      completed[position.bookId] = true;
    } else {
      chapters[position.bookId] = projection.boundary.currentChapter;
    }
  }

  return Object.freeze({
    status: "ready",
    snapshot: validation.snapshot,
    chaptersByBook: Object.freeze(chapters),
    completedByBook: Object.freeze(completed),
    communityBoundariesByBook: Object.freeze(communityBoundaries),
  });
}
