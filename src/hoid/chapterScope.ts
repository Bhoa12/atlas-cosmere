export type ChapterPoint = {
  bookId: string;
  chapter: number;
};

export type ChapterRange = {
  bookId: string;
  firstChapter: number;
  lastChapter: number;
};

export type ScopeDecision =
  | { allowed: true; reason: "within-reading-progress" }
  | { allowed: false; reason: "missing-book" | "invalid-chapter" | "cross-book" | "future-chapter" };

/**
 * Pure, provider-independent spoiler boundary.
 * A source is usable only when it belongs to the same book and does not exceed
 * the reader's declared chapter. Unknown or malformed values fail closed.
 */
export function authorizeChapter(
  requestedBookId: string,
  candidate: ChapterPoint,
  progress: ChapterRange,
): ScopeDecision {
  if (!requestedBookId.trim() || !candidate.bookId.trim() || !progress.bookId.trim()) {
    return { allowed: false, reason: "missing-book" };
  }

  if (!Number.isInteger(candidate.chapter) || candidate.chapter < 1 ||
      !Number.isInteger(progress.firstChapter) || progress.firstChapter < 1 ||
      !Number.isInteger(progress.lastChapter) || progress.lastChapter < progress.firstChapter) {
    return { allowed: false, reason: "invalid-chapter" };
  }

  if (requestedBookId !== candidate.bookId || requestedBookId !== progress.bookId) {
    return { allowed: false, reason: "cross-book" };
  }

  if (candidate.chapter > progress.lastChapter) {
    return { allowed: false, reason: "future-chapter" };
  }

  return { allowed: true, reason: "within-reading-progress" };
}
