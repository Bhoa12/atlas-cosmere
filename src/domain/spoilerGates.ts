/**
 * Explicit, data-driven spoiler gates. A gate is never inferred from narrative
 * content: callers must declare the work and reading position that unlock it.
 */
export interface SpoilerGate {
  id: string;
  workId: string;
  requiredPosition: number;
}

export interface WorkReadingState {
  workId: string;
  completedPositions: readonly number[];
}

export function isSpoilerGateUnlocked(
  gate: SpoilerGate,
  progress: readonly WorkReadingState[],
): boolean {
  if (!gate.id.trim() || !gate.workId.trim()) return false;
  if (!Number.isInteger(gate.requiredPosition) || gate.requiredPosition <= 0) {
    return false;
  }

  const state = progress.find((entry) => entry.workId === gate.workId);
  if (!state) return false;

  return state.completedPositions.includes(gate.requiredPosition);
}

export function filterUnlockedGateIds(
  gates: readonly SpoilerGate[],
  progress: readonly WorkReadingState[],
): readonly string[] {
  return gates
    .filter((gate) => isSpoilerGateUnlocked(gate, progress))
    .map((gate) => gate.id);
}
