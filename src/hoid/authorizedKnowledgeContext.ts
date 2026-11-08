import { HoidKnowledgeCatalog, HoidKnowledgeEntry } from './catalog';
import { ReadingPosition } from './types';

export type HoidContextFact = {
  id: string;
  kind: HoidKnowledgeEntry['kind'];
  source: { bookId: string; chapter: number };
  summary: string;
};

/**
 * Build the smallest provider-facing knowledge context that can be justified by
 * the editorial catalog and the reader's current position.
 *
 * This function intentionally returns original summaries only. It never reads
 * EPUB content, extracts passages, or treats an inaccessible source as evidence.
 * Missing summaries and entries without verified editorial provenance are
 * excluded so provider integrations cannot accidentally turn catalog metadata
 * into invented narrative claims.
 */
export function buildAuthorizedKnowledgeContext(
  catalog: HoidKnowledgeCatalog,
  reading: ReadingPosition[],
): readonly HoidContextFact[] {
  return catalog.entriesForContext(reading).map(entry => ({
    id: entry.id,
    kind: entry.kind,
    source: { ...entry.firstSafeAppearance },
    summary: entry.summary!,
  }));
}
