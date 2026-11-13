/**
 * Source-safe expansion primitives for Atlas del Cosmere.
 * This module intentionally stores structure and metadata only.
 */
export type SourceKind = "verified-index" | "declared-private";

export interface Source { id: string; kind: SourceKind; label: string; }
export interface World { id: string; label: string; }
export interface Work { id: string; title: string; sourceId: string; worldId?: string; }
export interface ReadingUnit { id: string; workId: string; position: number; label: string; }
export interface ReadingProgress { workId: string; completedUnitIds: readonly string[]; }

export interface SpoilerGate { workId: string; requiredUnitIds: readonly string[]; }

/** Fail closed: malformed gates and mismatched progress never reveal content. */
export function canReveal(
  gate: SpoilerGate,
  units: readonly ReadingUnit[],
  progress?: ReadingProgress,
): boolean {
  if (!progress || progress.workId !== gate.workId) return false;
  if (gate.requiredUnitIds.length === 0) return false;
  const required = new Set(gate.requiredUnitIds);
  if (required.size !== gate.requiredUnitIds.length) return false;
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  for (const id of required) {
    const unit = unitById.get(id);
    if (!unit || unit.workId !== gate.workId) return false;
    if (!progress.completedUnitIds.includes(id)) return false;
  }
  return true;
}

export function validateCatalogue(
  sources: readonly Source[],
  worlds: readonly World[],
  works: readonly Work[],
  units: readonly ReadingUnit[],
): string[] {
  const errors: string[] = [];
  const duplicateIds = (items: readonly { id: string }[], name: string) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (!item.id.trim()) errors.push(name + " has an empty id");
      else if (seen.has(item.id)) errors.push(name + " has duplicate id: " + item.id);
      seen.add(item.id);
    }
  };
  duplicateIds(sources, "source"); duplicateIds(worlds, "world");
  duplicateIds(works, "work"); duplicateIds(units, "reading unit");
  const sourceIds = new Set(sources.map((x) => x.id));
  const worldIds = new Set(worlds.map((x) => x.id));
  const workIds = new Set(works.map((x) => x.id));
  for (const work of works) {
    if (!work.title.trim()) errors.push("work has an empty title: " + work.id);
    if (!sourceIds.has(work.sourceId)) errors.push("unknown source: " + work.sourceId);
    if (work.worldId && !worldIds.has(work.worldId)) errors.push("unknown world: " + work.worldId);
  }
  const positions = new Set<string>();
  for (const unit of units) {
    if (!workIds.has(unit.workId)) errors.push("unit references unknown work: " + unit.id);
    if (!Number.isInteger(unit.position) || unit.position < 1) errors.push("invalid position: " + unit.id);
    const key = unit.workId + ":" + unit.position;
    if (positions.has(key)) errors.push("duplicate position: " + key);
    positions.add(key);
  }
  return errors;
}
