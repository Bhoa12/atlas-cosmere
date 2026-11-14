/**
 * Hoid IA: immutable request knowledge boundary.
 *
 * This module contains no narrative text. It turns the evidence identifiers
 * already approved for one request into an immutable capability set.
 * Providers receive the resulting set but cannot mint new capabilities.
 */

export type EvidenceId = string;

export interface AuthorizedEvidence {
  readonly id: EvidenceId;
  readonly workId: string;
  readonly chapter: number;
}

export interface KnowledgeBoundary {
  readonly evidenceIds: ReadonlySet<EvidenceId>;
  allows(id: EvidenceId): boolean;
}

export function createKnowledgeBoundary(
  evidence: readonly AuthorizedEvidence[],
): KnowledgeBoundary {
  const ids = new Set<EvidenceId>();
  for (const item of evidence) {
    if (!item.id.trim()) throw new Error("Evidence id must be non-empty");
    if (!item.workId.trim()) throw new Error("Work id must be non-empty");
    if (!Number.isInteger(item.chapter) || item.chapter < 1) {
      throw new Error("Evidence chapter must be a positive integer");
    }
    ids.add(item.id);
  }

  const snapshot = new Set(ids);
  return Object.freeze({
    evidenceIds: snapshot,
    allows(id: EvidenceId): boolean {
      return snapshot.has(id);
    },
  });
}

export function verifyEvidenceReferences(
  boundary: KnowledgeBoundary,
  references: readonly EvidenceId[],
): readonly EvidenceId[] {
  return Object.freeze(
    [...new Set(references)].filter((id) => boundary.allows(id)),
  );
}
