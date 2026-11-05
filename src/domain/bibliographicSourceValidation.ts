import { BibliographicSource } from './bibliographicSources';

export type BibliographicSourceValidationCode =
  | 'empty_source_id'
  | 'duplicate_source_id'
  | 'empty_source_label'
  | 'empty_work_title'
  | 'duplicate_work_title';

export interface BibliographicSourceValidationIssue {
  code: BibliographicSourceValidationCode;
  sourceId?: string;
  workTitle?: string;
}

/**
 * Validates provenance metadata only. It deliberately does not validate whether
 * a title's editorial content, chapter structure, or narrative claims were
 * inspected.
 */
export function validateBibliographicSources(
  sources: readonly BibliographicSource[],
): BibliographicSourceValidationIssue[] {
  const issues: BibliographicSourceValidationIssue[] = [];
  const sourceIds = new Set<string>();
  const workTitles = new Set<string>();

  for (const source of sources) {
    const id = source.id.trim();
    if (!id) {
      issues.push({ code: 'empty_source_id', sourceId: source.id });
    } else if (sourceIds.has(id)) {
      issues.push({ code: 'duplicate_source_id', sourceId: source.id });
    } else {
      sourceIds.add(id);
    }

    if (!source.label.trim()) {
      issues.push({ code: 'empty_source_label', sourceId: source.id });
    }

    for (const work of source.works) {
      const title = work.trim();
      if (!title) {
        issues.push({ code: 'empty_work_title', sourceId: source.id, workTitle: work });
        continue;
      }
      if (workTitles.has(title)) {
        issues.push({ code: 'duplicate_work_title', sourceId: source.id, workTitle: work });
      } else {
        workTitles.add(title);
      }
    }
  }

  return issues;
}

export function hasValidBibliographicSources(
  sources: readonly BibliographicSource[],
): boolean {
  return validateBibliographicSources(sources).length === 0;
}
