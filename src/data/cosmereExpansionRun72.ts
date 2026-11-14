export type SourceKind = "verified-index" | "declared-private" | "accessible";

export interface SourceRef { id: string; kind: SourceKind; }
export interface World { id: string; name: string; }
export interface Work { id: string; title: string; sourceId: string; worldId?: string; }
export interface ReadingUnit { id: string; workId: string; position: number; }
export interface ProgressSnapshot { workId: string; completedUnitIds: string[]; }

export interface Catalog {
  sources: SourceRef[];
  worlds: World[];
  works: Work[];
  units: ReadingUnit[];
}

/** Validates only structural metadata; it deliberately makes no editorial inferences. */
export function validateCatalog(catalog: Catalog): string[] {
  const errors: string[] = [];
  const duplicate = (values: string[], label: string) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (!value) errors.push(label + ":empty");
      else if (seen.has(value)) errors.push(label + ":duplicate:" + value);
      else seen.add(value);
    }
  };
  duplicate(catalog.sources.map(x => x.id), "source");
  duplicate(catalog.worlds.map(x => x.id), "world");
  duplicate(catalog.works.map(x => x.id), "work");
  duplicate(catalog.units.map(x => x.id), "unit");

  const sourceIds = new Set(catalog.sources.map(x => x.id));
  const worldIds = new Set(catalog.worlds.map(x => x.id));
  const workIds = new Set(catalog.works.map(x => x.id));

  for (const work of catalog.works) {
    if (!work.title.trim()) errors.push("work:empty-title:" + work.id);
    if (!sourceIds.has(work.sourceId)) errors.push("work:unknown-source:" + work.id);
    if (work.worldId && !worldIds.has(work.worldId)) errors.push("work:unknown-world:" + work.id);
  }
  const positions = new Set<string>();
  for (const unit of catalog.units) {
    if (!workIds.has(unit.workId)) errors.push("unit:unknown-work:" + unit.id);
    if (!Number.isInteger(unit.position) || unit.position < 1) errors.push("unit:invalid-position:" + unit.id);
    const key = unit.workId + ":" + unit.position;
    if (positions.has(key)) errors.push("unit:duplicate-position:" + key);
    positions.add(key);
  }
  return errors;
}

export function reconcileProgress(catalog: Catalog, workId: string, snapshots: ProgressSnapshot[]): string[] {
  const valid = new Set(catalog.units.filter(u => u.workId === workId).map(u => u.id));
  const accepted = new Set<string>();
  for (const snapshot of snapshots) {
    if (snapshot.workId !== workId) continue;
    for (const id of snapshot.completedUnitIds) if (valid.has(id)) accepted.add(id);
  }
  return catalog.units
    .filter(u => u.workId === workId && accepted.has(u.id))
    .sort((a, b) => a.position - b.position)
    .map(u => u.id);
}

export interface SpoilerDecision {
  allowed: boolean;
  reason: "invalid-catalog" | "no-requirements" | "invalid-requirements" | "incomplete" | "ready";
  pendingUnitIds: string[];
}

/** Fail closed: ambiguity or invalid metadata never unlocks protected content. */
export function evaluateSpoilerGate(
  catalog: Catalog,
  workId: string,
  requiredUnitIds: string[],
  snapshots: ProgressSnapshot[],
): SpoilerDecision {
  if (validateCatalog(catalog).length) return { allowed: false, reason: "invalid-catalog", pendingUnitIds: [] };
  if (!requiredUnitIds.length) return { allowed: false, reason: "no-requirements", pendingUnitIds: [] };
  const valid = new Set(catalog.units.filter(u => u.workId === workId).map(u => u.id));
  if (new Set(requiredUnitIds).size !== requiredUnitIds.length || requiredUnitIds.some(id => !valid.has(id))) {
    return { allowed: false, reason: "invalid-requirements", pendingUnitIds: [] };
  }
  const done = new Set(reconcileProgress(catalog, workId, snapshots));
  const pending = requiredUnitIds.filter(id => !done.has(id));
  return pending.length
    ? { allowed: false, reason: "incomplete", pendingUnitIds: pending }
    : { allowed: true, reason: "ready", pendingUnitIds: [] };
}
