import { HoidKnowledgeEntry } from "./catalog";
import { ReadingPosition } from "./types";
import { normalizeReadingPositions } from "./readingAuthorization";

/**
 * Produces the canonical, conservative reading state used at Hoid's trust
 * boundary. This prevents providers and retrieval layers from interpreting raw
 * or ambiguous UI progress differently.
 */
export function authorizeReading(
  reading: ReadingPosition[],
  knownBooks?: ReadonlySet<string>,
): ReadingPosition[] {
  return normalizeReadingPositions(reading).filter(
    (position) => !knownBooks || knownBooks.has(position.bookId),
  );
}

export function authorizedBookIds(
  knowledge: readonly HoidKnowledgeEntry[],
  reading: ReadingPosition[],
): Set<string> {
  const knownBooks = new Set(knowledge.map((entry) => entry.bookId));
  return new Set(authorizeReading(reading, knownBooks).map((position) => position.bookId));
}
