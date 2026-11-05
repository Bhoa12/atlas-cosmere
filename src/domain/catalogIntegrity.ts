import { BibliographicSource } from './bibliographicSources';
import { CatalogProvenance } from './catalogProvenance';
import { WorldCatalogEntry } from './cosmereCatalog';

export type CatalogIntegrityIssueCode =
  | 'unknown_catalog_work'
  | 'missing_provenance'
  | 'duplicate_provenance_link';

export interface CatalogIntegrityIssue {
  code: CatalogIntegrityIssueCode;
  workId: string;
}

/**
 * Verifies that catalog works have one explicit bibliographic link.
 * This is structural validation only: it does not inspect or infer editorial
 * content, reading units, summaries, or narrative facts.
 */
export function validateCatalogIntegrity(
  worlds: readonly WorldCatalogEntry[],
  provenance: readonly CatalogProvenance[],
  _sources: readonly BibliographicSource[],
): CatalogIntegrityIssue[] {
  const workIds = new Set(worlds.flatMap((world) => world.works.map((work) => work.id)));
  const linksByWork = new Map<string, number>();
  const issues: CatalogIntegrityIssue[] = [];

  for (const link of provenance) {
    if (!workIds.has(link.workId)) {
      issues.push({ code: 'unknown_catalog_work', workId: link.workId });
      continue;
    }
    linksByWork.set(link.workId, (linksByWork.get(link.workId) ?? 0) + 1);
  }

  for (const workId of workIds) {
    if (!linksByWork.has(workId)) issues.push({ code: 'missing_provenance', workId });
  }

  for (const [workId, count] of linksByWork) {
    if (count > 1) issues.push({ code: 'duplicate_provenance_link', workId });
  }

  return issues;
}
