export type CosmereId = string;

export interface WorldRecord { id: CosmereId; name: string; }
export interface WorkRecord { id: CosmereId; title: string; sourceId: CosmereId; /** Set only when explicitly verified. */ worldId?: CosmereId; }
export interface ReadingUnitRecord { id: CosmereId; workId: CosmereId; order: number; label: string; }
export interface ReadingProgress { workId: CosmereId; completedUnitIds: CosmereId[]; }
export interface ContentRequirement { workId: CosmereId; requiredUnitIds: CosmereId[]; }

const validId = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export function validateCatalogue(worlds: WorldRecord[], works: WorkRecord[], units: ReadingUnitRecord[]): string[] {
  const errors: string[] = [];
  const unique = (values: string[], kind: string) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (!validId(value)) errors.push(kind + " id is invalid: " + value);
      if (seen.has(value)) errors.push(kind + " id is duplicated: " + value);
      seen.add(value);
    }
  };
  unique(worlds.map((world) => world.id), "world");
  unique(works.map((work) => work.id), "work");
  unique(units.map((unit) => unit.id), "reading unit");
  const worldIds = new Set(worlds.map((world) => world.id));
  const workIds = new Set(works.map((work) => work.id));
  for (const work of works) {
    if (!work.title.trim()) errors.push("work title is empty: " + work.id);
    if (!validId(work.sourceId)) errors.push("work source id is invalid: " + work.id);
    if (work.worldId && !worldIds.has(work.worldId)) errors.push("work references an unknown world: " + work.id);
  }
  const unitOrders = new Set<string>();
  for (const unit of units) {
    if (!workIds.has(unit.workId)) errors.push("reading unit references an unknown work: " + unit.id);
    if (!Number.isInteger(unit.order) || unit.order < 1) errors.push("reading unit order is invalid: " + unit.id);
    if (!unit.label.trim()) errors.push("reading unit label is empty: " + unit.id);
    const key = unit.workId + ":" + unit.order;
    if (unitOrders.has(key)) errors.push("reading unit order is duplicated: " + key);
    unitOrders.add(key);
  }
  return errors;
}

export function resolveContentVisibility(requirement: ContentRequirement, progress: ReadingProgress): "visible" | "locked" {
  if (!validId(requirement.workId) || !validId(progress.workId)) return "locked";
  if (requirement.workId !== progress.workId || requirement.requiredUnitIds.length === 0) return "locked";
  const completed = new Set(progress.completedUnitIds);
  if (completed.size !== progress.completedUnitIds.length) return "locked";
  if (requirement.requiredUnitIds.some((id) => !validId(id))) return "locked";
  return requirement.requiredUnitIds.every((id) => completed.has(id)) ? "visible" : "locked";
}
