import { getHoidEditionProgressPolicy } from "./editionStructure";
import { ReadingPosition } from "./types";

/**
 * Minimal, UI-agnostic snapshot of Atlas reading progress.
 * This adapter deliberately depends on plain records so Hoid does not import
 * React context or any screen-specific state.
 */
export type AtlasReadingProgress = {
  chaptersByBook?: Record<string, number | undefined>;
  completedByBook?: Record<string, boolean | undefined>;
};

function ownValue<T>(
  record: Record<string, T | undefined> | undefined,
  key: string,
): T | undefined {
  return record && Object.prototype.hasOwnProperty.call(record, key)
    ? record[key]
    : undefined;
}

/**
 * Converts Atlas progress into Hoid's provider-independent contract.
 *
 * Chapter positions are accepted only when the inspected EPUB navigation
 * provides an unambiguous numeric chapter model. Collections and merged
 * volumes remain completion-only until their sections are mapped. Where a
 * book repeats chapter numbers at distinct locators, numeric progress is
 * capped before the first ambiguous number.
 */
export function toHoidReadingPositions(
  progress: AtlasReadingProgress,
): ReadingPosition[] {
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) return [];

  const ids = new Set([
    ...Object.keys(progress.chaptersByBook ?? {}),
    ...Object.keys(progress.completedByBook ?? {}),
  ]);

  const positions: ReadingPosition[] = [];

  for (const bookId of [...ids].sort()) {
    if (!bookId || bookId !== bookId.trim()) continue;

    const policy = getHoidEditionProgressPolicy(bookId);
    if (policy.kind === "unknown") continue;

    // An explicit user completion is a self-reported reading boundary. Keep
    // it separate from a numeric chapter cursor, which may be ambiguous for
    // some editions. Only own properties count as user-declared progress.
    if (ownValue(progress.completedByBook, bookId) === true) {
      positions.push({ bookId, completed: true });
      continue;
    }

    const rawChapter = ownValue(progress.chaptersByBook, bookId);
    if (typeof rawChapter !== "number" || !Number.isSafeInteger(rawChapter) || rawChapter < 1) {
      continue;
    }

    if (policy.kind === "numeric-chapters" && rawChapter <= policy.chapterCount) {
      positions.push({ bookId, chapter: rawChapter });
      continue;
    }

    if (
      policy.kind === "chapter-number-with-duplicate-locators"
      && rawChapter <= policy.safeNumericProgressThroughChapter
    ) {
      positions.push({ bookId, chapter: rawChapter });
    }
  }

  return positions;
}
