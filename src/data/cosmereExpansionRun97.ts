export type WorldId = string;
export type WorkId = string;
export type UnitId = string;

export interface World { id: WorldId; name: string; sourceId: string }
export interface Work { id: WorkId; title: string; sourceId: string }
export interface WorkWorldLink { workId: WorkId; worldId: WorldId; sourceId: string }
export interface ReadingUnit { id: UnitId; workId: WorkId; position: number; sourceId: string }
export interface SpoilerGate { id: string; workId: WorkId; requiredUnitIds: UnitId[] }

export interface ExpansionManifest {
  accessibleSourceIds: readonly string[];
  worlds: readonly World[];
  works: readonly Work[];
  links: readonly WorkWorldLink[];
  units: readonly ReadingUnit[];
  gates: readonly SpoilerGate[];
}

export interface AuditResult { valid: boolean; errors: string[] }

/** Audits references only; it never invents editorial structure or world assignments. */
export function auditManifest(manifest: ExpansionManifest): AuditResult {
  const errors: string[] = [];
  const known = new Set(manifest.accessibleSourceIds);
  const worlds = new Set(manifest.worlds.map(x => x.id));
  const works = new Set(manifest.works.map(x => x.id));
  const units = new Map(manifest.units.map(x => [x.id, x]));
  for (const item of [...manifest.worlds, ...manifest.works]) if (!known.has(item.sourceId)) errors.push(`unknown-source:${item.sourceId}`);
  for (const link of manifest.links) {
    if (!works.has(link.workId)) errors.push(`unknown-work:${link.workId}`);
    if (!worlds.has(link.worldId)) errors.push(`unknown-world:${link.worldId}`);
    if (!known.has(link.sourceId)) errors.push(`unknown-source:${link.sourceId}`);
  }
  for (const unit of manifest.units) {
    if (!works.has(unit.workId)) errors.push(`unknown-work:${unit.workId}`);
    if (!known.has(unit.sourceId)) errors.push(`unknown-source:${unit.sourceId}`);
    if (!Number.isInteger(unit.position) || unit.position < 1) errors.push(`invalid-position:${unit.id}`);
  }
  for (const gate of manifest.gates) {
    if (!works.has(gate.workId)) errors.push(`unknown-work:${gate.workId}`);
    if (gate.requiredUnitIds.length === 0) errors.push(`empty-gate:${gate.id}`);
    if (new Set(gate.requiredUnitIds).size !== gate.requiredUnitIds.length) errors.push(`duplicate-gate-requirement:${gate.id}`);
    for (const id of gate.requiredUnitIds) {
      const unit = units.get(id);
      if (!unit) errors.push(`unknown-unit:${id}`);
      else if (unit.workId !== gate.workId) errors.push(`cross-work-gate:${gate.id}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function reconcileProgress(workId: WorkId, completed: readonly UnitId[], units: readonly ReadingUnit[]): UnitId[] {
  const known = new Map(units.filter(x => x.workId === workId).map(x => [x.id, x]));
  return [...new Set(completed)].filter(id => known.has(id)).sort((a,b) => known.get(a)!.position - known.get(b)!.position);
}

export function isGateUnlocked(gate: SpoilerGate, workId: WorkId, completed: readonly UnitId[], units: readonly ReadingUnit[]): boolean {
  if (gate.workId !== workId || gate.requiredUnitIds.length === 0) return false;
  const own = new Map(units.filter(x => x.workId === workId).map(x => [x.id, x]));
  if (new Set(gate.requiredUnitIds).size !== gate.requiredUnitIds.length || gate.requiredUnitIds.some(id => !own.has(id))) return false;
  const done = new Set(reconcileProgress(workId, completed, units));
  return gate.requiredUnitIds.every(id => done.has(id));
}