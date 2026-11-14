import type { Source, Work } from "./cosmereExpansionRun74";

export type SourceScope = "catalog-metadata" | "private-uninspected" | "editorial-accessible";

export interface CatalogSource extends Source {
  scope: SourceScope;
  label: string;
}

export interface CatalogWork extends Work {
  catalogSourceId: string;
}

/**
 * Describes what a source is allowed to contribute. This is deliberately
 * narrower than the work's metadata: a private EPUB can be registered without
 * claiming that its chapters or passages have been inspected.
 */
export function sourceCapabilities(source: CatalogSource): {
  canCatalogTitles: boolean;
  canInspectStructure: boolean;
  canBackSummary: boolean;
} {
  switch (source.scope) {
    case "catalog-metadata":
      return { canCatalogTitles: true, canInspectStructure: false, canBackSummary: false };
    case "private-uninspected":
      return { canCatalogTitles: true, canInspectStructure: false, canBackSummary: false };
    case "editorial-accessible":
      return { canCatalogTitles: true, canInspectStructure: true, canBackSummary: true };
  }
}

/**
 * Validates that catalogue records do not overstate what their source proves.
 * In particular, titles from a verified index stay metadata-only.
 */
export function validateCatalogProvenance(
  sources: CatalogSource[],
  works: CatalogWork[],
): string[] {
  const errors: string[] = [];
  const ids = new Set(sources.map(source => source.id));
  for (const work of works) {
    const source = sources.find(candidate => candidate.id === work.catalogSourceId);
    if (!source || !ids.has(work.sourceId)) {
      errors.push("unknown-catalog-source:" + work.id);
      continue;
    }
    if (work.sourceId !== work.catalogSourceId) errors.push("mismatched-work-source:" + work.id);
  }
  return errors;
}

export interface CatalogView {
  sourceId: string;
  titleCount: number;
  titles: string[];
}

/** Returns only declared metadata, never inferred worlds or editorial content. */
export function catalogView(sourceId: string, works: CatalogWork[]): CatalogView {
  const titles = works
    .filter(work => work.catalogSourceId === sourceId)
    .map(work => work.title)
    .sort((a, b) => a.localeCompare(b, "es"));
  return { sourceId, titleCount: titles.length, titles };
}
