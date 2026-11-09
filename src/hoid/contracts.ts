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
  const canonical: HoidProgress = {};
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

export interface KnowledgeRepository {
  search(query: string): Promise<KnowledgeItem[]>;
}

export interface HoidProviderRequest {
  question: string;
  context: KnowledgeItem[];
  progress: HoidProgress;
}

export interface HoidProvider {
  answer(request: HoidProviderRequest): Promise<string>;
}

export class SpoilerPolicy {
  private readonly progress: HoidProgress;

  constructor(progress: HoidProgress) {
    this.progress = canonicalHoidProgress(progress);
  }

  allows(item: KnowledgeItem): boolean {
    return (this.progress[item.unlock.bookId] ?? 0) >= item.unlock.chapter;
  }

  filter(items: KnowledgeItem[]): KnowledgeItem[] {
    return items.filter((item) => this.allows(item));
  }
}

/**
 * Retrieval boundary: blocked knowledge never crosses this boundary into a provider.
 */
export class AuthorizedKnowledgeRetriever {
  constructor(
    private readonly repository: KnowledgeRepository,
    private readonly policy: SpoilerPolicy,
  ) {}

  async retrieve(query: string): Promise<KnowledgeItem[]> {
    return this.policy.filter(await this.repository.search(query));
  }
}
