export type SourceAccessStatus = "cataloged" | "verified-structure";

export interface SourceCatalogEntry {
  id: string;
  title: string;
  sourceCollectionId: string;
  access: SourceAccessStatus;
}

/**
 * Bibliographic catalog only. Entries identify works supplied as private sources;
 * they do not imply that narrative text, chapter structure, or facts were read.
 */
export function hasValidSourceCatalog(entries: SourceCatalogEntry[]): boolean {
  if (entries.length === 0) return false;
  const ids = new Set<string>();
  return entries.every((entry) => {
    if (
      typeof entry.id !== "string" ||
      !entry.id.trim() ||
      typeof entry.title !== "string" ||
      !entry.title.trim() ||
      typeof entry.sourceCollectionId !== "string" ||
      !entry.sourceCollectionId.trim() ||
      (entry.access !== "cataloged" && entry.access !== "verified-structure") ||
      ids.has(entry.id)
    ) return false;
    ids.add(entry.id);
    return true;
  });
}

export function findCatalogEntry(
  entries: SourceCatalogEntry[],
  id: string,
): SourceCatalogEntry | null {
  if (!hasValidSourceCatalog(entries) || typeof id !== "string" || !id.trim()) return null;
  const matches = entries.filter((entry) => entry.id === id);
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Returns all entries belonging to one declared source collection. The catalog is
 * validated first so malformed metadata cannot produce a partial result.
 */
export function findCatalogEntriesBySource(
  entries: SourceCatalogEntry[],
  sourceCollectionId: string,
): readonly SourceCatalogEntry[] {
  if (!hasValidSourceCatalog(entries) || typeof sourceCollectionId !== "string" || !sourceCollectionId.trim()) {
    return [];
  }
  return entries.filter((entry) => entry.sourceCollectionId === sourceCollectionId);
}
