import { CatalogWorldLink, hasValidWorldCatalogIndex } from "./worldCatalogIndex";
import { ReadingUnitProgressInput, hasConsistentReadingUnitProgress } from "./readingUnitProgress";
import { SourceCatalogEntry, findCatalogEntry } from "./sourceCatalog";

export interface WorldReadingCoverage {
  worldId: string;
  catalogLinks: CatalogWorldLink[];
  sources: SourceCatalogEntry[];
  progressByWorkId: Record<string, ReadingUnitProgressInput>;
}

/**
 * Structural coverage only. A work contributes to a world's readable coverage
 * only when its catalog link is valid, its source is explicitly marked
 * verified-structure, and its declared reading progress is internally
 * consistent. Missing or ambiguous evidence blocks the whole world result.
 */
export function hasVerifiedWorldReadingCoverage(
  input: WorldReadingCoverage,
): boolean {
  if (
    typeof input.worldId !== "string" ||
    !input.worldId.trim() ||
    !hasValidWorldCatalogIndex(input.catalogLinks)
  ) return false;

  const workIds = input.catalogLinks
    .filter((link) => link.worldId === input.worldId)
    .map((link) => link.workId);

  if (workIds.length === 0) return false;

  return workIds.every((workId) => {
    const source = findCatalogEntry(input.sources, workId);
    const progress = input.progressByWorkId[workId];
    return source?.access === "verified-structure" &&
      progress !== undefined &&
      hasConsistentReadingUnitProgress(progress);
  });
}
