import type { SourceScope } from "./cosmereExpansionRun75";

export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
  label: string;
  sourceScope: SourceScope;
}

export interface ProgressSnapshot {
  workId: string;
  completedUnitIds: string[];
}

export interface SpoilerPolicy {
  requiredUnitIds: string[];
}

/**
 * Validates a reading plan without inventing chapter structure. Units must be
 * supplied explicitly by an appropriate source; private/uninspected sources
 * may not silently become editorial reading structure.
 */
export function validateReadingUnits(units: ReadingUnit[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const positions = new Set<string>();
  for (const unit of units) {
    if (!unit.id || ids.has(unit.id)) errors.push("duplicate-unit-id:" + unit.id);
    ids.add(unit.id);
    if (!unit.workId) errors.push("missing-unit-work:" + unit.id);
    if (!Number.isInteger(unit.position) || unit.position < 0) errors.push("invalid-unit-position:" + unit.id);
    const key = unit.workId + ":" + unit.position;
    if (positions.has(key)) errors.push("duplicate-unit-position:" + key);
    positions.add(key);
    if (unit.sourceScope !== "editorial-accessible") {
      errors.push("unverified-reading-structure:" + unit.id);
    }
  }
  return errors;
}

export function reconcileProgress(
  workId: string,
  units: ReadingUnit[],
  snapshots: ProgressSnapshot[],
): string[] {
  const valid = new Set(units.filter(unit => unit.workId === workId).map(unit => unit.id));
  const completed = new Set<string>();
  for (const snapshot of snapshots) {
    if (snapshot.workId !== workId) continue;
    for (const id of snapshot.completedUnitIds) if (valid.has(id)) completed.add(id);
  }
  return units
    .filter(unit => unit.workId === workId && completed.has(unit.id))
    .sort((a, b) => a.position - b.position)
    .map(unit => unit.id);
}

export function evaluateSpoilerPolicy(
  workId: string,
  units: ReadingUnit[],
  snapshots: ProgressSnapshot[],
  policy: SpoilerPolicy,
): { visible: boolean; pendingUnitIds: string[]; reason?: string } {
  const structuralErrors = validateReadingUnits(units);
  if (structuralErrors.length) return { visible: false, pendingUnitIds: [], reason: structuralErrors[0] };
  if (!policy.requiredUnitIds.length) return { visible: false, pendingUnitIds: [], reason: "empty-requirements" };
  if (new Set(policy.requiredUnitIds).size !== policy.requiredUnitIds.length) {
    return { visible: false, pendingUnitIds: [], reason: "duplicate-requirements" };
  }
  const known = new Set(units.filter(unit => unit.workId === workId).map(unit => unit.id));
  if (policy.requiredUnitIds.some(id => !known.has(id))) {
    return { visible: false, pendingUnitIds: [], reason: "unknown-required-unit" };
  }
  const completed = new Set(reconcileProgress(workId, units, snapshots));
  const pendingUnitIds = policy.requiredUnitIds.filter(id => !completed.has(id));
  return pendingUnitIds.length ? { visible: false, pendingUnitIds } : { visible: true, pendingUnitIds: [] };
}
