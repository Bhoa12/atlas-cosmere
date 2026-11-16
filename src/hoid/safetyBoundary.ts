/**
 * Hoid IA narrative safety boundary.
 *
 * This module intentionally knows nothing about an LLM provider or EPUB text.
 * It authorizes only caller-supplied metadata and original summaries.
 */

export type HoidIntent = "explain" | "recommend";

export interface ReadingProgress {
  bookId: string;
  chapter: number;
}

export interface Evidence {
  id: string;
  bookId: string;
  chapter: number;
  accessible: boolean;
  /** Original project-authored summary, never copied source text. */
  summary: string;
}

export type SafetyResult =
  | { ok: true; context: { bookId: string; maxChapter: number; evidence: Evidence[] } }
  | { ok: false; reason: "invalid-progress" | "no-authorized-evidence" };

const validId = (value: string) => value.trim().length > 0;
const validChapter = (value: number) => Number.isInteger(value) && value > 0;

export function authorizeContext(
  progress: ReadingProgress,
  evidence: readonly Evidence[],
): SafetyResult {
  if (!validId(progress.bookId) || !validChapter(progress.chapter)) {
    return { ok: false, reason: "invalid-progress" };
  }

  const allowed = evidence.filter((item) =>
    validId(item.id) &&
    validId(item.bookId) &&
    validChapter(item.chapter) &&
    item.accessible === true &&
    item.summary.trim().length > 0 &&
    item.bookId === progress.bookId &&
    item.chapter <= progress.chapter,
  );

  if (allowed.length === 0) {
    return { ok: false, reason: "no-authorized-evidence" };
  }

  return {
    ok: true,
    context: {
      bookId: progress.bookId,
      maxChapter: progress.chapter,
      evidence: allowed.map((item) => ({ ...item })),
    },
  };
}
