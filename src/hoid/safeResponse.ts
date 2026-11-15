import { Abstention, abstain } from "./abstention";

export type SafeAnswer = {
  kind: "answer";
  text: string;
  evidenceIds: string[];
  bookId: string;
  maxChapter: number;
};

export type SafeResponse = SafeAnswer | Abstention;

/**
 * Final response boundary. Narrative output is accepted only when it stays
 * inside the already-authorized book/chapter scope and declares provenance.
 * This function deliberately does not call a model or retrieve source text.
 */
export function finalizeAnswer(candidate: SafeAnswer): SafeResponse {
  const text = candidate.text.trim();
  const evidenceIds = [...new Set(candidate.evidenceIds.filter(Boolean))];

  if (!candidate.bookId.trim() || !Number.isInteger(candidate.maxChapter) || candidate.maxChapter < 1) {
    return abstain("invalid_scope");
  }

  if (!text || evidenceIds.length === 0) {
    return abstain("unverifiable_answer");
  }

  return { ...candidate, text, evidenceIds };
}
