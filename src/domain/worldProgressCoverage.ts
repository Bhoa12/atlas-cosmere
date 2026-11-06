import type { ReadingCheckpointState } from "./compositeSpoilerGates";
import type { WorldCatalogEntry } from "./cosmereCatalog";
import { summarizeCatalogProgress, type WorkProgressCoverage } from "./catalogProgressCoverage";

/**
 * World-level progress summary derived only from declared catalog coordinates.
 * Duplicate work ids are treated as ambiguous and are excluded from world
 * totals, matching the fail-closed progress constraint.
 */
export interface WorldProgressCoverage {
  worldId: string;
  declaredPositions: number;
  completedPositions: number;
  next: { workId: string; position: number } | null;
  ambiguousWorkIds: readonly string[];
}

function workOccurrences(worlds: readonly WorldCatalogEntry[]): Map<string, number> {
  const occurrences = new Map<string, number>();
  for (const world of worlds) {
    for (const work of world.works) {
      occurrences.set(work.id, (occurrences.get(work.id) ?? 0) + 1);
    }
  }
  return occurrences;
}

export function summarizeWorldProgress(
  worlds: readonly WorldCatalogEntry[],
  progress: readonly ReadingCheckpointState[],
): readonly WorldProgressCoverage[] {
  const occurrences = workOccurrences(worlds);
  const ambiguous = new Set(
    [...occurrences.entries()]
      .filter(([, count]) => count > 1)
      .map(([workId]) => workId),
  );
  const byWork = new Map<string, WorkProgressCoverage>(
    summarizeCatalogProgress(worlds, progress)
      .filter((coverage) => !ambiguous.has(coverage.workId))
      .map((coverage) => [coverage.workId, coverage]),
  );

  return worlds.map((world) => {
    const ambiguousWorkIds = [...new Set(
      world.works.map((work) => work.id).filter((id) => ambiguous.has(id)),
    )].sort();

    const coverages = world.works
      .map((work) => byWork.get(work.id))
      .filter((coverage): coverage is WorkProgressCoverage => coverage !== undefined);

    const candidates = world.works
      .map((work) => ({
        work,
        coverage: byWork.get(work.id),
      }))
      .filter((item) => item.coverage?.nextPosition !== null && item.coverage !== undefined)
      .map((item) => ({
        workId: item.work.id,
        sequence: item.work.sequence,
        position: item.coverage!.nextPosition!,
      }));

    return {
      worldId: world.id,
      declaredPositions: coverages.reduce((total, item) => total + item.declaredPositions, 0),
      completedPositions: coverages.reduce((total, item) => total + item.completedPositions, 0),
      next: (() => {
        const candidate = candidates.sort((a, b) =>
          a.sequence - b.sequence || a.position - b.position || a.workId.localeCompare(b.workId),
        )[0];
        return candidate ? { workId: candidate.workId, position: candidate.position } : null;
      })(),
      ambiguousWorkIds,
    };
  });
}
