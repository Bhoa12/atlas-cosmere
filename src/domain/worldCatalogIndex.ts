export interface CatalogWorldLink {
  workId: string;
  worldId: string;
}

/**
 * Structural index only. It associates already-cataloged work identifiers with
 * world identifiers supplied by a trusted catalog. It contains no narrative facts.
 */
export function hasValidWorldCatalogIndex(links: CatalogWorldLink[]): boolean {
  if (links.length === 0) return false;
  const pairs = new Set<string>();
  return links.every((link) => {
    if (
      typeof link.workId !== "string" || !link.workId.trim() ||
      typeof link.worldId !== "string" || !link.worldId.trim()
    ) return false;
    const key = `${link.workId}::${link.worldId}`;
    if (pairs.has(key)) return false;
    pairs.add(key);
    return true;
  });
}

export function findWorkIdsForWorld(
  links: CatalogWorldLink[],
  worldId: string,
): string[] | null {
  if (!hasValidWorldCatalogIndex(links) || typeof worldId !== "string" || !worldId.trim()) return null;
  const workIds = links.filter((link) => link.worldId === worldId).map((link) => link.workId);
  return workIds.length > 0 ? workIds : null;
}
