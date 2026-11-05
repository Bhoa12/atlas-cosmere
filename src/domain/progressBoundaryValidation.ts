import type { ReaderProgress, WorkCatalogEntry } from './cosmereCatalog';

export type ProgressBoundaryIssue =
  | { code: 'unknown_work'; workId: string }
  | { code: 'negative_progress'; workId: string; completedUnitOrder: number }
  | { code: 'progress_beyond_declared_structure'; workId: string; completedUnitOrder: number; maximumUnitOrder: number };

/**
 * Validates progress only against reading coordinates that are explicitly
 * declared in the catalog. Missing or incomplete structures never grant
 * additional progress.
 */
export function validateProgressBoundaries(
  works: readonly WorkCatalogEntry[],
  progress: readonly ReaderProgress[],
): ProgressBoundaryIssue[] {
  const issues: ProgressBoundaryIssue[] = [];
  const workById = new Map(works.map((work) => [work.id, work]));

  for (const item of progress) {
    const work = workById.get(item.workId);
    if (!work) {
      issues.push({ code: 'unknown_work', workId: item.workId });
      continue;
    }

    if (!Number.isInteger(item.completedUnitOrder) || item.completedUnitOrder < 0) {
      issues.push({
        code: 'negative_progress',
        workId: item.workId,
        completedUnitOrder: item.completedUnitOrder,
      });
      continue;
    }

    const maximumUnitOrder = work.units.length === 0
      ? -1
      : Math.max(...work.units.map((unit) => unit.order));

    if (item.completedUnitOrder > maximumUnitOrder) {
      issues.push({
        code: 'progress_beyond_declared_structure',
        workId: item.workId,
        completedUnitOrder: item.completedUnitOrder,
        maximumUnitOrder,
      });
    }
  }

  return issues;
}
