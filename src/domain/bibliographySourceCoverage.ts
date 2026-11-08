import { SourceCatalogEntry } from "./sourceCatalog";

export interface BibliographySourceCollection {
  readonly sourceCollectionId: string;
  readonly sourceIds: readonly string[];
}

export interface BibliographySourceCoverage {
  status: "complete" | "incomplete" | "blocked";
  uncoveredSourceIds: readonly string[];
}

/**
 * Verifies explicit collection-level provenance without reading private text.
 * Every catalog source must be assigned to exactly one declared collection.
 * No collection membership is inferred from titles, filenames, or external
 * editorial knowledge.
 */
export function resolveBibliographySourceCoverage(
  catalog: readonly SourceCatalogEntry[],
  collections: readonly BibliographySourceCollection[],
): BibliographySourceCoverage {
  if (catalog.length === 0 || collections.length === 0) {
    return { status: "blocked", uncoveredSourceIds: [] };
  }

  const catalogIds = new Set<string>();
  for (const source of catalog) {
    if (!source.id || catalogIds.has(source.id)) {
      return { status: "blocked", uncoveredSourceIds: [] };
    }
    catalogIds.add(source.id);
  }

  const collectionIds = new Set<string>();
  const assigned = new Set<string>();
  for (const collection of collections) {
    if (!collection.sourceCollectionId || collectionIds.has(collection.sourceCollectionId)) {
      return { status: "blocked", uncoveredSourceIds: [] };
    }
    collectionIds.add(collection.sourceCollectionId);
    if (collection.sourceIds.length === 0) {
      return { status: "blocked", uncoveredSourceIds: [] };
    }
    for (const sourceId of collection.sourceIds) {
      if (!catalogIds.has(sourceId) || assigned.has(sourceId)) {
        return { status: "blocked", uncoveredSourceIds: [] };
      }
      assigned.add(sourceId);
    }
  }

  const uncoveredSourceIds = catalog
    .map((source) => source.id)
    .filter((sourceId) => !assigned.has(sourceId));

  return uncoveredSourceIds.length === 0
    ? { status: "complete", uncoveredSourceIds: [] }
    : { status: "incomplete", uncoveredSourceIds };
}
