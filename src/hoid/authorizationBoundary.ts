import { HoidKnowledgeEntry } from "./catalog";
import { ReadingPosition } from "./types";
import { normalizeReadingPositions } from "./readingAuthorization";

/**
 * Produces the canonical, conservative reading state used at Hoid's trust
 * boundary. Raw UI progress must never be interpreted independently by the
 * catalog, retrieval layer, or a provider.
 */
export function authorizeReading(
  reading: readonly ReadingPosition[],
  knownBooks?: ReadonlySet<string>,
): ReadingPosition[] {
  return normalizeReadingPositions([...reading]).filter(
    (position) => !knownBooks || knownBooks.has(position.bookId),
  );
}

/** Books that can unlock entries in this catalog. */
export function catalogBookIds(
  knowledge: readonly HoidKnowledgeEntry[],
): Set<string> {
  return new Set(
    knowledge.map((entry) => entry.firstSafeAppearance.bookId),
  );
}

export function authorizedBookIds(
  knowledge: readonly HoidKnowledgeEntry[],
  reading: readonly ReadingPosition[],
): Set<string> {
  const knownBooks = catalogBookIds(knowledge);
  return new Set(
    authorizeReading(reading, knownBooks).map((position) => position.bookId),
  );
}
