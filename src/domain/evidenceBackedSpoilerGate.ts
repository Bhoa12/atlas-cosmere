import { BibliographicSourceEntry } from "./privateCosmereSourceCatalog";
import { NarrativeEvidenceRecord, hasRegisteredSummaryEvidence } from "./narrativeEvidenceRegistry";
import { ReadingUnitProgressInput } from "./readingUnitProgress";
import { ReadingProgressUnlockRequirement, canUnlockAtReadingUnit } from "./readingProgressUnlockGate";

export interface EvidenceBackedSpoilerDescriptor {
  sourceId: string;
  evidenceId: string;
  unlock: ReadingProgressUnlockRequirement;
}

/**
 * Strict spoiler gate that requires both registered summary provenance and
 * contiguous reading progress. It stores no narrative text and fails closed
 * whenever source, evidence, or progress validation is incomplete.
 */
export function canRevealEvidenceBackedContent(
  descriptor: EvidenceBackedSpoilerDescriptor,
  sources: readonly BibliographicSourceEntry[],
  evidence: readonly NarrativeEvidenceRecord[],
  progress: ReadingUnitProgressInput,
): boolean {
  if (
    typeof descriptor.sourceId !== "string" || !descriptor.sourceId.trim() ||
    typeof descriptor.evidenceId !== "string" || !descriptor.evidenceId.trim()
  ) return false;

  const source = sources.find((entry) => entry.sourceId === descriptor.sourceId);
  if (!source || source.availability !== "declared") return false;

  if (!hasRegisteredSummaryEvidence(descriptor.evidenceId, descriptor.sourceId, evidence)) {
    return false;
  }

  return canUnlockAtReadingUnit(descriptor.unlock, progress);
}
