/**
 * Run 81: reusable catalog integrity and spoiler-safe navigation.
 * Metadata only; this module contains no editorial text.
 */

export interface Source { id: string; kind: "verified-index" | "declared-private" | "editorial-accessible"; accessible: boolean; }
export interface World { id: string; name: string; }
export interface Work { id: string; title: string; sourceId: string; }
export interface WorldWorkLink { worldId: string; workId: string; sourceId: string; }
export interface ReadingUnit { id: string; workId: string; position: number; sourceId: string; }

export function validateCatalog(
  sources: readonly Source[],
  worlds: readonly World[],
  works: readonly Work[],
  links: readonly WorldWorkLink[],
  units: readonly ReadingUnit[],
): string[] {
  const errors: string[] = [];
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const worldIds = new Set(worlds.map((world) => world.id));
  const workIds = new Set(works.map((work) => work.id));
  for (const work of works) if (!sourceById.has(work.sourceId)) errors.push(`unknown work source: ${work.id}`);
  for (const link of links) {
    if (!worldIds.has(link.worldId)) errors.push(`unknown link world: ${link.worldId}`);
    if (!workIds.has(link.workId)) errors.push(`unknown link work: ${link.workId}`);
    if (!sourceById.has(link.sourceId)) errors.push(`unknown link source: ${link.sourceId}`);
  }
  const seenPositions = new Set<string>();
  for (const unit of units) {
    const source = sourceById.get(unit.sourceId);
    if (!workIds.has(unit.workId)) errors.push(`unknown unit work: ${unit.id}`);
    if (!source || source.kind !== "editorial-accessible" || !source.accessible) errors.push(`unverified reading structure: ${unit.id}`);
    const key = `${unit.workId}:${unit.position}`;
    if (seenPositions.has(key)) errors.push(`duplicate unit position: ${key}`);
    seenPositions.add(key);
  }
  return errors;
}

export function worldsForWork(workId: string, links: readonly WorldWorkLink[], worlds: readonly World[]): World[] {
  const ids = new Set(links.filter((link) => link.workId === workId).map((link) => link.worldId));
  return worlds.filter((world) => ids.has(world.id));
}

export function safeReadingUnits(workId: string, units: readonly ReadingUnit[], sources: readonly Source[]): ReadingUnit[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  return units
    .filter((unit) => {
      const source = sourceById.get(unit.sourceId);
      return unit.workId === workId && source?.kind === "editorial-accessible" && source.accessible;
    })
    .sort((a, b) => a.position - b.position);
}
