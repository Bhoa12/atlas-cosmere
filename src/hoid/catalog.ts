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
 * Match catalog aliases against a canonical representation. Format characters
 * (for example zero-width spaces) and combining marks must not let a locked
 * entity bypass the deterministic spoiler boundary.
 */
function normalizeForCatalogMatch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\p{Cf}\p{Mn}]/gu, '')
    .toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsCatalogAlias(text: string, alias: string): boolean {
  const escaped = escapeRegex(alias);
  // Require a Unicode letter/number boundary around aliases. This prevents a
  // short catalog alias from matching inside an unrelated word while still
  // allowing names and multi-word aliases next to punctuation.
  return new RegExp('(^|[^\\p{L}\\p{N}])' + escaped + '($|[^\\p{L}\\p{N}])', 'u').test(text);
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
        return normalizedAlias.length > 0 && containsCatalogAlias(normalized, normalizedAlias);
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
