export type SourceStatus = "verified-index" | "declared-private";
export type Visibility = "visible" | "locked";

export interface SourceRecord { id: string; status: SourceStatus; }
export interface WorldRecord { id: string; name: string; }
export interface WorkRecord { id: string; title: string; sourceId: string; worldId?: string; }
export interface ReadingUnitRecord { id: string; workId: string; order: number; }
export interface ReadingProgress { workId: string; completedUnitIds: string[]; }

const validId = (value: string) => /^[a-z0-9-]+$/.test(value);

export function validateCatalogue(
  sources: SourceRecord[], worlds: WorldRecord[], works: WorkRecord[], units: ReadingUnitRecord[],
): string[] {
  const errors: string[] = [];
  const duplicate = (ids: string[]) => new Set(ids).size !== ids.length;
  if (duplicate(sources.map(x => x.id)) || sources.some(x => !validId(x.id))) errors.push("invalid sources");
  if (duplicate(worlds.map(x => x.id)) || worlds.some(x => !validId(x.id) || !x.name.trim())) errors.push("invalid worlds");
  if (duplicate(works.map(x => x.id)) || works.some(x => !validId(x.id) || !x.title.trim())) errors.push("invalid works");
  if (duplicate(units.map(x => x.id)) || units.some(x => !validId(x.id) || x.order < 1 || !Number.isInteger(x.order))) errors.push("invalid units");
  const sourceIds = new Set(sources.map(x => x.id));
  const worldIds = new Set(worlds.map(x => x.id));
  const workIds = new Set(works.map(x => x.id));
  if (works.some(x => !sourceIds.has(x.sourceId) || (x.worldId !== undefined && !worldIds.has(x.worldId)))) errors.push("invalid work references");
  if (units.some(x => !workIds.has(x.workId))) errors.push("invalid unit references");
  const positions = new Set<string>();
  for (const unit of units) {
    const key = unit.workId + ":" + unit.order;
    if (positions.has(key)) errors.push("duplicate unit position");
    positions.add(key);
  }
  return [...new Set(errors)];
}

export function resolveVisibility(requiredUnitIds: string[], progress: ReadingProgress): Visibility {
  if (!requiredUnitIds.length || new Set(requiredUnitIds).size !== requiredUnitIds.length) return "locked";
  if (new Set(progress.completedUnitIds).size !== progress.completedUnitIds.length) return "locked";
  const completed = new Set(progress.completedUnitIds);
  return requiredUnitIds.every(id => validId(id) && completed.has(id)) ? "visible" : "locked";
}
