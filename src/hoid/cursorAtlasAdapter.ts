import {
  validateHoidCursorProgressSnapshot,
  type HoidCursorProgressSnapshot,
} from "./cursorProgressLedger";
import { cursorToLegacyReadingPosition } from "./readingManifest";

/**
 * Read-only compatibility projection for Atlas UI components that still
 * display numeric chapter counters. The v2 snapshot remains authoritative;
 * these maps must never be used as the source of Hoid's spoiler authorization.
 */
export type AtlasCursorProgressProjection =
  | Readonly<{
      status: "ready";
      snapshot: HoidCursorProgressSnapshot;
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

    const legacy = cursorToLegacyReadingPosition(position.cursor);
    if (
      legacy === null ||
      legacy.bookId !== position.bookId ||
      typeof legacy.chapter !== "number"
    ) {
      return Object.freeze({ status: "unavailable", reason: "cursor-unavailable" });
    }
    chapters[position.bookId] = legacy.chapter;
  }

  return Object.freeze({
    status: "ready",
    snapshot: validation.snapshot,
    chaptersByBook: Object.freeze(chapters),
    completedByBook: Object.freeze(completed),
  });
}
