export type SourceKind = "verified-index" | "declared-private";

export interface SourceRecord { id: string; label: string; kind: SourceKind; }
export interface WorldRecord { id: string; label: string; }
export interface WorkRecord { id: string; title: string; sourceId: string; }
export interface ReadingUnit { id: string; workId: string; position: number; label: string; }
export interface Progress { workId: string; completedUnitIds: readonly string[]; }
export interface SpoilerRequirement { workId: string; unitIds: readonly string[]; }

/** Conservative validation: relationships and reading structure must be explicit. */
export function validateCatalogue(
  sources: readonly SourceRecord[],
  worlds: readonly WorldRecord[],
  works: readonly WorkRecord[],
  units: readonly ReadingUnit[],
): string[] {
  const errors: string[] = [];
  const duplicate = (values: readonly string[]) => new Set(values).size !== values.length;
  if (duplicate(sources.map(x => x.id))) errors.push("duplicate-source");
  if (duplicate(worlds.map(x => x.id))) errors.push("duplicate-world");
  if (duplicate(works.map(x => x.id))) errors.push("duplicate-work");
  if (duplicate(units.map(x => x.id))) errors.push("duplicate-unit");
  const sourceIds = new Set(sources.map(x => x.id));
  const workIds = new Set(works.map(x => x.id));
  for (const work of works) if (!sourceIds.has(work.sourceId)) errors.push(`unknown-source:${work.id}`);
  const seenPositions = new Set<string>();
  for (const unit of units) {
    if (!workIds.has(unit.workId)) errors.push(`unknown-work:${unit.id}`);
    if (!Number.isInteger(unit.position) || unit.position < 1) errors.push(`invalid-position:${unit.id}`);
    const key = `${unit.workId}:${unit.position}`;
    if (seenPositions.has(key)) errors.push(`duplicate-position:${key}`);
    seenPositions.add(key);
  }
  return errors;
}

/** Fail closed: malformed requirements or incomplete progress never reveal content. */
export function canReveal(
  requirement: SpoilerRequirement,
  progress: Progress,
  units: readonly ReadingUnit[],
): boolean {
  if (requirement.workId !== progress.workId || requirement.unitIds.length === 0) return false;
  if (new Set(requirement.unitIds).size !== requirement.unitIds.length) return false;
  const allowed = new Set(units.filter(x => x.workId === requirement.workId).map(x => x.id));
  if (requirement.unitIds.some(id => !allowed.has(id))) return false;
  const completed = new Set(progress.completedUnitIds);
  return requirement.unitIds.every(id => completed.has(id));
}