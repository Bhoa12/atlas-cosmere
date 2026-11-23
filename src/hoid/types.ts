import type { HoidKnowledgeKind } from "./knowledgeKinds";

export type ReadingPosition = {
  bookId: string;
  chapter?: number;
  completed?: boolean;
  /** Canonical series order when available. Never use array position as canon. */
  order?: number;
};

export type HoidKnowledgeContextFact = {
  id: string;
  kind: HoidKnowledgeKind;
  source: { bookId: string; chapter: number };
  /** Original editorial summary, never source text. */
  summary: string;
};

export type HoidAnswerSelectionBudget = Readonly<{
  maxClaims: number;
  maxEvidence: number;
  maxWorks: number;
  maxCharacters: number;
  minimumWorks: number;
  requireSegmentProvenance: boolean;
  requireCrossWorkSegment: boolean;
}>;

export type HoidAnswerRequest = {
  question: string;
  reading: readonly ReadingPosition[];
  /** Closed presentation budget; it cannot widen the authorized evidence set. */
  selectionBudget?: HoidAnswerSelectionBudget;
  /**
   * Deprecated caller-supplied field. Hoid never forwards this value across
   * the provider boundary; authorized narrative context is built internally
   * from verified catalog entries and the canonical reading progress.
   */
  knowledgeContext?: readonly HoidKnowledgeContextFact[];
};

export type HoidAnswerEvidence = Readonly<{
  evidenceId: string;
  kind: HoidKnowledgeKind;
  source: Readonly<{
    bookId: string;
    title: string;
    chapter: number;
  }>;
}>;

/**
 * A factual claim and its locally reconstructed, edition-verified source
 * references. These references contain metadata only, never EPUB text or
 * internal navigation locators.
 */
export type HoidAnswerClaim = Readonly<{
  text: string;
  evidence: readonly HoidAnswerEvidence[];
}>;

export type HoidAnswer = {
  text: string;
  blocked: boolean;
  reason?: 'reading-position' | 'input-invalid' | 'provider-unavailable' | 'provider-output';
  /** Present only when the evidence-bound provider path produced verified citations. */
  claims?: readonly HoidAnswerClaim[];
};

export interface HoidProvider {
  answer(request: HoidAnswerRequest): Promise<string>;
}
