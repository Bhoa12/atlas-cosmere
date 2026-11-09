import type { KnowledgeItem } from "./contracts";

/**
 * Provider-neutral response shape for answers that make factual claims.
 *
 * The provider may phrase an answer freely, but every factual claim exposed to
 * the reader must point to knowledge that already crossed the spoiler boundary.
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
 * displayed. This gives the UI a conservative representation even when a
 * provider returns extra, unsupported material.
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
  const answer = typeof value.answer === "string" ? value.answer.trim() : "";
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

  // Free-form prose is not treated as verified narrative output. Consumers can
  // render it as conversational framing, while factual content comes from the
  // evidence-bound claims above.
  return { answer, claims };
}
