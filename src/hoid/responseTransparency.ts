/**
 * Hoid IA — response transparency contract.
 *
 * This module is provider-neutral and deliberately carries no narrative text.
 * It describes which explanation claims are allowed to accompany a response.
 */

export type ExplanationBasisKind =
  | "authorized_evidence"
  | "reading_progress"
  | "catalog_metadata"
  | "user_preference";

export interface ExplanationBasis {
  kind: ExplanationBasisKind;
  id: string;
}

export interface ExplanationClaim {
  text: string;
  basis: ExplanationBasis[];
}

export interface ExplanationPolicyInput {
  authorizedEvidenceIds: readonly string[];
  knownWorkIds: readonly string[];
  preferenceIds?: readonly string[];
}

/**
 * Returns only explanation claims whose every declared basis is available to
 * the current request. Narrative claims must cite authorized evidence; catalog
 * and progress explanations may use their corresponding non-narrative bases.
 */
export function filterExplanationClaims(
  claims: readonly ExplanationClaim[],
  input: ExplanationPolicyInput,
): ExplanationClaim[] {
  const evidence = new Set(input.authorizedEvidenceIds);
  const works = new Set(input.knownWorkIds);
  const preferences = new Set(input.preferenceIds ?? []);

  return claims
    .filter((claim) => claim.text.trim().length > 0 && claim.basis.length > 0)
    .filter((claim) =>
      claim.basis.every((basis) => {
        if (!basis.id.trim()) return false;
        switch (basis.kind) {
          case "authorized_evidence":
            return evidence.has(basis.id);
          case "reading_progress":
          case "catalog_metadata":
            return works.has(basis.id);
          case "user_preference":
            return preferences.has(basis.id);
          default:
            return false;
        }
      }),
    )
    .map((claim) => ({
      text: claim.text.trim(),
      basis: claim.basis.map((basis) => ({ ...basis })),
    }));
}

export type TransparencyStatus = "complete" | "limited" | "abstain";

export interface TransparentExplanation {
  status: TransparencyStatus;
  claims: ExplanationClaim[];
  omittedClaims: number;
}

/**
 * Builds a fail-closed explanation result. If no claim survives, callers can
 * abstain instead of inventing a rationale for a recommendation or answer.
 */
export function buildTransparentExplanation(
  claims: readonly ExplanationClaim[],
  input: ExplanationPolicyInput,
): TransparentExplanation {
  const safeClaims = filterExplanationClaims(claims, input);
  const omittedClaims = claims.length - safeClaims.length;

  if (safeClaims.length === 0) {
    return { status: "abstain", claims: [], omittedClaims };
  }

  return {
    status: omittedClaims === 0 ? "complete" : "limited",
    claims: safeClaims,
    omittedClaims,
  };
}
