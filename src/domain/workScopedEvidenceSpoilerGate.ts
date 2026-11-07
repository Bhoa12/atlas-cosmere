import { BibliographicSourceEntry } from "./privateCosmereSourceCatalog";
import { NarrativeEvidenceRecord, hasRegisteredSummaryEvidence } from "./narrativeEvidenceRegistry";
import { canRevealWorkScopedPosition } from "./workScopedSpoilerAccess";
import { SourceWorkBinding, isSourceBoundToWork } from "./sourceWorkBinding";

export interface WorkScopedEvidenceSpoilerInput {
  sourceId: string;
  evidenceId: string;
  worldId: string;
  contentWorldId: string;
  workId: string;
  contentWorkId: string;
  requiredPosition: number;
  safeCompletedPositions: number;
  declaredPositions: number;
}

/**
 * Composes provenance and reading scope without carrying narrative content.
 * A source-level summary record cannot authorize content from a different
 * world or work, and a completed position cannot bypass missing provenance.
 */
export function canRevealWorkScopedEvidenceContent(
  input: WorkScopedEvidenceSpoilerInput,
  sources: readonly BibliographicSourceEntry[],
  evidence: readonly NarrativeEvidenceRecord[],
  bindings: readonly SourceWorkBinding[],
): boolean {
  if (
    typeof input.sourceId !== "string" ||
    !input.sourceId.trim() ||
    typeof input.evidenceId !== "string" ||
    !input.evidenceId.trim()
  ) return false;

  const source = sources.find((entry) => entry.sourceId === input.sourceId);
  if (!source || source.availability !== "declared") return false;

  if (!hasRegisteredSummaryEvidence(input.evidenceId, input.sourceId, evidence)) {
    return false;
  }

  if (!isSourceBoundToWork(input.sourceId, input.contentWorkId, bindings)) {
    return false;
  }

  return canRevealWorkScopedPosition(input);
}
