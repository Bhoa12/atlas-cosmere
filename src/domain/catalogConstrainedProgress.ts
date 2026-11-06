import type { ReadingCheckpointState } from "./compositeSpoilerGates";
import type { WorldCatalogEntry } from "./cosmereCatalog";
import { normalizeCheckpointStates } from "./readingCheckpointNormalization";

/**
 * Removes progress coordinates that are not explicitly declared by the catalog.
 * Unknown or ambiguous work ids are omitted entirely. A duplicate work id is
 * treated as unsafe rather than allowing a later catalog entry to overwrite an
 * earlier one. This is intentionally a data-safety boundary: it never adds,
 * approximates, or infers reading positions.
 */
export function constrainProgressToCatalog(
  worlds: readonly WorldCatalogEntry[],
  progress: readonly ReadingCheckpointState[],
): readonly ReadingCheckpointState[] {
  const declaredByWork = new Map<string, Set<number>>();
  const ambiguousWorkIds = new Set<string>();

  for (const world of worlds) {
    for (const work of world.works) {
      if (declaredByWork.has(work.id)) {
        ambiguousWorkIds.add(work.id);
        continue;
      }

      declaredByWork.set(
        work.id,
        new Set(
          work.units
            .map((unit) => unit.order)
            .filter((order) => Number.isInteger(order) && order > 0),
        ),
      );
    }
  }

  return normalizeCheckpointStates(progress)
    .flatMap((state) => {
      if (ambiguousWorkIds.has(state.workId)) return [];

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
