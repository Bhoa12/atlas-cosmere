export interface WorldRecord {
  id: string;
  label: string;
  workIds?: readonly string[];
}

export interface WorkRecord {
  id: string;
  title: string;
  sourceId: string;
  worldId?: string;
}

export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
  label: string;
}

export interface ReadingProgress {
  workId: string;
  completedUnitIds: readonly string[];
}

export interface SpoilerGate {
  workId: string;
  requiredUnitIds: readonly string[];
}

export interface AtlasCatalog {
  worlds: readonly WorldRecord[];
  works: readonly WorkRecord[];
  units: readonly ReadingUnit[];
}

/**
 * Resolves navigation without inferring editorial relationships.
 * Explicit links on either side must agree; conflicts are rejected.
 */
export function worksForWorld(catalog: AtlasCatalog, worldId: string): WorkRecord[] {
  const world = catalog.worlds.find((item) => item.id === worldId);
  if (!world) return [];

  const explicitWorldWorks = catalog.works.filter((work) => work.worldId === worldId);
  if (!world.workIds) return explicitWorldWorks;

  const ids = new Set(world.workIds);
  const linked = catalog.works.filter((work) => ids.has(work.id));
  if (linked.length !== ids.size) return [];
  if (explicitWorldWorks.some((work) => !ids.has(work.id))) return [];
  if (linked.some((work) => work.worldId !== undefined && work.worldId !== worldId)) return [];
  return linked;
}

/**
 * Normalizes progress against known units only. Unknown or cross-work units
 * are discarded, so stale state cannot unlock spoiler-gated content.
 */
export function normalizeProgress(
  catalog: AtlasCatalog,
  progress: ReadingProgress,
): ReadingProgress {
  const valid = new Set(
    catalog.units
      .filter((unit) => unit.workId === progress.workId)
      .map((unit) => unit.id),
  );
  return {
    workId: progress.workId,
    completedUnitIds: [...new Set(progress.completedUnitIds.filter((id) => valid.has(id)))],
  };
}

export function canReveal(
  catalog: AtlasCatalog,
  progress: ReadingProgress | undefined,
  gate: SpoilerGate,
): boolean {
  if (!progress || progress.workId !== gate.workId || gate.requiredUnitIds.length === 0) {
    return false;
  }
  const required = new Set(gate.requiredUnitIds);
  if (required.size !== gate.requiredUnitIds.length) return false;

  const completed = new Set(normalizeProgress(catalog, progress).completedUnitIds);
  const units = new Map(catalog.units.map((unit) => [unit.id, unit]));
  return [...required].every((id) => {
    const unit = units.get(id);
    return unit?.workId === gate.workId && completed.has(id);
  });
}
