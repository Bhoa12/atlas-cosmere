/**
 * Provider-neutral contracts for Hoid IA.
 *
 * Providers receive only already-authorized context. They never receive a
 * repository handle or mutable reader progress.
 */

export type EvidenceId = string;

export interface AuthorizedContextItem {
  evidenceId: EvidenceId;
  workId: string;
  maxChapter: number;
  summary: string;
}

export interface HoidPrompt {
  question: string;
  context: readonly AuthorizedContextItem[];
  allowedEvidenceIds: readonly EvidenceId[];
}

export interface HoidClaim {
  text: string;
  evidenceIds: readonly EvidenceId[];
}

export interface HoidDraftResponse {
  answer: string;
  claims: readonly HoidClaim[];
}

export interface HoidProvider {
  generate(prompt: HoidPrompt): Promise<HoidDraftResponse>;
}

export interface ClaimVerification {
  accepted: readonly HoidClaim[];
  rejected: readonly HoidClaim[];
}

/**
 * Fails closed: a claim is usable only when it cites at least one allowed
 * evidence identifier and every cited identifier belongs to the request.
 */
export function verifyClaims(
  claims: readonly HoidClaim[],
  allowedEvidenceIds: readonly EvidenceId[],
): ClaimVerification {
  const allowed = new Set(allowedEvidenceIds);
  const accepted: HoidClaim[] = [];
  const rejected: HoidClaim[] = [];

  for (const claim of claims) {
    const ids = [...claim.evidenceIds];
    const valid =
      claim.text.trim().length > 0 &&
      ids.length > 0 &&
      ids.every((id) => allowed.has(id));

    (valid ? accepted : rejected).push({
      text: claim.text,
      evidenceIds: ids,
    });
  }

  return { accepted, rejected };
}
