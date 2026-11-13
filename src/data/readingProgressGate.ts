export type ReadingUnitStatus = "completed" | "in-progress";

export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
  label: string;
}

export interface ReadingProgress {
  workId: string;
  completedUnitIds: string[];
}

export interface SpoilerGate {
  workId: string;
  requiredUnitIds: string[];
}

/**
 * Conservative anti-spoiler resolver.
 * Metadata is authoritative: this module never infers chapters, order,
 * world membership, or editorial facts from titles or private files.
 */
export function canReveal(
  gate: SpoilerGate,
  units: ReadingUnit[],
  progress: ReadingProgress,
): boolean {
  if (gate.workId !== progress.workId || gate.requiredUnitIds.length === 0) return false;
  if (new Set(gate.requiredUnitIds).size !== gate.requiredUnitIds.length) return false;

  const byId = new Map(units.map((unit) => [unit.id, unit]));
  for (const id of gate.requiredUnitIds) {
    const unit = byId.get(id);
    if (!unit || unit.workId !== gate.workId || !progress.completedUnitIds.includes(id)) {
      return false;
    }
  }
  return true;
}

export function validateReadingUnits(units: ReadingUnit[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const positions = new Set<string>();

  for (const unit of units) {
    if (!/^[a-z0-9-]+$/.test(unit.id)) errors.push(`invalid unit id: ${unit.id}`);
    if (ids.has(unit.id)) errors.push(`duplicate unit id: ${unit.id}`);
    ids.add(unit.id);
    if (!Number.isInteger(unit.position) || unit.position < 1) {
      errors.push(`invalid position: ${unit.id}`);
    }
    const key = `${unit.workId}:${unit.position}`;
    if (positions.has(key)) errors.push(`duplicate position: ${key}`);
    positions.add(key);
  }
  return errors;
}
