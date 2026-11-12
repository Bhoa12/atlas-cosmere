/**
 * Run 42: provenance-first catalogue scope.
 * This module stores only technical metadata; it does not contain protected prose.
 */
export type SourceStatus = "verified-index" | "declared-private";

export interface SourceRecord { id: string; label: string; status: SourceStatus; }
export interface WorldRecord { id: string; label: string; }
export interface WorkRecord { id: string; title: string; sourceId: string; }
export interface WorldWorkLink { worldId: string; workId: string; sourceId: string; }
export interface ReadingUnit { id: string; workId: string; position: number; label: string; }
export interface ReadingProgress { workId: string; completedUnitIds: string[]; }

const ID = /^[a-z0-9][a-z0-9-]*$/;

export function validateCatalogue(input: {
  sources: SourceRecord[]; worlds: WorldRecord[]; works: WorkRecord[];
  links: WorldWorkLink[]; units: ReadingUnit[];
}): string[] {
  const errors: string[] = [];
  const unique = (values: string[], kind: string) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (!ID.test(value)) errors.push(`${kind} has malformed id: ${value}`);
      if (seen.has(value)) errors.push(`duplicate ${kind} id: ${value}`);
      seen.add(value);
    }
  };
  unique(input.sources.map(x => x.id), "source");
  unique(input.worlds.map(x => x.id), "world");
  unique(input.works.map(x => x.id), "work");
  unique(input.units.map(x => x.id), "reading unit");

  const sourceIds = new Set(input.sources.map(x => x.id));
  const worldIds = new Set(input.worlds.map(x => x.id));
  const workIds = new Set(input.works.map(x => x.id));

  for (const work of input.works) {
    if (!work.title.trim()) errors.push(`work ${work.id} has empty title`);
    if (!sourceIds.has(work.sourceId)) errors.push(`work ${work.id} references unknown source`);
  }
  const linkKeys = new Set<string>();
  for (const link of input.links) {
    const key = `${link.worldId}:${link.workId}`;
    if (linkKeys.has(key)) errors.push(`duplicate world-work link: ${key}`);
    linkKeys.add(key);
    if (!worldIds.has(link.worldId)) errors.push(`link references unknown world: ${link.worldId}`);
    if (!workIds.has(link.workId)) errors.push(`link references unknown work: ${link.workId}`);
    if (!sourceIds.has(link.sourceId)) errors.push(`link references unknown source: ${link.sourceId}`);
  }
  const positions = new Set<string>();
  for (const unit of input.units) {
    if (!workIds.has(unit.workId)) errors.push(`unit ${unit.id} references unknown work`);
    if (!Number.isInteger(unit.position) || unit.position < 1) errors.push(`unit ${unit.id} has invalid position`);
    const key = `${unit.workId}:${unit.position}`;
    if (positions.has(key)) errors.push(`duplicate unit position: ${key}`);
    positions.add(key);
  }
  return errors;
}

/** Returns a world only when exactly one explicit link exists; never infers from titles. */
export function resolveWorldForWork(workId: string, links: WorldWorkLink[]): string | null {
  const matches = links.filter(link => link.workId === workId);
  return matches.length === 1 ? matches[0].worldId : null;
}

/** Fail closed: all required units must belong to the work and be completed. */
export function canReveal(workId: string, requiredUnitIds: string[], units: ReadingUnit[], progress: ReadingProgress): boolean {
  if (progress.workId !== workId || requiredUnitIds.length === 0) return false;
  if (new Set(requiredUnitIds).size !== requiredUnitIds.length) return false;
  const known = new Map(units.map(unit => [unit.id, unit]));
  const completed = new Set(progress.completedUnitIds);
  return requiredUnitIds.every(id => known.get(id)?.workId === workId && completed.has(id));
}
