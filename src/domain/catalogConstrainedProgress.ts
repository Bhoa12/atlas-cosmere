import type { ReadingCheckpointState } from "./compositeSpoilerGates";
import type { WorldCatalogEntry } from "./cosmereCatalog";
import { normalizeCheckpointStates } from "./readingCheckpointNormalization";

/**
 * Removes progress coordinates that are not explicitly declared by the catalog.
 * Unknown works are omitted entirely. This is intentionally a data-safety
 * boundary: it never adds, approximates, or infers reading positions.
 */
export function constrainProgressToCatalog(
  worlds: readonly WorldCatalogEntry[],
  progress: readonly ReadingCheckpointState[],
): readonly ReadingCheckpointState[] {
  const declaredByWork = new Map<string, Set<number>>();

  for (const world of worlds) {
    for (const work of world.works) {
      declaredByWork.set(
        work.id,
        new Set(work.units.map((unit) => unit.order)),
      );
    }
  }

  return normalizeCheckpointStates(progress)
    .flatMap((state) => {
      const declared = declaredByWork.get(state.workId);
      if (!declared) return [];

      const completedPositions = state.completedPositions.filter((position) =>
        declared.has(position),
      );
      return completedPositions.length > 0
        ? [{ workId: state.workId, completedPositions }]
        : [];
    });
}
