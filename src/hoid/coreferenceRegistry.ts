/**
 * Reviewed, spoiler-scoped linguistic references for conversational follow-ups.
 *
 * A record maps an exact Spanish third-person singular pronoun to a canonical
 * entity ID. The mapping is a source-backed editorial assertion, not a guess
 * from a character name, grammatical stereotypes, provider output or prior
 * conversation text.
 *
 * Keep empty until every record has inspected chapter evidence and editorial
 * review. The production resolver also reauthorizes every entity in the
 * session context and every evidence unlock against the current progress.
 */
export type HoidCoreferenceForm = "él" | "ella";

export type HoidCoreferenceEvidence = Readonly<{
  id: string;
  source: Readonly<{
    bookId: string;
    chapter: number;
    locatorId: string;
  }>;
  unlock: Readonly<{
    bookId: string;
    chapter: number;
  }>;
}>;

export type HoidCoreferenceRecord = Readonly<{
  id: string;
  entityId: string;
  form: HoidCoreferenceForm;
  /** Every evidence item is mandatory (AND semantics). */
  evidence: readonly HoidCoreferenceEvidence[];
  review: Readonly<{
    status: "approved";
    origin: "original-editorial";
    reviewerId: string;
    reviewedAt: string;
  }>;
}>;

/** Production registry remains empty until pronoun-to-entity mappings are reviewed. */
export const HOID_COREFERENCE_REGISTRY: readonly HoidCoreferenceRecord[] = Object.freeze([]);
