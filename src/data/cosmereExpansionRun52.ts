export type SourceProvenance = "verified-index" | "declared-private";

export interface SourceRecord { id: string; provenance: SourceProvenance; label: string; }
export interface WorldRecord { id: string; label: string; }
export interface WorkRecord { id: string; title: string; sourceId: string; worldId?: string; }
export interface ReadingUnit { id: string; workId: string; position: number; label: string; }
export interface Progress { workId: string; completedUnitIds: readonly string[]; }

export interface ExpansionCatalogue {
  sources: readonly SourceRecord[];
  worlds: readonly WorldRecord[];
  works: readonly WorkRecord[];
  units: readonly ReadingUnit[];
}

const unique = (values: readonly string[]) => new Set(values).size === values.length;

export function validateCatalogue(catalogue: ExpansionCatalogue): string[] {
  const errors: string[] = [];
  const sourceIds = catalogue.sources.map(x => x.id);
  const worldIds = catalogue.worlds.map(x => x.id);
  const workIds = catalogue.works.map(x => x.id);
  const unitIds = catalogue.units.map(x => x.id);
  if (!unique(sourceIds)) errors.push("duplicate source id");
  if (!unique(worldIds)) errors.push("duplicate world id");
  if (!unique(workIds)) errors.push("duplicate work id");
  if (!unique(unitIds)) errors.push("duplicate reading unit id");
  for (const work of catalogue.works) {
    if (!work.title.trim()) errors.push("empty work title: " + work.id);
    if (!sourceIds.includes(work.sourceId)) errors.push("unknown source: " + work.id);
    if (work.worldId && !worldIds.includes(work.worldId)) errors.push("unknown world: " + work.id);
  }
  const seenPositions = new Set<string>();
  for (const unit of catalogue.units) {
    if (!workIds.includes(unit.workId)) errors.push("unknown work for unit: " + unit.id);
    if (!Number.isInteger(unit.position) || unit.position < 1) errors.push("invalid unit position: " + unit.id);
    const key = unit.workId + ":" + unit.position;
    if (seenPositions.has(key)) errors.push("duplicate unit position: " + key);
    seenPositions.add(key);
  }
  return errors;
}

export function canReveal(workId: string, requiredUnitIds: readonly string[], progress: Progress, units: readonly ReadingUnit[]): boolean {
  if (progress.workId !== workId || requiredUnitIds.length === 0 || !unique(requiredUnitIds)) return false;
  const byId = new Map(units.map(unit => [unit.id, unit]));
  const completed = new Set(progress.completedUnitIds);
  return requiredUnitIds.every(id => {
    const unit = byId.get(id);
    return Boolean(unit && unit.workId === workId && completed.has(id));
  });
}

export const priorityWorlds: readonly WorldRecord[] = [
  { id: "scadrial", label: "Scadrial" },
  { id: "sel", label: "Sel" },
  { id: "nalthis", label: "Nalthis" },
  { id: "taldain", label: "Taldain" },
  { id: "roshar", label: "Roshar" },
];
