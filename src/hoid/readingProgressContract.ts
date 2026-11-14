/**
 * Hoid IA — progress boundary contract.
 *
 * The catalogue of books is metadata only. Narrative context is authorized
 * exclusively when the reader has explicitly declared progress in that book.
 */
export type BookProgress = Readonly<{
  bookId: string;
  chapter: number;
}>;

export type NarrativeScope = Readonly<{
  bookId: string;
  chapter: number;
}>;

export type ScopeDecision =
  | Readonly<{ allowed: true }>
  | Readonly<{ allowed: false; reason: "invalid-progress" | "not-reached" | "unknown-book" }>;

export function buildProgressIndex(progress: readonly BookProgress[]): ReadonlyMap<string, number> {
  const index = new Map<string, number>();
  for (const entry of progress) {
    if (!entry.bookId.trim() || !Number.isInteger(entry.chapter) || entry.chapter < 0) {
      throw new Error("Invalid reading progress");
    }
    index.set(entry.bookId, Math.max(index.get(entry.bookId) ?? -1, entry.chapter));
  }
  return index;
}

/** Fail closed: missing progress never authorizes narrative context. */
export function authorizeScope(
  scope: NarrativeScope,
  progress: ReadonlyMap<string, number>,
): ScopeDecision {
  if (!scope.bookId.trim() || !Number.isInteger(scope.chapter) || scope.chapter < 0) {
    return { allowed: false, reason: "invalid-progress" };
  }
  const reached = progress.get(scope.bookId);
  if (reached === undefined) return { allowed: false, reason: "unknown-book" };
  if (scope.chapter > reached) return { allowed: false, reason: "not-reached" };
  return { allowed: true };
}
