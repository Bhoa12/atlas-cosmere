import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { validReadingPositions } from "./readingValidation";
import { ReadingPosition } from "./types";

/**
 * Spoiler-safe reading recommendations.
 *
 * Recommendations are metadata-only: this module does not infer plot order,
 * canon dependencies, chapter counts, or facts from unavailable source text.
 */
export type HoidRecommendationReason = "unread-source";

export type HoidRecommendation = {
  sourceId: string;
  title: string;
  reason: HoidRecommendationReason;
};

function hasStarted(sourceId: string, reading: ReadingPosition[]): boolean {
  return reading.some(position =>
    position.bookId === sourceId &&
    (position.completed === true || (position.chapter ?? 0) > 0),
  );
}

function knownReading(reading: ReadingPosition[]): ReadingPosition[] {
  return reading.filter(position =>
    HOID_SOURCE_BIBLIOGRAPHY.some(source => source.id === position.bookId),
  );
}

export function recommendUnstartedSources(
  reading: ReadingPosition[],
  limit = 3,
): HoidRecommendation[] {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(0, Math.floor(limit))
    : 0;
  if (safeLimit === 0) return [];

  const verifiedReading = knownReading(reading);

  return HOID_SOURCE_BIBLIOGRAPHY
    .filter(source => !hasStarted(source.id, verifiedReading))
    .slice(0, safeLimit)
    .map(source => ({
      sourceId: source.id,
      title: source.title,
      reason: "unread-source" as const,
    }));
}

/**
 * Runtime-safe recommendation boundary.
 *
 * UI integrations can pass untrusted persisted state here. Invalid or
 * ambiguous progress fails closed: recommendations are not derived from a
 * reading state that could have been manipulated to suppress sources.
 */
export function recommendUnstartedSourcesFromUnknown(
  reading: unknown,
  limit = 3,
): HoidRecommendation[] {
  const canonicalReading = validReadingPositions(reading);
  if (canonicalReading === null) return [];

  return recommendUnstartedSources(canonicalReading, limit);
}
