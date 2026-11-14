import type { AuthorizedContext, ProviderDraft, VerifiedClaim } from "./providerContract";

export type DraftIntegrityResult =
  | Readonly<{ status: "accepted"; claims: readonly VerifiedClaim[] }>
  | Readonly<{ status: "rejected"; reason: "empty-draft" | "invalid-claim" }>;

/**
 * Verifies a provider draft atomically. Unlike best-effort filtering, one
 * malformed or unauthorized narrative claim rejects the complete draft so that
 * no surviving sentence can depend on hidden future context.
 */
export function verifyDraftAtomically(
  context: AuthorizedContext,
  draft: ProviderDraft,
): DraftIntegrityResult {
  if (draft.claims.length === 0) {
    return Object.freeze({ status: "rejected" as const, reason: "empty-draft" as const });
  }

  const allowed = new Set(context.evidenceIds);
  const verified: VerifiedClaim[] = [];

  for (const claim of draft.claims) {
    const ids = [...new Set(claim.evidenceIds)];
    if (!claim.text.trim() || ids.length === 0 || ids.some((id) => !allowed.has(id))) {
      return Object.freeze({ status: "rejected" as const, reason: "invalid-claim" as const });
    }
    verified.push(Object.freeze({ text: claim.text, evidenceIds: Object.freeze(ids) }));
  }

  return Object.freeze({ status: "accepted" as const, claims: Object.freeze(verified) });
}
