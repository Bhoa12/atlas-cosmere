/**
 * Spoiler-safe recommendation contract for Hoid IA.
 * Recommendations are constrained to the reader's authorized narrative boundary.
 */

export type RecommendationKind = "revisit" | "continue" | "explore-current-context";

export interface ReadingBoundary {
  workId: string;
  maxChapter: number;
}

export interface Recommendation {
  kind: RecommendationKind;
  workId: string;
  chapter?: number;
  text: string;
}

export type RecommendationResult =
  | { kind: "ready"; recommendations: Recommendation[] }
  | { kind: "abstain"; reason: "invalid-boundary" | "no-safe-recommendations" };

/**
 * Filters recommendation targets without widening the reader's known story.
 *
 * A recommendation may point only to the current work and never beyond the
 * explicitly authorized chapter. Unknown or malformed entries are discarded.
 * The function deliberately does not infer a future book, character arc, or
 * event from the catalog.
 */
export function buildSafeRecommendations(
  boundary: ReadingBoundary,
  candidates: ReadonlyArray<Recommendation>,
): RecommendationResult {
  if (!boundary.workId.trim() || !Number.isInteger(boundary.maxChapter) || boundary.maxChapter < 1) {
    return { kind: "abstain", reason: "invalid-boundary" };
  }

  const seen = new Set<string>();
  const recommendations = candidates.filter((item) => {
    const key = `${item.kind}:${item.workId}:${item.chapter ?? ""}:${item.text.trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);

    if (!item.text.trim() || item.workId !== boundary.workId) return false;
    if (item.kind === "explore-current-context") return item.chapter === undefined;
    return Number.isInteger(item.chapter)
      && (item.chapter as number) >= 1
      && (item.chapter as number) <= boundary.maxChapter;
  });

  return recommendations.length > 0
    ? { kind: "ready", recommendations }
    : { kind: "abstain", reason: "no-safe-recommendations" };
}
