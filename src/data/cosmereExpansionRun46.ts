export type SourceProvenance = "verified-index" | "declared-private";

export interface CatalogueSource { id: string; provenance: SourceProvenance; }
export interface CatalogueWorld { id: string; label: string; }
export interface CatalogueWork { id: string; title: string; sourceId: string; }
export interface ReadingUnit { id: string; workId: string; position: number; label: string; }
export interface ReadingProgress { workId: string; completedUnitIds: readonly string[]; }
export interface SpoilerGate { workId: string; requiredUnitIds: readonly string[]; }

export function validateCatalogue(
  sources: readonly CatalogueSource[],
  worlds: readonly CatalogueWorld[],
  works: readonly CatalogueWork[],
  units: readonly ReadingUnit[],
): string[] {
  const errors: string[] = [];
  const duplicate = (values: readonly string[]) => values.filter((v, i) => values.indexOf(v) !== i);
  for (const id of duplicate(sources.map(x => x.id))) errors.push("duplicate source: " + id);
  for (const id of duplicate(worlds.map(x => x.id))) errors.push("duplicate world: " + id);
  for (const id of duplicate(works.map(x => x.id))) errors.push("duplicate work: " + id);
  for (const id of duplicate(units.map(x => x.id))) errors.push("duplicate unit: " + id);
  const sourceIds = new Set(sources.map(x => x.id));
  const workIds = new Set(works.map(x => x.id));
  for (const work of works) {
    if (!work.title.trim()) errors.push("empty work title: " + work.id);
    if (!sourceIds.has(work.sourceId)) errors.push("unknown source: " + work.sourceId);
  }
  const positions = new Set<string>();
  for (const unit of units) {
    if (!workIds.has(unit.workId)) errors.push("unknown work: " + unit.workId);
    if (!Number.isInteger(unit.position) || unit.position < 1) errors.push("invalid position: " + unit.id);
    const key = unit.workId + ":" + unit.position;
    if (positions.has(key)) errors.push("duplicate position: " + key);
    positions.add(key);
  }
  return errors;
}

export function canReveal(gate: SpoilerGate, progress: ReadingProgress, units: readonly ReadingUnit[]): boolean {
  if (gate.workId !== progress.workId || gate.requiredUnitIds.length === 0) return false;
  const required = new Set(gate.requiredUnitIds);
  if (required.size !== gate.requiredUnitIds.length) return false;
  const unitById = new Map(units.map(unit => [unit.id, unit]));
  for (const id of required) {
    const unit = unitById.get(id);
    if (!unit || unit.workId !== gate.workId || !progress.completedUnitIds.includes(id)) return false;
  }
  return true;
}