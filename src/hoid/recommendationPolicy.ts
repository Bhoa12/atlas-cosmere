/**
 * Provider-independent recommendation gate for Hoid IA.
 * It operates only on metadata and declared reading progress.
 */

export type RecommendationCandidate = {
  bookId: string;
  title: string;
  kind: "novel" | "novella" | "graphic-novel" | "collection";
  order?: number;
};

export type ReadingProgress = {
  bookId: string;
  chapter: number;
};

export type RecommendationDecision =
  | { kind: "recommend"; candidate: RecommendationCandidate; reason: string }
  | { kind: "abstain"; reason: string };

function validId(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Recommends only a candidate explicitly supplied by the application.
 * Narrative facts, plot summaries and cross-book inferences are deliberately
 * outside this boundary.
 */
export function recommendNext(
  progress: readonly ReadingProgress[],
  candidates: readonly RecommendationCandidate[],
): RecommendationDecision {
  if (!progress.length) {
    return { kind: "abstain", reason: "reading-progress-required" };
  }

  const validProgress = progress.every(
    (entry) => validId(entry.bookId) && Number.isInteger(entry.chapter) && entry.chapter > 0,
  );

  if (!validProgress) {
    return { kind: "abstain", reason: "invalid-reading-progress" };
  }

  const completedIds = new Set(progress.map((entry) => entry.bookId));
  const candidate = candidates.find(
    (entry) =>
      validId(entry.bookId) &&
      validId(entry.title) &&
      Number.isFinite(entry.order) &&
      !completedIds.has(entry.bookId),
  );

  if (!candidate) {
    return { kind: "abstain", reason: "no-safe-recommendation" };
  }

  return {
    kind: "recommend",
    candidate,
    reason: "catalog-order-and-declared-progress",
  };
}
