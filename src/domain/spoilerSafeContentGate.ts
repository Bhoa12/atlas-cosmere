import {
  BibliographicSourceEntry,
  validateBibliographicSourceManifest,
} from "./privateCosmereSourceCatalog";
import {
  ReadingProgressUnlockRequirement,
  canUnlockAtReadingUnit,
} from "./readingProgressUnlockGate";
import { ReadingUnitProgressInput } from "./readingUnitProgress";

export type ContentEvidenceStatus =
  | "unverified"
  | "structure-only"
  | "summary-backed";

export interface SpoilerSafeContentDescriptor {
  sourceId: string;
  unlock: ReadingProgressUnlockRequirement;
  evidence: ContentEvidenceStatus;
}

/**
 * Resolves whether spoiler-sensitive content may be shown.
 *
 * This is intentionally fail-closed: bibliographic presence and structural
 * evidence are never enough to show narrative content. A caller must provide
 * an explicit summary-backed evidence state and a contiguous reading progress
 * record that has completed the declared unlock unit.
 */
export function canRevealSpoilerSafeContent(
  descriptor: SpoilerSafeContentDescriptor,
  sources: readonly BibliographicSourceEntry[],
  progress: ReadingUnitProgressInput,
): boolean {
  if (
    typeof descriptor.sourceId !== "string" ||
    !descriptor.sourceId.trim() ||
    descriptor.evidence !== "summary-backed"
  ) {
    return false;
  }

  if (validateBibliographicSourceManifest(sources).length > 0) {
    return false;
  }

  const source = sources.find((entry) => entry.sourceId === descriptor.sourceId);
  if (!source || source.availability !== "declared") {
    return false;
  }

  return canUnlockAtReadingUnit(descriptor.unlock, progress);
}
