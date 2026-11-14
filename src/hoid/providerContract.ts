export type AuthorizedContext = Readonly<{
  evidenceIds: readonly string[];
}>;

export type ProviderRequest = Readonly<{
  question: string;
  context: AuthorizedContext;
}>;

export type ProviderClaim = Readonly<{
  text: string;
  evidenceIds: readonly string[];
}>;

export type ProviderDraft = Readonly<{
  claims: readonly ProviderClaim[];
}>;

/**
 * Provider adapters may only consume already-authorized context and return
 * evidence-addressable claims. They cannot declare new evidence as trusted.
 */
export interface HoidProvider {
  generate(request: ProviderRequest): Promise<ProviderDraft>;
}

export type VerifiedClaim = Readonly<{
  text: string;
  evidenceIds: readonly string[];
}>;

export function verifyProviderDraft(
  context: AuthorizedContext,
  draft: ProviderDraft,
): readonly VerifiedClaim[] {
  const allowed = new Set(context.evidenceIds);
  const verified: VerifiedClaim[] = [];

  for (const claim of draft.claims) {
    if (!claim.text.trim() || claim.evidenceIds.length === 0) continue;
    if (claim.evidenceIds.some((id) => !allowed.has(id))) continue;

    verified.push(Object.freeze({
      text: claim.text,
      evidenceIds: Object.freeze([...new Set(claim.evidenceIds)]),
    }));
  }

  return Object.freeze(verified);
}
