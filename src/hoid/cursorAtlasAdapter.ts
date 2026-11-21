import {
  validateHoidCursorProgressSnapshot,
  type HoidCursorProgressSnapshot,
} from "./cursorProgressLedger";

/**
 * Read-only compatibility projection for Atlas and Community UI components.
 *
 * chaptersByBook preserves the currently open chapter so the Community spoiler
 * shield can apply its exclusive N-1 boundary. The v2 snapshot remains
 * authoritative; this projection must never unlock Hoid narrative evidence.
 */
export type AtlasCursorProgressProjection =
  | Readonly<{
      status: "ready";
      snapshot: HoidCursorProgressSnapshot;
      /** Current/open chapter for UI display and community spoiler shielding only. */
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
    // manifest. Preserve N for the Community screen, whose boundary helper
    // exposes only chapters strictly before N. Never use this display map as
    // Hoid's evidence authorization position; that comes from the v2 boundary.
    chapters[position.bookId] = position.cursor.chapterNumber;
  }

  return Object.freeze({
    status: "ready",
    snapshot: validation.snapshot,
    chaptersByBook: Object.freeze(chapters),
    completedByBook: Object.freeze(completed),
  });
}
