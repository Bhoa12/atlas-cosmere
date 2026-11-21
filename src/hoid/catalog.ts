import { buildReadingContext } from './readingContext';
import { isEvidenceUnlocked } from './evidenceScope';
import { isHoidFirstSafeAppearanceCompleted } from "./readingBoundary";
import { ReadingPosition } from './types';
import { isKnownHoidSource } from "./bibliography";
import { isHoidKnowledgeKind, type HoidKnowledgeKind } from "./knowledgeKinds";
import { getHoidReadingManifest } from "./readingManifest";

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

const MAX_CATALOG_ENTRIES = 512;
const MAX_ALIASES_PER_ENTRY = 64;
const MAX_ALIAS_LENGTH = 256;
const MAX_SUMMARY_LENGTH = 4_000;
const MAX_CHAPTER = 100_000_000;
const REQUIRED_ENTRY_KEYS = ["id", "aliases", "kind", "firstSafeAppearance"] as const;

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
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
}

function containsCatalogAlias(text: string, alias: string): boolean {
  const escaped = escapeRegex(alias);
  // Require a Unicode letter/number boundary around aliases. This prevents a
  // short catalog alias from matching inside an unrelated word while still
  // allowing names and multi-word aliases next to punctuation.
  return new RegExp('(^|[^\\p{L}\\p{N}])' + escaped + '($|[^\\p{L}\\p{N}])', 'u').test(text);
}

function canonicalRecord(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const allowed = new Set([...requiredKeys, ...optionalKeys]);
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length < requiredKeys.length || ownKeys.length > allowed.size) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !allowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalDenseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < minimum ||
      value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function hasVerifiedChapter(bookId: unknown, chapter: unknown): bookId is string {
  if (
    typeof bookId !== "string" ||
    bookId.length === 0 ||
    bookId !== bookId.trim() ||
    !isKnownHoidSource(bookId) ||
    typeof chapter !== "number" ||
    !Number.isSafeInteger(chapter) ||
    chapter < 1 ||
    chapter > MAX_CHAPTER
  ) return false;

  const result = getHoidReadingManifest(bookId);
  return result.status === "ready" &&
    result.manifest.units.some(unit => unit.chapterNumber === chapter);
}

function canonicalizeEntry(value: unknown): HoidKnowledgeEntry | null {
  const record = canonicalRecord(value, REQUIRED_ENTRY_KEYS, [
    "evidenceSource",
    "evidenceUnlock",
    "summary",
    "provenance",
  ]);
  if (!record) return null;

  const id = record.id;
  if (
    typeof id !== "string" ||
    id.length === 0 ||
    id.length > 128 ||
    id !== id.trim() ||
    /[\u0000-\u001F\u007F]/u.test(id)
  ) return null;

  if (!isHoidKnowledgeKind(record.kind)) return null;

  const rawAliases = canonicalDenseArray(record.aliases, 1, MAX_ALIASES_PER_ENTRY);
  if (!rawAliases) return null;
  const aliases: string[] = [];
  const seenAliases = new Set<string>();
  for (const rawAlias of rawAliases) {
    if (
      typeof rawAlias !== "string" ||
      rawAlias.length === 0 ||
      rawAlias.length > MAX_ALIAS_LENGTH ||
      rawAlias !== rawAlias.trim() ||
      /[\u0000-\u001F\u007F]/u.test(rawAlias)
    ) return null;
    const identity = normalizeForCatalogMatch(rawAlias);
    if (identity.length === 0 || seenAliases.has(identity)) return null;
    seenAliases.add(identity);
    aliases.push(rawAlias);
  }

  const appearance = canonicalRecord(record.firstSafeAppearance, ["bookId", "chapter"]);
  if (!appearance || !hasVerifiedChapter(appearance.bookId, appearance.chapter)) return null;

  const entry: HoidKnowledgeEntry = {
    id,
    aliases,
    kind: record.kind,
    firstSafeAppearance: {
      bookId: appearance.bookId,
      chapter: appearance.chapter as number,
    },
  };

  // A malformed optional evidence tuple is omitted rather than promoted. This
  // can preserve a safe name-only catalog entry, but it can never authorize a
  // provider-facing summary because entriesForContext requires valid evidence.
  const source = Object.prototype.hasOwnProperty.call(record, "evidenceSource")
    ? canonicalRecord(record.evidenceSource, ["bookId", "chapter", "locatorId"])
    : null;
  if (
    source &&
    hasVerifiedChapter(source.bookId, source.chapter) &&
    typeof source.locatorId === "string" &&
    source.locatorId.length > 0 &&
    source.locatorId.length <= 256 &&
    source.locatorId === source.locatorId.trim()
  ) {
    const manifest = getHoidReadingManifest(source.bookId);
    const unit = manifest.status === "ready"
      ? manifest.manifest.units.find(candidate => candidate.chapterNumber === source.chapter)
      : undefined;
    if (unit?.locatorId === source.locatorId) {
      entry.evidenceSource = {
        bookId: source.bookId,
        chapter: source.chapter as number,
        locatorId: source.locatorId,
      };
    }
  }

  const unlock = Object.prototype.hasOwnProperty.call(record, "evidenceUnlock")
    ? canonicalRecord(record.evidenceUnlock, ["bookId", "chapter"])
    : null;
  if (
    entry.evidenceSource &&
    unlock &&
    unlock.bookId === entry.evidenceSource.bookId &&
    hasVerifiedChapter(unlock.bookId, unlock.chapter) &&
    typeof unlock.chapter === "number" &&
    unlock.chapter >= entry.evidenceSource.chapter
  ) {
    entry.evidenceUnlock = {
      bookId: unlock.bookId as string,
      chapter: unlock.chapter,
    };
  }

  if (
    typeof record.summary === "string" &&
    record.summary.length > 0 &&
    record.summary.length <= MAX_SUMMARY_LENGTH &&
    record.summary === record.summary.trim() &&
    !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(record.summary)
  ) {
    entry.summary = record.summary;
  }
  if (
    record.provenance === "verified" ||
    record.provenance === "limited" ||
    record.provenance === "unavailable"
  ) {
    entry.provenance = record.provenance;
  }

  return entry;
}

function freezeEntry(entry: HoidKnowledgeEntry): HoidKnowledgeEntry {
  return Object.freeze({
    ...entry,
    aliases: Object.freeze([...entry.aliases]) as unknown as string[],
    firstSafeAppearance: Object.freeze({ ...entry.firstSafeAppearance }),
    ...(entry.evidenceSource
      ? { evidenceSource: Object.freeze({ ...entry.evidenceSource }) }
      : {}),
    ...(entry.evidenceUnlock
      ? { evidenceUnlock: Object.freeze({ ...entry.evidenceUnlock }) }
      : {}),
  });
}

function cloneEntry(entry: HoidKnowledgeEntry): HoidKnowledgeEntry {
  return {
    ...entry,
    aliases: [...entry.aliases],
    firstSafeAppearance: { ...entry.firstSafeAppearance },
    ...(entry.evidenceSource ? { evidenceSource: { ...entry.evidenceSource } } : {}),
    ...(entry.evidenceUnlock ? { evidenceUnlock: { ...entry.evidenceUnlock } } : {}),
  };
}

function canonicalEntryIdentity(entry: HoidKnowledgeEntry): string {
  return JSON.stringify(entry);
}

/**
 * Catalog metadata is intentionally separate from generated answers and source
 * text. The constructor takes a detached, validated snapshot. Public methods
 * return detached copies so a caller cannot mutate the authorization state
 * retained by this catalog instance.
 */
export class HoidKnowledgeCatalog {
  readonly #entries: readonly HoidKnowledgeEntry[];

  constructor(entries: readonly HoidKnowledgeEntry[] = []) {
    const rawEntries = canonicalDenseArray(entries, 0, MAX_CATALOG_ENTRIES);
    if (!rawEntries) {
      this.#entries = Object.freeze([]);
      return;
    }

    const canonical = rawEntries
      .map(canonicalizeEntry)
      .filter((entry): entry is HoidKnowledgeEntry => entry !== null);
    const counts = new Map<string, number>();
    for (const entry of canonical) {
      const identity = entry.id.normalize("NFKC").toLowerCase();
      counts.set(identity, (counts.get(identity) ?? 0) + 1);
    }

    this.#entries = Object.freeze(canonical
      .filter(entry => counts.get(entry.id.normalize("NFKC").toLowerCase()) === 1)
      .map(freezeEntry));
  }

  findMatches(text: string): HoidKnowledgeEntry[] {
    if (typeof text !== "string" || text.length === 0 || text.length > 20_000) return [];
    const normalized = normalizeForCatalogMatch(text);
    return this.#entries
      .filter(entry => entry.aliases.some(alias => {
        const normalizedAlias = normalizeForCatalogMatch(alias).trim();
        return normalizedAlias.length > 0 && containsCatalogAlias(normalized, normalizedAlias);
      }))
      .map(cloneEntry);
  }

  /**
   * Entity-name authorization is intentionally separate from summary
   * authorization. A name may be safe to mention before the complete editorial
   * summary is safe to reveal. The supplied entry must match the catalog's
   * canonical snapshot; its caller-owned unlock metadata is never authoritative.
   */
  isEntityMentionUnlocked(entry: HoidKnowledgeEntry, reading: readonly ReadingPosition[]): boolean {
    const candidate = canonicalizeEntry(entry);
    if (!candidate) return false;
    const trusted = this.#entries.find(item => item.id === candidate.id);
    if (!trusted || canonicalEntryIdentity(candidate) !== canonicalEntryIdentity(trusted)) return false;

    const position = buildReadingContext(reading)
      .find(item => item.bookId === trusted.firstSafeAppearance.bookId);
    return Boolean(position && isHoidFirstSafeAppearanceCompleted(
      position.chapter,
      trusted.firstSafeAppearance.chapter,
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
    return this.#entries
      .filter(entry =>
        entry.provenance === 'verified' &&
        typeof entry.summary === 'string' &&
        entry.summary.trim().length > 0 &&
        this.isEntityMentionUnlocked(entry, reading) &&
        isEvidenceUnlocked(entry, reading),
      )
      .map(cloneEntry);
  }
}
