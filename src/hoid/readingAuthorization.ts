import { HoidKnowledgeCatalog, HoidKnowledgeEntry } from "./catalog";
import { ReadingPosition } from "./types";
import { validReadingPositions } from "./readingValidation";

/**
 * Conservative authorization for catalog knowledge.
 *
 * This boundary deliberately reuses the public progress validator. Authorization
 * must never merge duplicate positions toward the greatest chapter: if the
 * caller supplies conflicting progress, the state is ambiguous and therefore
 * unlocks nothing. Keeping validation shared also prevents direct callers from
 * bypassing integer and finite-chapter checks enforced at the public boundary.
 */
export function normalizeReadingPositions(reading: ReadingPosition[]): ReadingPosition[] {
  const validated = validReadingPositions(reading);
  return validated ?? [];
}

export function isKnowledgeUnlocked(
  entry: HoidKnowledgeEntry,
  reading: ReadingPosition[],
): boolean {
  return new HoidKnowledgeCatalog([entry]).isUnlocked(
    entry,
    normalizeReadingPositions(reading),
  );
}
