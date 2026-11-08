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
   * Optional provider-facing knowledge that has already passed editorial,
   * provenance and reading-position authorization.
   */
  knowledgeContext?: readonly HoidKnowledgeContextFact[];
};

export type HoidAnswer = {
  text: string;
  blocked: boolean;
  reason?: 'reading-position' | 'provider-unavailable' | 'provider-output';
};

export interface HoidProvider {
  answer(request: HoidAnswerRequest): Promise<string>;
}
