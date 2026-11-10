import { listCatalogWorksForWorld } from "./cosmereSourceCatalog";

export type CatalogReadingBoundary = {
  worldId: string;
  workIds: readonly string[];
};

/**
 * Resolves a world-local reading boundary from verified catalog metadata.
 *
 * The caller supplies only work identifiers; this function verifies that every
 * identifier belongs to the requested world and that no identifier is repeated.
 * It does not infer reading order or inspect protected EPUB text.
 */
export function resolveCatalogReadingBoundary(
  worldId: string,
  workIds: readonly string[],
): CatalogReadingBoundary | null {
  if (
    typeof worldId !== "string" ||
    worldId.length === 0 ||
    worldId.trim() !== worldId ||
    !Array.isArray(workIds) ||
    workIds.length === 0
  ) {
    return null;
  }

  const catalogIds = new Set(
    listCatalogWorksForWorld(worldId).map((work) => work.id),
  );
  const seen = new Set<string>();

  for (const workId of workIds) {
    if (
      typeof workId !== "string" ||
      workId.length === 0 ||
      workId.trim() !== workId ||
      !catalogIds.has(workId) ||
      seen.has(workId)
    ) {
      return null;
    }
    seen.add(workId);
  }

  return { worldId, workIds: [...workIds] };
}
