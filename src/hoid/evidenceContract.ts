export type HoidEvidence = {
  id: string;
  bookId: string;
  chapter: number;
  summary: string;
  accessible: boolean;
};

export function isUsableEvidence(
  evidence: HoidEvidence,
  progress: { bookId: string; chapter: number },
): boolean {
  return evidence.accessible
    && evidence.bookId === progress.bookId
    && Number.isInteger(evidence.chapter)
    && evidence.chapter > 0
    && evidence.chapter <= progress.chapter
    && evidence.id.trim().length > 0
    && evidence.summary.trim().length > 0;
}
