import { ReadingPosition } from './types';

export type HoidKnowledgeKind = 'character' | 'place' | 'event' | 'concept' | 'magic' | 'organization' | 'object';

export type HoidKnowledgeEntry = {
  id: string;
  aliases: string[];
  kind: HoidKnowledgeKind;
  firstSafeAppearance: { bookId: string; chapter: number };
  summary?: string;
};

/**
 * Normalize catalog matching text independently of locale so that the spoiler
 * boundary does not depend on the device language. Diacritics are removed
 * because providers may omit or alter them (for example, Spanish accents).
 */
function normalizeForCatalogMatch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Catalog metadata is intentionally separate from generated answers and source
 * text. Entries must only be added after editorial verification.
 */
export class HoidKnowledgeCatalog {
  constructor(private readonly entries: HoidKnowledgeEntry[] = []) {}

  findMatches(text: string): HoidKnowledgeEntry[] {
    const normalized = normalizeForCatalogMatch(text);
    return this.entries.filter(entry =>
      entry.aliases.some(alias => {
        const normalizedAlias = normalizeForCatalogMatch(alias).trim();
        return normalizedAlias.length > 0 && normalized.includes(normalizedAlias);
      })
    );
  }

  isUnlocked(entry: HoidKnowledgeEntry, reading: ReadingPosition[]): boolean {
    const position = reading.find(item => item.bookId === entry.firstSafeAppearance.bookId);
    return Boolean(position && (position.completed || (position.chapter ?? 0) >= entry.firstSafeAppearance.chapter));
  }

  lockedMatches(text: string, reading: ReadingPosition[]): HoidKnowledgeEntry[] {
    return this.findMatches(text).filter(entry => !this.isUnlocked(entry, reading));
  }
}
