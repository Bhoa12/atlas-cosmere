import type { CompositeSpoilerGate, ReadingCheckpointState } from "./compositeSpoilerGates";
import { isCompositeSpoilerGateUnlocked } from "./compositeSpoilerGates";
import type { WorldCatalogEntry } from "./cosmereCatalog";
import { constrainProgressToCatalog } from "./catalogConstrainedProgress";

export type CatalogCompositeSpoilerGateResult =
  | { status: "blocked"; unlocked: false; constrainedProgress: readonly ReadingCheckpointState[] }
  | { status: "resolved"; unlocked: boolean; constrainedProgress: readonly ReadingCheckpointState[] };

/**
 * Evaluates a composite spoiler gate only after every requirement has been
 * verified against one explicit catalog world. Progress is constrained to the
 * catalog first. Unknown, cross-world or ambiguous work references fail closed.
 *
 * This module evaluates metadata coordinates only. It contains no EPUB text,
 * narrative assertions or inferred relationships between works.
 */
export function resolveCatalogCompositeSpoilerGate(
  worlds: readonly WorldCatalogEntry[],
  worldId: string,
  gate: CompositeSpoilerGate,
  progress: readonly ReadingCheckpointState[],
): CatalogCompositeSpoilerGateResult {
  if (typeof worldId !== "string" || !worldId.trim() || worldId !== worldId.trim()) {
    return { status: "blocked", unlocked: false, constrainedProgress: [] };
  }

  const world = worlds.find((entry) => entry.id === worldId);
  if (!world || worlds.filter((entry) => entry.id === worldId).length !== 1) {
    return { status: "blocked", unlocked: false, constrainedProgress: [] };
  }

  const workIds = new Set<string>();
  for (const work of world.works) {
    if (!work.id || workIds.has(work.id) || work.worldId !== worldId) {
      return { status: "blocked", unlocked: false, constrainedProgress: [] };
    }
    workIds.add(work.id);
  }

  if (
    !gate.id.trim()
    || gate.requirements.length === 0
    || gate.requirements.some((requirement) => !workIds.has(requirement.workId))
  ) {
    return { status: "blocked", unlocked: false, constrainedProgress: [] };
  }

  const constrainedProgress = constrainProgressToCatalog([world], progress);

  return {
    status: "resolved",
    unlocked: isCompositeSpoilerGateUnlocked(gate, constrainedProgress),
    constrainedProgress,
  };
}
