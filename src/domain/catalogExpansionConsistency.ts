import type { ReadingUnit, ReadingProgress } from "./readingProgress";

export interface CatalogExpansionConsistencyIssue {
  code: "unknown_work" | "foreign_unit";
  layer: "reading_unit" | "progress";
  workId: string;
  unitId?: string;
}

/**
 * Checks that reusable reading metadata only refers to explicitly declared
 * works. It deliberately does not infer missing works or reading structure.
 */
export function validateCatalogExpansionConsistency(
  knownWorkIds: readonly string[],
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgress[],
): readonly CatalogExpansionConsistencyIssue[] {
  const issues: CatalogExpansionConsistencyIssue[] = [];
  const known = new Set(knownWorkIds);
  const unitIdsByWork = new Map<string, Set<string>>();

  for (const unit of units) {
    if (!known.has(unit.workId)) {
      issues.push({ code: "unknown_work", layer: "reading_unit", workId: unit.workId, unitId: unit.id });
      continue;
    }
    const ids = unitIdsByWork.get(unit.workId) ?? new Set<string>();
    ids.add(unit.id);
    unitIdsByWork.set(unit.workId, ids);
  }

  for (const entry of progress) {
    if (!known.has(entry.workId)) {
      issues.push({ code: "unknown_work", layer: "progress", workId: entry.workId });
      continue;
    }
    const validIds = unitIdsByWork.get(entry.workId) ?? new Set<string>();
    for (const unitId of new Set(entry.completedUnitIds)) {
      if (!validIds.has(unitId)) {
        issues.push({ code: "foreign_unit", layer: "progress", workId: entry.workId, unitId });
      }
    }
  }

  return issues;
}
