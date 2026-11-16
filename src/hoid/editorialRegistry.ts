import {
  createHoidEvidenceRuntime,
  type HoidApprovedClaim,
  type HoidClaimSelector,
} from "./evidenceRuntime";
import type { HoidKnowledgeEntry } from "./catalog";

/**
 * Production editorial registry.
 *
 * It is intentionally empty until original summaries have been checked
 * against accessible source passages and approved with chapter-level scope.
 * Never populate this file with guessed facts or copied EPUB text.
 */
export const HOID_EDITORIAL_KNOWLEDGE: readonly HoidKnowledgeEntry[] = Object.freeze([]);
export const HOID_APPROVED_CLAIMS: readonly HoidApprovedClaim[] = Object.freeze([]);

export function createHoidEditorialRuntime(selector: HoidClaimSelector | null = null) {
  return createHoidEvidenceRuntime({
    knowledge: HOID_EDITORIAL_KNOWLEDGE,
    claims: HOID_APPROVED_CLAIMS,
    selector,
  });
}

export function getHoidEditorialRegistryStatus(): "empty" | "ready" {
  return HOID_EDITORIAL_KNOWLEDGE.length > 0 && HOID_APPROVED_CLAIMS.length > 0
    ? "ready"
    : "empty";
}
