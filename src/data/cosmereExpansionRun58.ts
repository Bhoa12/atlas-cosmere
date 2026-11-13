export type SourceKind = "verified-index" | "declared-private";

export interface SourceRecord {
  id: string;
  kind: SourceKind;
  label: string;
}

export interface WorldRecord {
  id: string;
  label: string;
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
  sources: readonly SourceRecord[];
  worlds: readonly WorldRecord[];
  works: readonly WorkRecord[];
  units: readonly ReadingUnit[];
}

export function validateCatalog(catalog: AtlasCatalog): string[] {
  const errors: string[] = [];
  const duplicateIds = (items: readonly { id: string }[], kind: string) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (!item.id.trim()) errors.push(`${kind} has an empty id`);
      else if (seen.has(item.id)) errors.push(`duplicate ${kind} id: ${item.id}`);
      else seen.add(item.id);
    }
  };

  duplicateIds(catalog.sources, "source");
  duplicateIds(catalog.worlds, "world");
  duplicateIds(catalog.works, "work");
  duplicateIds(catalog.units, "reading unit");

  const sourceIds = new Set(catalog.sources.map((source) => source.id));
  const worldIds = new Set(catalog.worlds.map((world) => world.id));
  const workIds = new Set(catalog.works.map((work) => work.id));

  for (const work of catalog.works) {
    if (!work.title.trim()) errors.push(`work has an empty title: ${work.id}`);
    if (!sourceIds.has(work.sourceId)) errors.push(`work references unknown source: ${work.id}`);
    if (work.worldId !== undefined && !worldIds.has(work.worldId)) {
      errors.push(`work references unknown world: ${work.id}`);
    }
  }

  const positionsByWork = new Map<string, Set<number>>();
  for (const unit of catalog.units) {
    if (!workIds.has(unit.workId)) errors.push(`reading unit references unknown work: ${unit.id}`);
    if (!Number.isInteger(unit.position) || unit.position < 1) {
      errors.push(`reading unit has invalid position: ${unit.id}`);
    }
    const positions = positionsByWork.get(unit.workId) ?? new Set<number>();
    if (positions.has(unit.position)) errors.push(`duplicate reading position for work: ${unit.workId}`);
    positions.add(unit.position);
    positionsByWork.set(unit.workId, positions);
  }

  return errors;
}

/**
 * Conservative spoiler gate. Missing or malformed metadata never reveals content.
 */
export function canReveal(
  catalog: AtlasCatalog,
  progress: ReadingProgress | undefined,
  gate: SpoilerGate,
): boolean {
  if (!progress || progress.workId !== gate.workId) return false;
  if (gate.requiredUnitIds.length === 0) return false;

  const required = new Set(gate.requiredUnitIds);
  if (required.size !== gate.requiredUnitIds.length) return false;

  const units = new Map(catalog.units.map((unit) => [unit.id, unit]));
  for (const unitId of required) {
    const unit = units.get(unitId);
    if (!unit || unit.workId !== gate.workId) return false;
    if (!progress.completedUnitIds.includes(unitId)) return false;
  }
  return true;
}

/**
 * Builds a source-only bibliography seed. It deliberately does not infer
 * world assignments or internal reading structure from a title.
 */
export function buildBibliographyWorks(sourceId: string, titles: readonly string[]): WorkRecord[] {
  return titles.map((title, index) => ({
    id: `bibliography-${index + 1}`,
    title,
    sourceId,
  }));
}
