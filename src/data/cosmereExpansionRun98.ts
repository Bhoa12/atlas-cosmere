/**
 * Catalog query helpers built on verified metadata only.
 *
 * These helpers deliberately preserve provenance boundaries: they search titles
 * and identifiers but never infer narrative facts, chronology, chapter
 * structure, or world membership.
 */

export interface SearchableCatalogWork {
  id: string;
  title: string;
  sourceId: string;
}

export interface CatalogSearchResult {
  work: SearchableCatalogWork;
  match: "id" | "title";
}

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase("es-ES");

export function searchCatalogWorks(
  works: SearchableCatalogWork[],
  query: string,
): CatalogSearchResult[] {
  const needle = normalize(query);
  if (!needle) return [];

  return works
    .map(work => {
      const id = normalize(work.id);
      const title = normalize(work.title);
      if (id.includes(needle)) return { work, match: "id" as const };
      if (title.includes(needle)) return { work, match: "title" as const };
      return null;
    })
    .filter((result): result is CatalogSearchResult => result !== null);
}

export function groupCatalogWorksBySource(
  works: SearchableCatalogWork[],
): ReadonlyMap<string, SearchableCatalogWork[]> {
  const grouped = new Map<string, SearchableCatalogWork[]>();

  for (const work of works) {
    const current = grouped.get(work.sourceId) ?? [];
    current.push(work);
    grouped.set(work.sourceId, current);
  }

  return grouped;
}
