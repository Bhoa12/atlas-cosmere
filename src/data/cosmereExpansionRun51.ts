export type SourceStatus = "verified-index" | "declared-private";

export interface CatalogueSource { id: string; title: string; status: SourceStatus; }
export interface WorldRecord { id: string; title: string; }
export interface WorkRecord { id: string; title: string; sourceId: string; worldId?: string; }
export interface ReadingUnit { id: string; workId: string; position: number; label: string; }
export interface ReadingProgress { workId: string; completedUnitIds: string[]; }
export interface SpoilerGate { id: string; workId: string; requiredUnitIds: string[]; }

export interface ExpansionCatalogue {
  sources: CatalogueSource[];
  worlds: WorldRecord[];
  works: WorkRecord[];
  readingUnits: ReadingUnit[];
}

/** Validates references only; it does not infer editorial or narrative facts. */
export function validateCatalogue(catalogue: ExpansionCatalogue): string[] {
  const errors: string[] = [];
  const unique = (values: string[], kind: string) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (!value.trim()) errors.push(kind + " has an empty id");
      else if (seen.has(value)) errors.push(kind + " has duplicate id: " + value);
      else seen.add(value);
    }
  };
  unique(catalogue.sources.map(x => x.id), "source");
  unique(catalogue.worlds.map(x => x.id), "world");
  unique(catalogue.works.map(x => x.id), "work");
  unique(catalogue.readingUnits.map(x => x.id), "reading unit");

  const sourceIds = new Set(catalogue.sources.map(x => x.id));
  const worldIds = new Set(catalogue.worlds.map(x => x.id));
  const workIds = new Set(catalogue.works.map(x => x.id));

  for (const work of catalogue.works) {
    if (!work.title.trim()) errors.push("work has an empty title: " + work.id);
    if (!sourceIds.has(work.sourceId)) errors.push("work references unknown source: " + work.id);
    if (work.worldId && !worldIds.has(work.worldId)) errors.push("work references unknown world: " + work.id);
  }

  const positions = new Set<string>();
  for (const unit of catalogue.readingUnits) {
    if (!workIds.has(unit.workId)) errors.push("reading unit references unknown work: " + unit.id);
    if (!Number.isInteger(unit.position) || unit.position < 1) errors.push("reading unit has invalid position: " + unit.id);
    const key = unit.workId + ":" + unit.position;
    if (positions.has(key)) errors.push("reading units share a position: " + key);
    positions.add(key);
  }
  return errors;
}

/** Fail closed: content is hidden unless every explicit requirement is completed. */
export function canReveal(gate: SpoilerGate, progress: ReadingProgress, units: ReadingUnit[]): boolean {
  if (progress.workId !== gate.workId || gate.requiredUnitIds.length === 0) return false;
  if (new Set(gate.requiredUnitIds).size !== gate.requiredUnitIds.length) return false;
  const unitById = new Map(units.map(unit => [unit.id, unit]));
  const completed = new Set(progress.completedUnitIds);
  return gate.requiredUnitIds.every(id => {
    const unit = unitById.get(id);
    return Boolean(unit && unit.workId === gate.workId && completed.has(id));
  });
}
