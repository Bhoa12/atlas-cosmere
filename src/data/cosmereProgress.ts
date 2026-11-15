import type { ExpansionCatalog, ReadingUnit } from './cosmereCatalog';

/**
 * Work-scoped progress helpers.
 *
 * Progress is accepted only for explicit, auditable reading units. This module
 * does not infer chapters or treat catalog titles as completed content.
 */
export interface WorkProgress {
  workId: string;
  completedUnitIds: readonly string[];
}

export interface ProgressSnapshot {
  workId: string;
  completedUnitIds: string[];
  totalKnownUnits: number;
  completedKnownUnits: number;
  isComplete: boolean;
}

function unitsForWork(catalog: ExpansionCatalog, workId: string): ReadingUnit[] {
  return catalog.readingUnits
    .filter((unit) => unit.workId === workId)
    .sort((left, right) => left.position - right.position);
}

/**
 * Reconciles a user-provided progress record against explicit units for one
 * work. Unknown IDs and IDs belonging to another work are ignored.
 */
export function reconcileWorkProgress(
  catalog: ExpansionCatalog,
  progress: WorkProgress,
): ProgressSnapshot {
  const workExists = catalog.works.some((work) => work.id === progress.workId);
  if (!workExists) {
    return {
      workId: progress.workId,
      completedUnitIds: [],
      totalKnownUnits: 0,
      completedKnownUnits: 0,
      isComplete: false,
    };
  }

  const units = unitsForWork(catalog, progress.workId);
  const knownIds = new Set(units.map((unit) => unit.id));
  const completed = new Set(progress.completedUnitIds);
  const completedUnitIds = units
    .filter((unit) => completed.has(unit.id) && knownIds.has(unit.id))
    .map((unit) => unit.id);

  return {
    workId: progress.workId,
    completedUnitIds,
    totalKnownUnits: units.length,
    completedKnownUnits: completedUnitIds.length,
    // An empty reading structure is intentionally not treated as completion.
    isComplete: units.length > 0 && completedUnitIds.length === units.length,
  };
}

/**
 * Returns the first explicit unit not yet completed. No recommendation is made
 * when the work has no accessible reading structure.
 */
export function nextReadingUnit(
  catalog: ExpansionCatalog,
  progress: WorkProgress,
): ReadingUnit | null {
  const snapshot = reconcileWorkProgress(catalog, progress);
  if (snapshot.totalKnownUnits === 0) return null;

  const completed = new Set(snapshot.completedUnitIds);
  return unitsForWork(catalog, progress.workId)
    .find((unit) => !completed.has(unit.id)) ?? null;
}
