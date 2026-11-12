export type SourceStatus = "verified-index" | "declared-private";

export interface SourceRecord { id: string; label: string; status: SourceStatus }
export interface WorldRecord { id: string; label: string }
export interface WorkRecord { id: string; title: string; sourceId: string }
export interface ReadingUnitRecord { id: string; workId: string; position: number; label: string }
export interface ReadingProgress { workId: string; completedUnitIds: string[] }

const ID = /^[a-z0-9][a-z0-9-]*$/;

export interface Catalogue {
  sources: SourceRecord[];
  worlds: WorldRecord[];
  works: WorkRecord[];
  readingUnits: ReadingUnitRecord[];
}

export function validateCatalogue(catalogue: Catalogue): string[] {
  const errors: string[] = [];
  const duplicate = (items: {id:string}[], kind:string) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (!ID.test(item.id)) errors.push(`${kind} has an invalid id: ${item.id}`);
      if (seen.has(item.id)) errors.push(`${kind} is duplicated: ${item.id}`);
      seen.add(item.id);
    }
  };
  duplicate(catalogue.sources, "source");
  duplicate(catalogue.worlds, "world");
  duplicate(catalogue.works, "work");
  duplicate(catalogue.readingUnits, "reading unit");
  const sourceIds = new Set(catalogue.sources.map(x => x.id));
  const workIds = new Set(catalogue.works.map(x => x.id));
  const positions = new Set<string>();
  for (const work of catalogue.works) {
    if (!work.title.trim()) errors.push(`work has an empty title: ${work.id}`);
    if (!sourceIds.has(work.sourceId)) errors.push(`work has an unknown source: ${work.id}`);
  }
  for (const unit of catalogue.readingUnits) {
    if (!workIds.has(unit.workId)) errors.push(`reading unit has an unknown work: ${unit.id}`);
    if (!Number.isInteger(unit.position) || unit.position < 1) errors.push(`reading unit has an invalid position: ${unit.id}`);
    const key = `${unit.workId}:${unit.position}`;
    if (positions.has(key)) errors.push(`reading unit position is duplicated: ${key}`);
    positions.add(key);
  }
  return errors;
}

export function resolveVisibility(requiredUnitIds: string[], progress: ReadingProgress | null): "visible" | "locked" {
  if (!progress || requiredUnitIds.length === 0) return "locked";
  const required = new Set(requiredUnitIds);
  const completed = new Set(progress.completedUnitIds);
  if (required.size !== requiredUnitIds.length || completed.size !== progress.completedUnitIds.length) return "locked";
  return [...required].every(id => completed.has(id)) ? "visible" : "locked";
}