/**
 * Hoid IA: explanation safety contract.
 *
 * Explanations may be generated in different styles, but narrative claims must
 * remain inside the immutable knowledge boundary of the request.
 */

import {
  type EvidenceId,
  type KnowledgeBoundary,
  verifyEvidenceReferences,
} from "./knowledgeBoundary";

export interface ExplanationClaim {
  readonly text: string;
  readonly evidenceIds: readonly EvidenceId[];
}

export interface VerifiedExplanation {
  readonly claims: readonly ExplanationClaim[];
  readonly rejected: number;
}

/**
 * Removes unsupported claims instead of asking a downstream renderer to guess.
 * A claim needs non-empty text and at least one authorized evidence reference.
 */
export function verifyExplanation(
  boundary: KnowledgeBoundary,
  claims: readonly ExplanationClaim[],
): VerifiedExplanation {
  const accepted: ExplanationClaim[] = [];
  let rejected = 0;

  for (const claim of claims) {
    if (!claim.text.trim()) {
      rejected++;
      continue;
    }

    const references = verifyEvidenceReferences(boundary, claim.evidenceIds);
    if (references.length === 0 || references.length !== new Set(claim.evidenceIds).size) {
      rejected++;
      continue;
    }

    accepted.push(Object.freeze({
      text: claim.text.trim(),
      evidenceIds: references,
    }));
  }

  return Object.freeze({
    claims: Object.freeze(accepted),
    rejected,
  });
}
