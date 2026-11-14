/**
 * Run 86: reusable validation and visibility planning.
 *
 * This module deliberately contains no editorial prose. Catalog metadata,
 * explicit links and reading structure remain separate concerns.
 */

export type SourceKind = "catalog-index" | "private-declared" | "editorial-accessible";

export interface SourceRecord {
  id: string;
  kind: SourceKind;
  accessible: boolean;
}

export interface WorldRecord { id: string; name: string; }
export interface WorkRecord { id: string; title: string; sourceId: string; }
export interface WorldWorkLink { worldId: string; workId: string; sourceId: string; }
export interface ReadingUnit { id: string; workId: string; position: number; sourceId: string; }
export interface ProgressSnapshot { workId: string; completedUnitIds: string[]; }

export const priorityWorlds: WorldRecord[] = [
  { id: "scadrial", name: "Scadrial" },
  { id: "sel", name: "Sel" },
  { id: "nalthis", name: "Nalthis" },
  { id: "taldain", name: "Taldain" },
  { id: "roshar", name: "Roshar" },
];

/** Returns only links whose world, work and provenance are all known. */
export function validateWorldLinks(
  worlds: WorldRecord[],
  works: WorkRecord[],
  links: WorldWorkLink[],
  sources: SourceRecord[],
): { valid: WorldWorkLink[]; invalid: WorldWorkLink[] } {
  const worldIds = new Set(worlds.map(world => world.id));
  const workIds = new Set(works.map(work => work.id));
  const sourceIds = new Set(sources.map(source => source.id));
  const valid: WorldWorkLink[] = [];
  const invalid: WorldWorkLink[] = [];

  for (const link of links) {
    (worldIds.has(link.worldId) && workIds.has(link.workId) && sourceIds.has(link.sourceId)
      ? valid
      : invalid
    ).push(link);
  }
  return { valid, invalid };
}

/**
 * Reading structure is accepted only from a source explicitly available for
 * editorial inspection. This prevents catalog entries from becoming invented
 * chapters or sections.
 */
export function validatedReadingUnits(
  workId: string,
  units: ReadingUnit[],
  sources: SourceRecord[],
): ReadingUnit[] {
  const sourceById = new Map(sources.map(source => [source.id, source]));
  const seenIds = new Set<string>();
  const seenPositions = new Set<number>();

  return units
    .filter(unit => unit.workId === workId)
    .filter(unit => {
      const source = sourceById.get(unit.sourceId);
      if (!source || source.kind !== "editorial-accessible" || !source.accessible) return false;
      if (seenIds.has(unit.id) || seenPositions.has(unit.position)) return false;
      seenIds.add(unit.id);
      seenPositions.add(unit.position);
      return true;
    })
    .sort((a, b) => a.position - b.position);
}

export interface SpoilerPlan {
  unlocked: boolean;
  completed: string[];
  pending: string[];
}

/**
 * Computes visibility from validated structure only. Empty or malformed
 * requirements fail closed.
 */
export function planSpoilerVisibility(
  requiredUnitIds: string[],
  units: ReadingUnit[],
  snapshots: ProgressSnapshot[],
): SpoilerPlan {
  if (requiredUnitIds.length === 0 || new Set(requiredUnitIds).size !== requiredUnitIds.length) {
    return { unlocked: false, completed: [], pending: [...requiredUnitIds] };
  }

  const known = new Set(units.map(unit => unit.id));
  if (requiredUnitIds.some(id => !known.has(id))) {
    return { unlocked: false, completed: [], pending: [...requiredUnitIds] };
  }

  const workByUnit = new Map(units.map(unit => [unit.id, unit.workId]));
  const completed = new Set<string>();
  for (const snapshot of snapshots) {
    for (const id of snapshot.completedUnitIds) {
      if (known.has(id) && workByUnit.get(id) === snapshot.workId) completed.add(id);
    }
  }

  const done = requiredUnitIds.filter(id => completed.has(id));
  const pending = requiredUnitIds.filter(id => !completed.has(id));
  return { unlocked: pending.length === 0, completed: done, pending };
}
