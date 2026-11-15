/**
 * Run 102: coverage audit for a conservative Cosmere source catalog.
 * This module works only with declared metadata. It never derives editorial
 * structure or narrative facts from a title or from a private source.
 */

export type SourceAccess = "declared-private" | "verified-index" | "editorial-accessible";

export interface CatalogSource {
  id: string;
  access: SourceAccess;
  accessible: boolean;
}

export interface CatalogWork {
  id: string;
  title: string;
  sourceId: string;
}

export interface ReadingUnit {
  id: string;
  workId: string;
  sourceId: string;
  accessible: boolean;
}

export interface CatalogCoverage {
  workId: string;
  title: string;
  cataloged: boolean;
  hasAccessibleReadingStructure: boolean;
  sourceAccess?: SourceAccess;
}

export function auditCatalogCoverage(
  sources: readonly CatalogSource[],
  works: readonly CatalogWork[],
  units: readonly ReadingUnit[],
): CatalogCoverage[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const seenWorks = new Set<string>();

  for (const work of works) {
    if (!work.id || !work.title || seenWorks.has(work.id)) {
      throw new Error("Catalog works require unique non-empty identifiers and titles.");
    }
    if (!sourceById.has(work.sourceId)) {
      throw new Error(`Unknown source for work: ${work.id}`);
    }
    seenWorks.add(work.id);
  }

  const accessibleStructure = new Set(
    units
      .filter((unit) => {
        const source = sourceById.get(unit.sourceId);
        return Boolean(
          unit.id &&
            unit.accessible &&
            source?.accessible &&
            source.access === "editorial-accessible",
        );
      })
      .map((unit) => unit.workId),
  );

  return works.map((work) => ({
    workId: work.id,
    title: work.title,
    cataloged: true,
    hasAccessibleReadingStructure: accessibleStructure.has(work.id),
    sourceAccess: sourceById.get(work.sourceId)?.access,
  }));
}
