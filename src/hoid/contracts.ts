/**
 * Provider-neutral contracts for Hoid IA.
 * No external SDK or API key is required by this layer.
 */

export type HoidProgress = Record<string, number>;

/**
 * Defensive runtime canonicalization for untrusted reading progress.
 * Invalid positions are discarded rather than coerced upward.
 */
export function canonicalHoidProgress(progress: unknown): HoidProgress {
  if (!progress || typeof progress !== "object" || Array.isArray(progress)) return {};
  // Use a null-prototype dictionary: externally supplied book IDs must not
  // be able to alter object inheritance through keys such as "__proto__".
  const canonical: HoidProgress = Object.create(null) as HoidProgress;
  for (const [bookId, chapter] of Object.entries(progress as Record<string, unknown>)) {
    if (typeof bookId !== "string" || bookId.trim().length === 0) continue;
    if (typeof chapter !== "number" || !Number.isFinite(chapter) || !Number.isInteger(chapter) || chapter < 0) continue;
    canonical[bookId] = chapter;
  }
  return canonical;
}

export interface KnowledgeItem {
  id: string;
  aliases: string[];
  kind: "character" | "place" | "event" | "concept" | "magic" | "organization" | "object";
  unlock: { bookId: string; chapter: number };
  summary?: string;
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

/** Retrieval boundary: blocked or malformed knowledge never reaches a provider. */
export class AuthorizedKnowledgeRetriever {
  constructor(private readonly repository: KnowledgeRepository, private readonly policy: SpoilerPolicy) {}
  async retrieve(query: string): Promise<KnowledgeItem[]> {
    const raw = await this.repository.search(query);
    return raw.map(canonicalKnowledgeItem).filter((item): item is KnowledgeItem => item !== null).filter((item) => this.policy.allows(item));
  }
}


/**
 * A reading position is only meaningful when the referenced work is part of
 * the verified catalog. Unknown works fail closed instead of unlocking data.
 */
export interface HoidCatalogEntry {
  id: string;
  title: string;
}

export function canonicalCatalog(entries: readonly HoidCatalogEntry[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry && typeof entry.id === "string" && entry.id.trim().length > 0) ids.add(entry.id.trim());
  }
  return ids;
}

export function catalogBoundProgress(progress: unknown, catalogIds: ReadonlySet<string>): HoidProgress {
  const canonical = canonicalHoidProgress(progress);
  const bound: HoidProgress = Object.create(null) as HoidProgress;
  for (const [bookId, chapter] of Object.entries(canonical)) {
    if (catalogIds.has(bookId)) bound[bookId] = chapter;
  }
  return bound;
}
