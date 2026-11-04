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
 * Catalog metadata is intentionally separate from generated answers and source
 * text. Entries must only be added after editorial verification.
 */
export class HoidKnowledgeCatalog {
  constructor(private readonly entries: HoidKnowledgeEntry[] = []) {}

  findMatches(text: string): HoidKnowledgeEntry[] {
    const normalized = text.toLocaleLowerCase();
    return this.entries.filter(entry =>
      entry.aliases.some(alias => normalized.includes(alias.toLocaleLowerCase()))
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
