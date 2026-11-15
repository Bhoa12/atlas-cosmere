/**
 * Hoid IA: boundary for safe cross-book requests.
 *
 * A reader may have progress in several books, but a narrative request is
 * intentionally scoped to one explicit book. This prevents accidental
 * cross-book context expansion and therefore spoiler leakage.
 */

export type BookProgress = Readonly<Record<string, number>>;

export interface NarrativeScopeRequest {
  readonly bookId?: string;
  readonly chapter?: number;
}

export type ScopeDecision =
  | {
      readonly allowed: true;
      readonly bookId: string;
      readonly maxChapter: number;
    }
  | {
      readonly allowed: false;
      readonly reason:
        | "missing-book"
        | "unknown-book"
        | "invalid-progress"
        | "future-chapter";
    };

export function resolveNarrativeScope(
  request: NarrativeScopeRequest,
  progress: BookProgress,
): ScopeDecision {
  const bookId = request.bookId?.trim();

  if (!bookId) {
    return { allowed: false, reason: "missing-book" };
  }

  const maxChapter = progress[bookId];
  if (!Number.isInteger(maxChapter) || maxChapter < 1) {
    return {
      allowed: false,
      reason: Object.prototype.hasOwnProperty.call(progress, bookId)
        ? "invalid-progress"
        : "unknown-book",
    };
  }

  if (
    request.chapter !== undefined &&
    (!Number.isInteger(request.chapter) || request.chapter < 1 || request.chapter > maxChapter)
  ) {
    return { allowed: false, reason: "future-chapter" };
  }

  return { allowed: true, bookId, maxChapter };
}
