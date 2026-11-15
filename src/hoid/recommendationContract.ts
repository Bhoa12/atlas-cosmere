export type EvidenceId = string;

export interface RecommendationItem {
  text: string;
  evidenceIds: EvidenceId[];
}

export interface Recommendation {
  items: RecommendationItem[];
}

/**
 * Recommendations are advisory narrative output. They are accepted only when
 * every item is backed exclusively by evidence already admitted into the
 * reader's spoiler-safe context.
 */
export function verifyRecommendationAtomically(
  recommendation: Recommendation,
  allowedEvidence: ReadonlySet<EvidenceId>,
): { accepted: true } | { accepted: false; reason: string } {
  if (recommendation.items.length === 0) {
    return { accepted: false, reason: "empty-recommendation" };
  }

  for (const item of recommendation.items) {
    if (!item.text.trim()) {
      return { accepted: false, reason: "empty-item" };
    }
    if (item.evidenceIds.length === 0) {
      return { accepted: false, reason: "missing-evidence" };
    }
    if (item.evidenceIds.some((id) => !allowedEvidence.has(id))) {
      return { accepted: false, reason: "unauthorized-evidence" };
    }
  }

  return { accepted: true };
}
