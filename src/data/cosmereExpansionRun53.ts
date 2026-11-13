/**
 * Conservative unlock evaluator for spoiler-gated Atlas content.
 * This module contains no editorial text and makes no inferred world assignments.
 */
export type ReadingUnit = { id: string; workId: string; order: number };
export type Progress = { workId: string; completedUnitIds: string[] };
export type SpoilerGate = { workId: string; requiredUnitIds: string[] };

export function evaluateSpoilerGate(
  gate: SpoilerGate,
  units: readonly ReadingUnit[],
  progress: Progress | undefined,
): { revealed: boolean; reason: string } {
  if (!progress || progress.workId !== gate.workId) return { revealed: false, reason: "missing-or-mismatched-progress" };
  if (gate.requiredUnitIds.length === 0) return { revealed: false, reason: "empty-requirements" };
  if (new Set(gate.requiredUnitIds).size !== gate.requiredUnitIds.length) return { revealed: false, reason: "duplicate-requirements" };
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  for (const id of gate.requiredUnitIds) {
    const unit = byId.get(id);
    if (!unit || unit.workId !== gate.workId) return { revealed: false, reason: "invalid-required-unit" };
    if (!progress.completedUnitIds.includes(id)) return { revealed: false, reason: "incomplete-progress" };
  }
  return { revealed: true, reason: "all-requirements-complete" };
}
