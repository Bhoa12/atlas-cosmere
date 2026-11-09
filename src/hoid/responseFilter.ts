import type { KnowledgeItem } from "./contracts";

/**
 * Provider-neutral response shape for answers that make factual claims.
 *
 * Factual output is represented as evidence-bound claims. The free-form
 * provider answer is deliberately not trusted as narrative evidence.
 */
export interface HoidClaim {
  text: string;
  evidenceIds: string[];
}

export interface HoidProviderResponse {
  answer: string;
  claims: HoidClaim[];
}

/**
 * Final response boundary.
 *
 * Claims without valid evidence are removed instead of being guessed or
 * displayed. Free-form provider prose is also discarded at this boundary:
 * without a claim-level evidence mapping, it cannot be distinguished
 * mechanically from an unsupported or spoiler-bearing assertion.
 */
export function filterResponseByAuthorizedKnowledge(
  response: unknown,
  authorized: readonly KnowledgeItem[],
): HoidProviderResponse {
  const allowedIds = new Set(authorized.map((item) => item.id));
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return { answer: "", claims: [] };
  }

  const value = response as Partial<HoidProviderResponse>;
  const rawClaims = Array.isArray(value.claims) ? value.claims : [];

  const claims: HoidClaim[] = [];
  for (const raw of rawClaims) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const claim = raw as Partial<HoidClaim>;
    if (typeof claim.text !== "string" || claim.text.trim().length === 0) continue;
    if (!Array.isArray(claim.evidenceIds) || claim.evidenceIds.length === 0) continue;
    if (!claim.evidenceIds.every((id) => typeof id === "string" && allowedIds.has(id))) continue;
    claims.push({ text: claim.text.trim(), evidenceIds: [...new Set(claim.evidenceIds)] });
  }

  // Never pass through provider prose as a verified answer. A future renderer
  // may add locally generated conversational framing, but factual text must
  // come from the evidence-bound claims returned above.
  return { answer: "", claims };
}
