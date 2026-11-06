import type { BibliographicSourceEntry } from "./privateCosmereSourceCatalog";

export interface SourceCatalogCoverage {
  declaredSourceIds: readonly string[];
  declaredCount: number;
  missingExpectedSourceIds: readonly string[];
  unexpectedDeclaredSourceIds: readonly string[];
}

/**
 * Compares a declared source manifest with an explicit expected ID list.
 * This is bibliographic coverage only: it never claims that a source was read,
 * parsed, or editorially verified.
 */
export function summarizeSourceCatalogCoverage(
  sources: readonly BibliographicSourceEntry[],
  expectedSourceIds: readonly string[],
): SourceCatalogCoverage {
  const declared = new Set(sources.map((source) => source.sourceId));
  const expected = new Set(expectedSourceIds);

  return {
    declaredSourceIds: [...declared].sort(),
    declaredCount: declared.size,
    missingExpectedSourceIds: [...expected].filter((id) => !declared.has(id)).sort(),
    unexpectedDeclaredSourceIds: [...declared].filter((id) => !expected.has(id)).sort(),
  };
}
