/**
 * Provider-neutral contracts for Hoid IA.
 * No external SDK or API key is required by this layer.
 */

export type HoidProgress = Record<string, number>;

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
  constructor(private readonly progress: HoidProgress) {}

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
