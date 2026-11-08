export type ReadingPosition = {
  bookId: string;
  chapter?: number;
  completed?: boolean;
  /** Canonical series order when available. Never use array position as canon. */
  order?: number;
};

export type HoidKnowledgeContextFact = {
  id: string;
  kind: 'character' | 'place' | 'event' | 'concept' | 'magic' | 'organization' | 'object';
  source: { bookId: string; chapter: number };
  /** Original editorial summary, never source text. */
  summary: string;
};

export type HoidAnswerRequest = {
  question: string;
  reading: ReadingPosition[];
  /**
   * Deprecated caller-supplied field. Hoid never forwards this value across
   * the provider boundary; authorized narrative context is built internally
   * from verified catalog entries and the canonical reading progress.
   */
  knowledgeContext?: readonly HoidKnowledgeContextFact[];
};

export type HoidAnswer = {
  text: string;
  blocked: boolean;
  reason?: 'reading-position' | 'input-invalid' | 'provider-unavailable' | 'provider-output';
};

export interface HoidProvider {
  answer(request: HoidAnswerRequest): Promise<string>;
}
