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

/** Maximum number of raw claims accepted from an untrusted provider payload. */
export const DEFAULT_MAX_PROVIDER_CLAIMS = 128;
/** Maximum evidence identifiers accepted for one untrusted claim. */
export const DEFAULT_MAX_PROVIDER_EVIDENCE_IDS = 32;

export interface HoidProviderResponse {
  answer: string;
  claims: HoidClaim[];
}

/**
 * Fail-closed claim boundary shared by every evidence-aware provider path.
 * The caller supplies only identifiers already authorized for this request.
 *
 * Exact duplicate claims are collapsed after validation. A provider therefore
 * cannot consume the aggregate output budget or amplify a statement merely by
 * repeating the same text with the same authorized evidence in a different
 * order.
 */
export function filterClaimsByAuthorizedIds(
  rawClaims: unknown,
  authorizedIds: ReadonlySet<string>,
): HoidClaim[] {
  if (!Array.isArray(rawClaims) || rawClaims.length > DEFAULT_MAX_PROVIDER_CLAIMS) return [];

  const claims: HoidClaim[] = [];
  const seenClaims = new Set<string>();
  for (const raw of rawClaims) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const claim = raw as Partial<HoidClaim>;
    const text = validProviderText(claim.text);
    if (text === null) continue;
    if (!Array.isArray(claim.evidenceIds) || claim.evidenceIds.length === 0 || claim.evidenceIds.length > DEFAULT_MAX_PROVIDER_EVIDENCE_IDS) continue;

    if (!claim.evidenceIds.every((id) => typeof id === "string" && authorizedIds.has(id))) continue;

    // Canonicalize evidence before returning it. This makes equivalent provider
    // payloads deterministic and keeps downstream consumers from depending on
    // provider-specific ordering or repeated identifiers.
    const evidenceIds = [...new Set(claim.evidenceIds)].sort();

    // Evidence order is not semantically meaningful for authorization. Use a
    // canonical key so reordered duplicate claims cannot evade deduplication.
    const key = JSON.stringify([text, [...evidenceIds].sort()]);
    if (seenClaims.has(key)) continue;
    seenClaims.add(key);
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
