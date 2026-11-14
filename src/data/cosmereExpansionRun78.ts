export interface WorldRecord {
  id: string;
  name: string;
}
export interface CatalogWork {
  id: string;
  title: string;
  sourceId: string;
  worldId?: string;
}
export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
}
export interface ProgressSnapshot {
  workId: string;
  completedUnitIds: string[];
}
export function worksForWorld(worldId: string, works: CatalogWork[], worlds: WorldRecord[]): CatalogWork[] {
  if (!worlds.some(world => world.id === worldId)) return [];
  return works.filter(work => work.worldId === worldId);
}
export function reconcileProgress(workId: string, units: ReadingUnit[], snapshots: ProgressSnapshot[]): string[] {
  const valid = units.filter(unit => unit.workId === workId && Number.isFinite(unit.position)).sort((a, b) => a.position - b.position);
  const validIds = new Set(valid.map(unit => unit.id));
  const completed = new Set<string>();
  for (const snapshot of snapshots) {
    if (snapshot.workId !== workId) continue;
    for (const id of snapshot.completedUnitIds) if (validIds.has(id)) completed.add(id);
  }
  return valid.map(unit => unit.id).filter(id => completed.has(id));
}
export interface SpoilerGate {
  workId: string;
  requiredUnitIds: string[];
}
export interface GateResult {
  unlocked: boolean;
  reason: "unlocked" | "empty-requirements" | "duplicate-requirement" | "unknown-unit" | "incomplete-progress";
  pendingUnitIds: string[];
}
export function evaluateSpoilerGate(gate: SpoilerGate, units: ReadingUnit[], completedUnitIds: string[]): GateResult {
  if (gate.requiredUnitIds.length === 0) return { unlocked: false, reason: "empty-requirements", pendingUnitIds: [] };
  if (new Set(gate.requiredUnitIds).size !== gate.requiredUnitIds.length) return { unlocked: false, reason: "duplicate-requirement", pendingUnitIds: [] };
  const valid = new Set(units.filter(unit => unit.workId === gate.workId).map(unit => unit.id));
  const unknown = gate.requiredUnitIds.filter(id => !valid.has(id));
  if (unknown.length > 0) return { unlocked: false, reason: "unknown-unit", pendingUnitIds: unknown };
  const completed = new Set(completedUnitIds);
  const pending = gate.requiredUnitIds.filter(id => !completed.has(id));
  if (pending.length > 0) return { unlocked: false, reason: "incomplete-progress", pendingUnitIds: pending };
  return { unlocked: true, reason: "unlocked", pendingUnitIds: [] };
}
