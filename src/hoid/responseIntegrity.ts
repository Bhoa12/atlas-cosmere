/**
 * Output-integrity gate for Hoid IA.
 *
 * Evidence identifiers validate claims, but they do not automatically prove that
 * every sentence in the provider's free-form answer is represented by a claim.
 * This gate closes that gap by allowing narrative output only when the answer is
 * composed entirely from the accepted claim texts for the same response.
 */
import {
  type ProviderResponse,
  type VerifiedProviderResponse,
} from "./providerContract";

function canonical(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/**
 * Returns true only when every claim survived evidence verification and the
 * visible answer is exactly the ordered composition of those claims.
 *
 * This intentionally rejects decorative or inferred prose. Presentation layers
 * may add non-narrative UI chrome outside this contract, but the provider cannot
 * smuggle additional narrative text into the answer.
 */
export function hasVerifiedAnswerIntegrity(
  response: ProviderResponse,
  verified: VerifiedProviderResponse,
): boolean {
  if (verified.rejectedClaims > 0 || verified.acceptedClaims.length === 0) {
    return false;
  }

  const answer = canonical(response.answer);
  if (!answer) return false;

  const accepted = verified.acceptedClaims.map((claim) => canonical(claim.text));
  if (accepted.some((claim) => !claim)) return false;

  return answer === accepted.join(" ");
}
