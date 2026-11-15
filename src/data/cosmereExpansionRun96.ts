export type ReadingUnit = {
  id: string;
  workId: string;
  position: number;
  sourceId: string;
};

export type ProgressEntry = {
  workId: string;
  completedUnitIds: string[];
};

export type SpoilerGate = {
  id: string;
  workId: string;
  requiredUnitIds: string[];
};

export type SpoilerGateAudit = {
  valid: boolean;
  reason?: "unknown-work" | "empty-requirements" | "duplicate-requirements" | "unknown-unit" | "cross-work-unit";
};

const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]));

export function auditSpoilerGate(
  gate: SpoilerGate,
  workIds: readonly string[],
  units: readonly ReadingUnit[],
): SpoilerGateAudit {
  if (!workIds.includes(gate.workId)) return { valid: false, reason: "unknown-work" };
  if (gate.requiredUnitIds.length === 0) return { valid: false, reason: "empty-requirements" };
  if (new Set(gate.requiredUnitIds).size !== gate.requiredUnitIds.length) {
    return { valid: false, reason: "duplicate-requirements" };
  }

  const unitsById = byId(units);
  for (const unitId of gate.requiredUnitIds) {
    const unit = unitsById.get(unitId);
    if (!unit) return { valid: false, reason: "unknown-unit" };
    if (unit.workId !== gate.workId) return { valid: false, reason: "cross-work-unit" };
  }

  return { valid: true };
}

export function reconcileProgress(
  workId: string,
  units: readonly ReadingUnit[],
  progress: ProgressEntry,
): string[] {
  if (progress.workId !== workId) return [];

  const validUnits = units
    .filter((unit) => unit.workId === workId)
    .sort((a, b) => a.position - b.position);

  const completed = new Set(progress.completedUnitIds);
  return validUnits.filter((unit) => completed.has(unit.id)).map((unit) => unit.id);
}

export function isGateUnlocked(
  gate: SpoilerGate,
  workIds: readonly string[],
  units: readonly ReadingUnit[],
  progress: ProgressEntry,
): boolean {
  const audit = auditSpoilerGate(gate, workIds, units);
  if (!audit.valid) return false;
  const completed = new Set(reconcileProgress(gate.workId, units, progress));
  return gate.requiredUnitIds.every((unitId) => completed.has(unitId));
}
