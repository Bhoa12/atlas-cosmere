import { buildReadingContext } from './readingContext';
import { isEvidenceUnlocked } from './evidenceScope';
import { isHoidFirstSafeAppearanceCompleted } from "./readingBoundary";
import { ReadingPosition } from './types';

import type { HoidKnowledgeKind } from "./knowledgeKinds";

export { HOID_KNOWLEDGE_KINDS, isHoidKnowledgeKind } from "./knowledgeKinds";
export type { HoidKnowledgeKind } from "./knowledgeKinds";

export type HoidKnowledgeProvenance = 'verified' | 'limited' | 'unavailable';

export type HoidEvidenceSource = Readonly<{ bookId: string; chapter: number; locatorId: string }>;
export type HoidEvidenceUnlock = Readonly<{ bookId: string; chapter: number }>;

export type HoidKnowledgeEntry = {
  id: string;
  aliases: string[];
  kind: HoidKnowledgeKind;
  firstSafeAppearance: { bookId: string; chapter: number };
  /** Metadata-only location used to verify this original editorial evidence. */
  evidenceSource?: HoidEvidenceSource;
  /** Earliest safe reader position for the entire summary, distinct from first appearance. */
  evidenceUnlock?: HoidEvidenceUnlock;
  /** Original editorial summary; never a source passage. */
  summary?: string;
  /** Context may only use verified summaries. Missing provenance fails closed. */
  provenance?: HoidKnowledgeProvenance;
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
  /**
   * Snapshot caller-owned metadata at construction. Catalog authorization is a
   * trust boundary, so later mutation of an array or aliases object owned by a
   * UI/import layer must not silently change what this instance considers
   * spoiler-safe.
   */
  private readonly entries: HoidKnowledgeEntry[];

  constructor(entries: HoidKnowledgeEntry[] = []) {
    this.entries = entries.map(entry => ({
      ...entry,
      aliases: Array.isArray(entry.aliases) ? [...entry.aliases] : [],
      firstSafeAppearance: { ...entry.firstSafeAppearance },
      ...(entry.evidenceSource ? { evidenceSource: { ...entry.evidenceSource } } : {}),
      ...(entry.evidenceUnlock ? { evidenceUnlock: { ...entry.evidenceUnlock } } : {}),
    }));
  }

  findMatches(text: string): HoidKnowledgeEntry[] {
    const normalized = normalizeForCatalogMatch(text);
    return this.entries.filter(entry =>
      entry.aliases.some(alias => {
        const normalizedAlias = normalizeForCatalogMatch(alias).trim();
        return normalizedAlias.length > 0 && containsCatalogAlias(normalized, normalizedAlias);
      })
    );
  }

  /**
   * Entity-name authorization is intentionally separate from summary
   * authorization. A name may be safe to mention before the complete editorial
   * summary is safe to reveal.
   */
  isEntityMentionUnlocked(entry: HoidKnowledgeEntry, reading: readonly ReadingPosition[]): boolean {
    // Never interpret raw progress independently. Canonicalization removes
    // duplicate or malformed positions before this authorization boundary, so
    // catalog access cannot depend on the incidental order of UI updates.
    const position = buildReadingContext(reading)
      .find(item => item.bookId === entry.firstSafeAppearance.bookId);
    return Boolean(position && isHoidFirstSafeAppearanceCompleted(
      position.chapter,
      entry.firstSafeAppearance.chapter,
      position.completed,
    ));
  }

  /**
   * Backwards-compatible alias for the entity-name boundary. Provider-facing
   * summaries must use isEvidenceUnlocked(), never this first-appearance check.
   * @deprecated Prefer isEntityMentionUnlocked() for explicit semantics.
   */
  isUnlocked(entry: HoidKnowledgeEntry, reading: readonly ReadingPosition[]): boolean {
    return this.isEntityMentionUnlocked(entry, reading);
  }

  lockedMatches(text: string, reading: readonly ReadingPosition[]): HoidKnowledgeEntry[] {
    return this.findMatches(text).filter(entry => !this.isEntityMentionUnlocked(entry, reading));
  }

  /**
   * Provider-facing context is stricter than entity-name matching: an entry
   * must have an original summary, verified provenance, an edition-bound source
   * locator, and an explicit full-summary unlock watermark. First appearance
   * alone is never sufficient to disclose summary details.
   */
  entriesForContext(reading: readonly ReadingPosition[]): HoidKnowledgeEntry[] {
    return this.entries.filter(entry =>
      entry.provenance === 'verified'
      && typeof entry.summary === 'string'
      && entry.summary.trim().length > 0
      && this.isEntityMentionUnlocked(entry, reading)
      && isEvidenceUnlocked(entry, reading),
    );
  }
}
