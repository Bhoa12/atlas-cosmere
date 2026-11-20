import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { validEditionBoundReadingPositions } from "./editionProgressValidation";
import { validReadingPositions } from "./readingValidation";
import { getHoidReadingManifest } from "./readingManifest";
import { ReadingPosition } from "./types";

/**
 * Spoiler-safe reading recommendations.
 *
 * Recommendations are metadata-only: this module does not infer plot order,
 * canon dependencies, chapter counts, or facts from unavailable source text.
 */
export type HoidRecommendationReason = "unread-source" | "resume-current-work";

export type HoidRecommendation =
  | Readonly<{
      sourceId: string;
      title: string;
      reason: "unread-source";
    }>
  | Readonly<{
      sourceId: string;
      title: string;
      reason: "resume-current-work";
      /** The current/open chapter cursor, validated against the edition manifest. */
      currentChapter: number;
      /** Chapters before the current/open cursor; null when the cursor is at chapter one. */
      completedThroughChapter: number | null;
    }>;

const MAX_RECOMMENDATION_LIMIT = HOID_SOURCE_BIBLIOGRAPHY.length;

function safeRecommendationLimit(limit: number): number {
  return Number.isFinite(limit)
    ? Math.min(MAX_RECOMMENDATION_LIMIT, Math.max(0, Math.floor(limit)))
    : 0;
}

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
  const safeLimit = safeRecommendationLimit(limit);
  if (safeLimit === 0) return [];

  // This exported helper is also a public boundary. Validate even when the
  // static type claims the state is already canonical: persisted or JavaScript
  // callers can still provide duplicates or malformed positions.
  const canonicalReading = validReadingPositions(reading);
  if (canonicalReading === null) return [];

  const verifiedReading = knownReading(canonicalReading);

  return HOID_SOURCE_BIBLIOGRAPHY
    .filter(source => !hasStarted(source.id, verifiedReading))
    .slice(0, safeLimit)
    .map(source => Object.freeze({
      sourceId: source.id,
      title: source.title,
      reason: "unread-source" as const,
    }));
}

/**
 * Recommend a safe next step from edition-validated progress.
 *
 * A resume recommendation is emitted only when the caller explicitly names
 * the active work, or exactly one known work is in progress. When several
 * works are active and no activeBookId is supplied, the function does not
 * guess which one the reader intends to continue.
 *
 * ReadingPosition.chapter is the current/open chapter cursor (the v2 cursor
 * projection uses the same value). Therefore completedThroughChapter is
 * currentChapter - 1; a completed=true position never produces a resume item.
 */
export function recommendReadingNextSteps(
  readingInput: unknown,
  limit = 3,
  activeBookId?: unknown,
): HoidRecommendation[] {
  const safeLimit = safeRecommendationLimit(limit);
  if (safeLimit === 0) return [];

  if (activeBookId !== undefined && (
    typeof activeBookId !== "string" ||
    activeBookId !== activeBookId.trim() ||
    !HOID_SOURCE_BIBLIOGRAPHY.some(source => source.id === activeBookId)
  )) return [];

  const canonicalReading = validEditionBoundReadingPositions(readingInput);
  if (canonicalReading === null) return [];

  const verifiedReading = knownReading(canonicalReading);
  const inProgress = verifiedReading.filter(position =>
    position.completed !== true &&
    typeof position.chapter === "number" &&
    position.chapter >= 1,
  );

  let activePosition: ReadingPosition | undefined;
  if (typeof activeBookId === "string") {
    activePosition = inProgress.find(position => position.bookId === activeBookId);
  } else if (inProgress.length === 1) {
    activePosition = inProgress[0];
  }

  let resume: HoidRecommendation | null = null;
  if (activePosition && typeof activePosition.chapter === "number") {
    const source = HOID_SOURCE_BIBLIOGRAPHY.find(item => item.id === activePosition!.bookId);
    const manifestResult = getHoidReadingManifest(activePosition.bookId);
    const hasExactUnit = manifestResult.status === "ready" &&
      manifestResult.manifest.units.some(unit => unit.chapterNumber === activePosition!.chapter);

    if (source && hasExactUnit) {
      resume = Object.freeze({
        sourceId: source.id,
        title: source.title,
        reason: "resume-current-work" as const,
        currentChapter: activePosition.chapter,
        completedThroughChapter: activePosition.chapter > 1
          ? activePosition.chapter - 1
          : null,
      });
    }
  }

  const remaining = safeLimit - (resume ? 1 : 0);
  const unread = remaining > 0
    ? recommendUnstartedSources(canonicalReading, remaining)
    : [];

  return resume ? [resume, ...unread] : unread;
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
