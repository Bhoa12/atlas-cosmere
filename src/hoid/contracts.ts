/**
 * Provider-neutral contracts for Hoid IA.
 * No external SDK or API key is required by this layer.
 */

export type HoidProgress = Record<string, number>;

/**\n * Defensive runtime canonicalization for untrusted reading progress.\n * Invalid positions are discarded rather than coerced upward.\n */\nexport function canonicalHoidProgress(progress: unknown): HoidProgress {\n  if (!progress || typeof progress !== "object" || Array.isArray(progress)) return {};\n  const canonical: HoidProgress = {};\n  for (const [bookId, chapter] of Object.entries(progress as Record<string, unknown>)) {\n    if (typeof bookId !== "string" || bookId.trim().length === 0) continue;\n    if (typeof chapter !== "number" || !Number.isFinite(chapter) || !Number.isInteger(chapter) || chapter < 0) continue;\n    canonical[bookId] = chapter;\n  }\n  return canonical;\n}

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
  private readonly progress: HoidProgress;\n\n  constructor(progress: HoidProgress) {\n    this.progress = canonicalHoidProgress(progress);\n  }

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
