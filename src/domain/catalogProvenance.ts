import { BibliographicSource } from './bibliographicSources';
import { WorkCatalogEntry, WorldCatalogEntry } from './cosmereCatalog';

export type CatalogProvenanceIssueCode =
  | 'unknown_source'
  | 'work_not_declared_by_source'
  | 'duplicate_catalog_work_id';

export interface CatalogProvenance {
  workId: string;
  sourceId: string;
}

export interface CatalogProvenanceIssue {
  code: CatalogProvenanceIssueCode;
  workId: string;
  sourceId?: string;
}

/**
 * Validates only explicit links between catalog entries and declared
 * bibliographic metadata. Missing links are reported rather than inferred.
 */
export function validateCatalogProvenance(
  worlds: readonly WorldCatalogEntry[],
  provenance: readonly CatalogProvenance[],
  sources: readonly BibliographicSource[],
): CatalogProvenanceIssue[] {
  const issues: CatalogProvenanceIssue[] = [];
  const titlesByWorkId = new Map<string, string>();
  const duplicateWorkIds = new Set<string>();

  for (const world of worlds) {
    for (const work of world.works) {
      if (titlesByWorkId.has(work.id)) duplicateWorkIds.add(work.id);
      titlesByWorkId.set(work.id, work.title);
    }
  }

  for (const workId of duplicateWorkIds) {
    issues.push({ code: 'duplicate_catalog_work_id', workId });
  }

  const sourceById = new Map(sources.map((source) => [source.id, source]));

  for (const link of provenance) {
    const source = sourceById.get(link.sourceId);
    if (!source) {
      issues.push({
        code: 'unknown_source',
        workId: link.workId,
        sourceId: link.sourceId,
      });
      continue;
    }

    const title = titlesByWorkId.get(link.workId);
    if (title && !source.works.includes(title)) {
      issues.push({
        code: 'work_not_declared_by_source',
        workId: link.workId,
        sourceId: link.sourceId,
      });
    }
  }

  return issues;
}

export function flattenCatalogWorks(
  worlds: readonly WorldCatalogEntry[],
): readonly WorkCatalogEntry[] {
  return worlds.flatMap((world) => world.works);
}
