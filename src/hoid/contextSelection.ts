/**
 * Traceable, spoiler-safe context selection.
 * Catalog metadata is never narrative evidence.
 */

export type HoidSourcePosition = {
  sourceId: string;
  bookId: string;
  chapter: number;
};

export type HoidEvidence = HoidSourcePosition & {
  evidenceId: string;
  summary: string;
};

export type HoidProgress = {
  bookId: string;
  chapter: number;
};

export type ContextSelection = {
  allowed: readonly HoidEvidence[];
  rejected: readonly HoidEvidence[];
};

/**
 * Selects only evidence at or before the reader's declared chapter in the
 * same book. Unknown books and future chapters fail closed.
 */
export function selectSafeContext(
  progress: readonly HoidProgress[],
  evidence: readonly HoidEvidence[],
): ContextSelection {
  const progressByBook = new Map(progress.map((item) => [item.bookId, item.chapter]));
  const allowed: HoidEvidence[] = [];
  const rejected: HoidEvidence[] = [];

  for (const item of evidence) {
    const reached = progressByBook.get(item.bookId);
    if (
      !Number.isInteger(item.chapter) ||
      item.chapter < 1 ||
      reached === undefined ||
      item.chapter > reached ||
      item.summary.trim().length === 0
    ) {
      rejected.push(item);
    } else {
      allowed.push(item);
    }
  }

  return {
    allowed: Object.freeze([...allowed]),
    rejected: Object.freeze([...rejected]),
  };
}
