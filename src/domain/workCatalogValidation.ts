export interface WorldCatalogEntry {
  id: string;
  name: string;
}

export interface WorkCatalogEntry {
  id: string;
  worldId: string;
  title: string;
  sourceId: string;
}

/**
 * Validates catalog relationships using metadata only.
 * It intentionally does not infer a world's identity, narrative chronology,
 * publication order, or editorial facts from a title.
 */
export function validateWorldCatalog(entries: readonly WorldCatalogEntry[]): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.id.trim()) issues.push('world id must not be empty');
    else if (ids.has(entry.id)) issues.push(`duplicate world id: ${entry.id}`);
    else ids.add(entry.id);
    if (!entry.name.trim()) issues.push(`world name must not be empty: ${entry.id}`);
  }
  return issues;
}

export function validateWorkCatalog(
  worlds: readonly WorldCatalogEntry[],
  works: readonly WorkCatalogEntry[],
): string[] {
  const issues = validateWorldCatalog(worlds);
  const worldIds = new Set(worlds.map((world) => world.id));
  const workIds = new Set<string>();

  for (const work of works) {
    if (!work.id.trim()) issues.push('work id must not be empty');
    else if (workIds.has(work.id)) issues.push(`duplicate work id: ${work.id}`);
    else workIds.add(work.id);

    if (!work.worldId.trim()) issues.push(`work worldId must not be empty: ${work.id}`);
    else if (!worldIds.has(work.worldId)) issues.push(`unknown worldId: ${work.worldId}`);

    if (!work.title.trim()) issues.push(`work title must not be empty: ${work.id}`);
    if (!work.sourceId.trim()) issues.push(`work sourceId must not be empty: ${work.id}`);
  }

  return issues;
}
