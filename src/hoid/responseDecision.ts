/**
 * Safe response mode selection for Hoid IA.
 *
 * This module intentionally contains no narrative content. It decides whether
 * the application has enough authorised evidence to answer, must limit the
 * answer, or should abstain. Provider adapters remain outside this policy.
 */

export type HoidResponseMode = "answer" | "limited" | "abstain";

export interface ResponseDecisionInput {
  question: string;
  authorisedEvidenceIds: readonly string[];
  verifiedClaimCount: number;
  rejectedClaimCount?: number;
}

export interface ResponseDecision {
  mode: HoidResponseMode;
  reason:
    | "empty-question"
    | "no-authorised-evidence"
    | "no-verified-claims"
    | "claims-filtered"
    | "verified";
}

/**
 * Chooses the least permissive response mode compatible with verified output.
 *
 * The function is deliberately deterministic and fail-closed: catalogue
 * membership, reading progress and provider confidence are not substitutes for
 * authorised evidence.
 */
export function decideResponseMode(input: ResponseDecisionInput): ResponseDecision {
  if (!input.question.trim()) {
    return { mode: "abstain", reason: "empty-question" };
  }

  if (input.authorisedEvidenceIds.length === 0) {
    return { mode: "abstain", reason: "no-authorised-evidence" };
  }

  if (!Number.isInteger(input.verifiedClaimCount) || input.verifiedClaimCount <= 0) {
    return { mode: "abstain", reason: "no-verified-claims" };
  }

  if ((input.rejectedClaimCount ?? 0) > 0) {
    return { mode: "limited", reason: "claims-filtered" };
  }

  return { mode: "answer", reason: "verified" };
}
