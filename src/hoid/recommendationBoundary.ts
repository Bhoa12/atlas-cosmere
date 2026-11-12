import {
  HoidCatalogEntry,
  SafeRecommendation,
  safeCatalogRecommendation,
} from "./contracts";

/**
 * Recommendations are intentionally derived from catalog metadata and recorded
 * progress only. This boundary does not inspect narrative content, infer plot
 * order, or let a provider supply a reason that could reveal future events.
 */
export const DEFAULT_MAX_RECOMMENDATION_CANDIDATES = 64;

function isFinitePositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

export function planSafeCatalogRecommendations(
  candidates: unknown,
  catalog: readonly HoidCatalogEntry[],
  progress: unknown,
  maxCandidates = DEFAULT_MAX_RECOMMENDATION_CANDIDATES,
): SafeRecommendation[] {
  if (!Array.isArray(candidates) || !isFinitePositiveInteger(maxCandidates)) return [];
  if (candidates.length > maxCandidates) return [];

  const recommendations: SafeRecommendation[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const id = candidate.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const recommendation = safeCatalogRecommendation(id, catalog, progress);
    if (recommendation) recommendations.push(recommendation);
  }

  return recommendations;
}
