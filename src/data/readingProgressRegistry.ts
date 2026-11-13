export type SourceKind = "verified-index" | "declared-private";

export interface SourceRecord { id: string; label: string; kind: SourceKind }
export interface WorldRecord { id: string; label: string }
export interface WorkRecord { id: string; title: string; sourceId: string; worldId?: string }
export interface ReadingUnit { id: string; workId: string; position: number; label: string }
export interface ReadingProgress { workId: string; completedUnitIds: readonly string[] }

export interface SpoilerGate { workId: string; requiredUnitIds: readonly string[] }

export function validateRegistry(
  sources: readonly SourceRecord[],
  worlds: readonly WorldRecord[],
  works: readonly WorkRecord[],
  units: readonly ReadingUnit[],
): string[] {
  const errors: string[] = [];
  const duplicate = <T extends { id: string }>(items: readonly T[], kind: string) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (!item.id.trim()) errors.push(kind + " has an empty id");
      if (seen.has(item.id)) errors.push(kind + " has duplicate id: " + item.id);
      seen.add(item.id);
    }
  };
  duplicate(sources, "source"); duplicate(worlds, "world"); duplicate(works, "work"); duplicate(units, "unit");
  const sourceIds = new Set(sources.map(s => s.id));
  const worldIds = new Set(worlds.map(w => w.id));
  const workIds = new Set(works.map(w => w.id));
  for (const work of works) {
    if (!work.title.trim()) errors.push("work has an empty title: " + work.id);
    if (!sourceIds.has(work.sourceId)) errors.push("unknown source for work: " + work.id);
    if (work.worldId && !worldIds.has(work.worldId)) errors.push("unknown world for work: " + work.id);
  }
  const positions = new Set<string>();
  for (const unit of units) {
    if (!workIds.has(unit.workId)) errors.push("unknown work for unit: " + unit.id);
    if (!Number.isInteger(unit.position) || unit.position < 1) errors.push("invalid position: " + unit.id);
    const key = unit.workId + ":" + unit.position;
    if (positions.has(key)) errors.push("duplicate unit position: " + key);
    positions.add(key);
  }
  return errors;
}

export function canReveal(
  gate: SpoilerGate,
  progress: ReadingProgress | undefined,
  units: readonly ReadingUnit[],
): boolean {
  if (!progress || progress.workId !== gate.workId || gate.requiredUnitIds.length === 0) return false;
  const required = new Set(gate.requiredUnitIds);
  if (required.size !== gate.requiredUnitIds.length) return false;
  const unitById = new Map(units.map(unit => [unit.id, unit]));
  for (const id of required) {
    const unit = unitById.get(id);
    if (!unit || unit.workId !== gate.workId || !progress.completedUnitIds.includes(id)) return false;
  }
  return true;
}

export function visibleSummary<T>(value: T, gate: SpoilerGate, progress: ReadingProgress | undefined, units: readonly ReadingUnit[]): T | undefined {
  return canReveal(gate, progress, units) ? value : undefined;
}
