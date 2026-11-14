export type CatalogEvidence = "verified-index" | "declared-private" | "editorial-accessible";

export interface SourceRecord {
  id: string;
  evidence: CatalogEvidence;
  accessible: boolean;
}

export interface CatalogWork {
  id: string;
  title: string;
  sourceId: string;
}

/**
 * Returns only works whose existence is backed by a declared catalog source.
 * It intentionally makes no claim about a work's world, chapter structure,
 * chronology, or narrative content.
 */
export function listCatalogWorks(
  works: CatalogWork[],
  sources: SourceRecord[],
): CatalogWork[] {
  const known = new Set(sources.map(source => source.id));
  return works.filter(work => known.has(work.sourceId) && Boolean(work.id) && Boolean(work.title));
}

/**
 * Editorial summaries require a source that is both explicitly classified as
 * accessible and actually marked accessible. This prevents a private EPUB
 * declaration or a verified index from being treated as inspected prose.
 */
export function canBackEditorialSummary(
  sourceId: string,
  sources: SourceRecord[],
): boolean {
  const source = sources.find(candidate => candidate.id === sourceId);
  return source?.evidence === "editorial-accessible" && source.accessible === true;
}

export function validateCatalogSources(
  works: CatalogWork[],
  sources: SourceRecord[],
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const source of sources) {
    if (!source.id || ids.has(source.id)) errors.push("duplicate-source-id:" + source.id);
    ids.add(source.id);
    if (source.evidence !== "editorial-accessible" && source.accessible) {
      errors.push("inconsistent-source-access:" + source.id);
    }
  }
  for (const work of works) {
    if (!work.id) errors.push("missing-work-id");
    if (!work.title) errors.push("missing-work-title:" + work.id);
    if (!ids.has(work.sourceId)) errors.push("unknown-work-source:" + work.id);
  }
  return errors;
}
