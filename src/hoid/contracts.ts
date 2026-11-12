/**
 * Provider-neutral contracts for Hoid IA.
 * No external SDK or API key is required by this layer.
 */

export type HoidProgress = Record<string, number>;

export function canonicalHoidProgress(progress: unknown): HoidProgress {
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) return {};
  const canonical: HoidProgress = Object.create(null) as HoidProgress;
  for (const [bookId, chapter] of Object.entries(progress as Record<string, unknown>)) {
    if (typeof bookId !== "string" || bookId.trim().length === 0) continue;
    if (typeof chapter !== "number" || !Number.isFinite(chapter) || !Number.isInteger(chapter) || chapter < 0) continue;
    canonical[bookId] = chapter;
  }
  return canonical;
}

export interface KnowledgeItem {
  id: string; aliases: string[];
  kind: "character" | "place" | "event" | "concept" | "magic" | "organization" | "object";
  unlock: { bookId: string; chapter: number }; summary?: string;
}
export interface KnowledgeRepository { search(query: string): Promise<KnowledgeItem[]>; }
export interface HoidProviderRequest { question: string; context: KnowledgeItem[]; progress: HoidProgress; }
export interface HoidProvider { answer(request: HoidProviderRequest): Promise<string>; }

export function canonicalKnowledgeItem(item: unknown): KnowledgeItem | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const value = item as Partial<KnowledgeItem>;
  if (typeof value.id !== "string" || value.id.trim().length === 0) return null;
  if (!Array.isArray(value.aliases) || !value.aliases.every((alias) => typeof alias === "string")) return null;
  if (!value.unlock || typeof value.unlock.bookId !== "string" || value.unlock.bookId.trim().length === 0) return null;
  if (typeof value.unlock.chapter !== "number" || !Number.isFinite(value.unlock.chapter) || !Number.isInteger(value.unlock.chapter) || value.unlock.chapter < 0) return null;
  const kinds = new Set(["character","place","event","concept","magic","organization","object"]);
  if (typeof value.kind !== "string" || !kinds.has(value.kind)) return null;
  if (value.summary !== undefined && typeof value.summary !== "string") return null;
  return { id: value.id.trim(), aliases: [...value.aliases], kind: value.kind as KnowledgeItem["kind"], unlock: { bookId: value.unlock.bookId.trim(), chapter: value.unlock.chapter }, ...(value.summary === undefined ? {} : { summary: value.summary }) };
}

export class SpoilerPolicy {
  private readonly progress: HoidProgress;
  constructor(progress: HoidProgress) { this.progress = canonicalHoidProgress(progress); }
  allows(item: KnowledgeItem): boolean {
    const canonical = canonicalKnowledgeItem(item);
    return canonical !== null && (this.progress[canonical.unlock.bookId] ?? 0) >= canonical.unlock.chapter;
  }
  filter(items: KnowledgeItem[]): KnowledgeItem[] { return items.filter((item) => this.allows(item)); }
}

export class AuthorizedKnowledgeRetriever {
  constructor(private readonly repository: KnowledgeRepository, private readonly policy: SpoilerPolicy) {}
  async retrieve(query: string): Promise<KnowledgeItem[]> {
    const raw = await this.repository.search(query);
    return raw.map(canonicalKnowledgeItem).filter((item): item is KnowledgeItem => item !== null).filter((item) => this.policy.allows(item));
  }
}

export interface HoidCatalogEntry { id: string; title: string; }

export function canonicalCatalog(entries: readonly HoidCatalogEntry[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const entry of entries) if (entry && typeof entry.id === "string" && entry.id.trim().length > 0) ids.add(entry.id.trim());
  return ids;
}

export function catalogBoundProgress(progress: unknown, catalogIds: ReadonlySet<string>): HoidProgress {
  const canonical = canonicalHoidProgress(progress);
  const bound: HoidProgress = Object.create(null) as HoidProgress;
  for (const [bookId, chapter] of Object.entries(canonical)) if (catalogIds.has(bookId)) bound[bookId] = chapter;
  return bound;
}

/**
 * Original editorial knowledge is a separate boundary from raw source access.
 * The scope is always a single work and the spoiler ceiling is checked against
 * the reader's validated position before the record can be presented.
 */
export interface EditorialRecord {
  id: string;
  bookId: string;
  chapterStart: number;
  chapterEnd: number;
  spoilerCeiling: number;
  text: string;
  provenance: "editorial";
}

/** Bounds untrusted editorial imports without limiting ordinary source metadata. */
export const DEFAULT_MAX_EDITORIAL_RECORD_TEXT_LENGTH = 12_000;
/** Maximum number of raw editorial records accepted in one import. */
export const DEFAULT_MAX_EDITORIAL_RECORDS = 256;

export function canonicalEditorialRecord(value: unknown, catalogIds: ReadonlySet<string>): EditorialRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<EditorialRecord>;
  if (typeof record.id !== "string" || record.id.trim().length === 0) return null;
  if (typeof record.bookId !== "string" || !catalogIds.has(record.bookId.trim())) return null;
  const numbers = [record.chapterStart, record.chapterEnd, record.spoilerCeiling];
  if (!numbers.every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0)) return null;
  if ((record.chapterStart as number) > (record.chapterEnd as number) || (record.chapterEnd as number) > (record.spoilerCeiling as number)) return null;
  if (typeof record.text !== "string" || record.text.trim().length === 0 || record.text.length > DEFAULT_MAX_EDITORIAL_RECORD_TEXT_LENGTH) return null;
  if (record.provenance !== "editorial") return null;
  return { id: record.id.trim(), bookId: record.bookId.trim(), chapterStart: record.chapterStart as number, chapterEnd: record.chapterEnd as number, spoilerCeiling: record.spoilerCeiling as number, text: record.text.trim(), provenance: "editorial" };
}

/**
 * Returns only original editorial records fully within the reader's progress.
 *
 * Duplicate identifiers are fail-closed: if two valid records share an id,
 * neither is returned. This prevents provider ordering from silently choosing
 * between conflicting editorial content.
 */
export function authorizedEditorialRecords(records: readonly unknown[], progress: unknown, catalog: readonly HoidCatalogEntry[]): EditorialRecord[] {
  // Imports are an untrusted boundary. Oversized batches fail closed instead of
  // truncating to an input-order-dependent prefix.
  if (records.length > DEFAULT_MAX_EDITORIAL_RECORDS) return [];
  const ids = canonicalCatalog(catalog);
  const bound = catalogBoundProgress(progress, ids);
  const canonical = records.map((raw) => canonicalEditorialRecord(raw, ids));
  const duplicateIds = new Set<string>();
  const seen = new Set<string>();
  for (const record of canonical) {
    if (!record) continue;
    if (seen.has(record.id)) duplicateIds.add(record.id);
    else seen.add(record.id);
  }
  const result: EditorialRecord[] = [];
  for (const record of canonical) {
    if (!record || duplicateIds.has(record.id) || (bound[record.bookId] ?? -1) < record.spoilerCeiling) continue;
    result.push(record);
  }
  // Canonical order prevents import ordering from changing the context or UI.
  return result.sort((a, b) => a.bookId.localeCompare(b.bookId) || a.chapterStart - b.chapterStart || a.chapterEnd - b.chapterEnd || a.id.localeCompare(b.id));
}

export interface SafeRecommendation {
  bookId: string; title: string;
  reason: "catalog-availability" | "recorded-reading-continuity";
}
export function safeCatalogRecommendation(candidate: unknown, catalog: readonly HoidCatalogEntry[], progress: unknown): SafeRecommendation | null {
  if (typeof candidate !== "string" || candidate.trim().length === 0) return null;
  const id = candidate.trim();
  const entry = catalog.find((value) => value && typeof value.id === "string" && value.id.trim() === id && typeof value.title === "string" && value.title.trim().length > 0);
  if (!entry) return null;
  const knownProgress = catalogBoundProgress(progress, canonicalCatalog(catalog));
  return { bookId: id, title: entry.title.trim(), reason: Object.prototype.hasOwnProperty.call(knownProgress, id) ? "recorded-reading-continuity" : "catalog-availability" };
}