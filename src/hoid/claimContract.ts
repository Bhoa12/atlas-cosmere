/**
 * Hoid IA — contrato de afirmaciones respaldadas.
 *
 * Separa las afirmaciones narrativas del texto final para que cada una pueda
 * comprobarse contra la evidencia ya autorizada. La política es de fallo
 * cerrado: una sola afirmación sin respaldo invalida el borrador completo.
 */

export type SupportedClaim = {
  readonly text: string;
  readonly evidenceIds: readonly string[];
};

export type ClaimVerification =
  | { readonly kind: "verified"; readonly claims: readonly SupportedClaim[] }
  | { readonly kind: "abstain"; readonly reason: "INVALID_CLAIM" | "UNSUPPORTED_CLAIM" };

export function verifyClaims(
  claims: readonly SupportedClaim[],
  allowedEvidenceIds: ReadonlySet<string>,
): ClaimVerification {
  if (claims.length === 0) {
    return { kind: "abstain", reason: "INVALID_CLAIM" };
  }

  const normalized = claims.map((claim) => ({
    text: claim.text.trim(),
    evidenceIds: [...new Set(claim.evidenceIds.map((id) => id.trim()))],
  }));

  if (
    normalized.some(
      (claim) =>
        !claim.text ||
        claim.evidenceIds.length === 0 ||
        claim.evidenceIds.some((id) => !id || !allowedEvidenceIds.has(id)),
    )
  ) {
    return { kind: "abstain", reason: "UNSUPPORTED_CLAIM" };
  }

  return {
    kind: "verified",
    claims: normalized.map((claim) => ({
      text: claim.text,
      evidenceIds: claim.evidenceIds,
    })),
  };
}
