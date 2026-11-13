/**
 * Hoid IA request-scoped knowledge budget.
 *
 * This module is intentionally provider-neutral. It contains no model SDK,
 * network access, or protected source text. A budget is a monotonic boundary:
 * later stages may narrow it but must never expand it.
 */

export type CanonicalWorkId = string;
export type EvidenceId = string;

export interface ReadingPosition {
  readonly workId: CanonicalWorkId;
  readonly chapter: number;
}

export interface EditorialEvidence {
  readonly id: EvidenceId;
  readonly workId: CanonicalWorkId;
  readonly maxChapter: number;
  readonly provenance: "verified" | "original_summary";
}

export interface RequestKnowledgeBudget {
  readonly positions: ReadonlyMap<CanonicalWorkId, number>;
  readonly evidenceIds: ReadonlySet<EvidenceId>;
}

const validId = (value: string): boolean =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 160;

const validChapter = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

/**
 * Builds the only knowledge ceiling for one request.
 * Unknown provenance and evidence beyond the reader's position are excluded.
 */
export function createRequestKnowledgeBudget(
  positions: readonly ReadingPosition[],
  evidence: readonly EditorialEvidence[],
): RequestKnowledgeBudget {
  const positionMap = new Map<CanonicalWorkId, number>();

  for (const position of positions) {
    if (!validId(position.workId) || !validChapter(position.chapter)) {
      throw new Error("Invalid reading position");
    }

    const previous = positionMap.get(position.workId);
    if (previous !== undefined && previous !== position.chapter) {
      throw new Error("Conflicting reading positions for one work");
    }

    positionMap.set(position.workId, position.chapter);
  }

  const allowedEvidence = new Set<EvidenceId>();
  for (const item of evidence) {
    if (
      !validId(item.id) ||
      !validId(item.workId) ||
      !validChapter(item.maxChapter)
    ) {
      throw new Error("Invalid editorial evidence");
    }

    const readerChapter = positionMap.get(item.workId);
    if (
      readerChapter !== undefined &&
      item.maxChapter <= readerChapter &&
      (item.provenance === "verified" || item.provenance === "original_summary")
    ) {
      allowedEvidence.add(item.id);
    }
  }

  return {
    positions: new Map(positionMap),
    evidenceIds: new Set(allowedEvidence),
  };
}

/**
 * Narrows an existing budget. The requested evidence must already be allowed;
 * this function cannot introduce new evidence or raise reading positions.
 */
export function narrowKnowledgeBudget(
  budget: RequestKnowledgeBudget,
  requestedEvidenceIds: readonly EvidenceId[],
): RequestKnowledgeBudget {
  const narrowed = new Set<EvidenceId>();

  for (const id of requestedEvidenceIds) {
    if (budget.evidenceIds.has(id)) narrowed.add(id);
  }

  return {
    positions: new Map(budget.positions),
    evidenceIds: narrowed,
  };
}

export function isEvidenceAuthorized(
  budget: RequestKnowledgeBudget,
  evidenceId: EvidenceId,
): boolean {
  return budget.evidenceIds.has(evidenceId);
}
