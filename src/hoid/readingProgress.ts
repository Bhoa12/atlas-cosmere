/**
 * Hoid IA — explicit reader progress contract.
 *
 * Progress is untrusted input. This module never infers progress from a
 * question or from the source catalogue: each book boundary must be supplied
 * explicitly and is normalized conservatively.
 */

export type ReadingProgress = Readonly<{
  bookId: string;
  chapter: number;
}>;

export type ProgressResult =
  | Readonly<{ kind: "accepted"; progress: ReadingProgress }>
  | Readonly<{ kind: "rejected"; reason: string }>;

const normalizeBookId = (value: string): string => value.trim().toLowerCase();

export function validateProgress(
  input: { bookId?: unknown; chapter?: unknown },
  knownBookIds: readonly string[],
): ProgressResult {
  if (typeof input.bookId !== "string") {
    return { kind: "rejected", reason: "book_id_required" };
  }

  const bookId = normalizeBookId(input.bookId);
  if (!bookId || !knownBookIds.map(normalizeBookId).includes(bookId)) {
    return { kind: "rejected", reason: "unknown_book" };
  }

  if (
    typeof input.chapter !== "number" ||
    !Number.isSafeInteger(input.chapter) ||
    input.chapter < 1
  ) {
    return { kind: "rejected", reason: "invalid_chapter" };
  }

  return { kind: "accepted", progress: { bookId, chapter: input.chapter } };
}

export function isWithinProgress(
  progress: ReadingProgress,
  evidence: { bookId: string; chapter: number },
): boolean {
  return (
    normalizeBookId(evidence.bookId) === progress.bookId &&
    Number.isSafeInteger(evidence.chapter) &&
    evidence.chapter >= 1 &&
    evidence.chapter <= progress.chapter
  );
}
