import type { ReadingCheckpointState } from "./compositeSpoilerGates";
import type { WorldCatalogEntry } from "./cosmereCatalog";
import { constrainProgressToCatalog } from "./catalogConstrainedProgress";

export interface WorkProgressCoverage {
  workId: string;
  declaredPositions: number;
  completedPositions: number;
  nextPosition: number | null;
}

/**
 * Produces a catalog-backed progress summary without inferring missing units.
 * Only explicitly declared coordinates can be counted or selected as next.
 */
export function summarizeCatalogProgress(
  worlds: readonly WorldCatalogEntry[],
  progress: readonly ReadingCheckpointState[],
): readonly WorkProgressCoverage[] {
  const constrained = new Map(
    constrainProgressToCatalog(worlds, progress).map((state) => [
      state.workId,
      new Set(state.completedPositions),
    ]),
  );

  return worlds.flatMap((world) => world.works.map((work) => {
    const positions = [...new Set(work.units.map((unit) => unit.order))]
      .filter(Number.isInteger)
      .filter((position) => position > 0)
      .sort((a, b) => a - b);
    const completed = constrained.get(work.id) ?? new Set<number>();
    const nextPosition = positions.find((position) => !completed.has(position)) ?? null;

    return {
      workId: work.id,
      declaredPositions: positions.length,
      completedPositions: positions.filter((position) => completed.has(position)).length,
      nextPosition,
    };
  }));
}
