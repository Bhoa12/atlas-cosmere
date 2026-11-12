export type WorldRecord = { id: string; label: string };
export type WorkRecord = { id: string; title: string; worldId?: string; sourceId: string };

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateWorldWorkRegistry(
  worlds: readonly WorldRecord[],
  works: readonly WorkRecord[],
  sourceIds: readonly string[],
): boolean {
  const worldIds = new Set<string>();
  for (const world of worlds) {
    if (!idPattern.test(world.id) || !world.label.trim() || worldIds.has(world.id)) return false;
    worldIds.add(world.id);
  }
  const knownSources = new Set(sourceIds);
  const workIds = new Set<string>();
  for (const work of works) {
    if (!idPattern.test(work.id) || !work.title.trim() || !knownSources.has(work.sourceId) || workIds.has(work.id)) return false;
    if (work.worldId !== undefined && !worldIds.has(work.worldId)) return false;
    workIds.add(work.id);
  }
  return true;
}
