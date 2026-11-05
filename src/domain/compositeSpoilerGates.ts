/**
 * Explicit spoiler-gate dependencies for content whose visibility may require
 * more than one verified reading checkpoint. This module contains metadata
 * only and never infers narrative relationships.
 */
export interface SpoilerRequirement {
  workId: string;
  requiredPosition: number;
}

export interface CompositeSpoilerGate {
  id: string;
  requirements: readonly SpoilerRequirement[];
}

export interface ReadingCheckpointState {
  workId: string;
  completedPositions: readonly number[];
}

function validRequirement(requirement: SpoilerRequirement): boolean {
  return Boolean(requirement.workId.trim())
    && Number.isInteger(requirement.requiredPosition)
    && requirement.requiredPosition > 0;
}

export function isCompositeSpoilerGateUnlocked(
  gate: CompositeSpoilerGate,
  progress: readonly ReadingCheckpointState[],
): boolean {
  if (!gate.id.trim() || gate.requirements.length === 0) return false;
  if (!gate.requirements.every(validRequirement)) return false;

  return gate.requirements.every((requirement) =>
    progress.some((state) =>
      state.workId === requirement.workId
      && state.completedPositions.includes(requirement.requiredPosition),
    ),
  );
}

export function filterUnlockedCompositeGateIds(
  gates: readonly CompositeSpoilerGate[],
  progress: readonly ReadingCheckpointState[],
): readonly string[] {
  return gates
    .filter((gate) => isCompositeSpoilerGateUnlocked(gate, progress))
    .map((gate) => gate.id);
}
