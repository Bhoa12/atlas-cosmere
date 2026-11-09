import type { KnowledgeItem } from "./contracts";
import { validProviderText } from "./providerOutput";

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
 * Fail-closed claim boundary shared by every evidence-aware provider path.
 * The caller supplies only identifiers already authorized for this request.
 */
export function filterClaimsByAuthorizedIds(
  rawClaims: unknown,
  authorizedIds: ReadonlySet<string>,
): HoidClaim[] {
  if (!Array.isArray(rawClaims)) return [];

  const claims: HoidClaim[] = [];
  for (const raw of rawClaims) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const claim = raw as Partial<HoidClaim>;
    const text = validProviderText(claim.text);
    if (text === null) continue;
    if (!Array.isArray(claim.evidenceIds) || claim.evidenceIds.length === 0) continue;

    const evidenceIds = [...new Set(claim.evidenceIds)];
    if (!evidenceIds.every((id) => typeof id === "string" && authorizedIds.has(id))) continue;
    claims.push({ text, evidenceIds });
  }
  return claims;
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
  return {
    answer: "",
    claims: filterClaimsByAuthorizedIds(value.claims, allowedIds),
  };
}
