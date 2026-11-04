import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { ReadingPosition } from "./types";

/**
 * Spoiler-safe reading recommendations.
 *
 * This module deliberately recommends only from metadata supplied to Atlas.
 * It does not infer plot order, canon dependencies, or chapter counts from
 * unavailable source text. A caller may provide curated recommendations later;
 * until then Hoid can safely identify unread works without claiming a reading
 * order.
 */
export type HoidRecommendation = {
  sourceId: string;
  title: string;
  reason: "unread-source";
};

function hasStarted(sourceId: string, reading: ReadingPosition[]): boolean {
  return reading.some(position =>
    position.bookId === sourceId &&
    (position.completed === true || (position.chapter ?? 0) > 0),
  );
}

export function recommendUnstartedSources(
  reading: ReadingPosition[],
  limit = 3,
): HoidRecommendation[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0) return [];

  return HOID_SOURCE_BIBLIOGRAPHY
    .filter(source => !hasStarted(source.id, reading))
    .slice(0, safeLimit)
    .map(source => ({
      sourceId: source.id,
      title: source.title,
      reason: "unread-source" as const,
    }));
}
