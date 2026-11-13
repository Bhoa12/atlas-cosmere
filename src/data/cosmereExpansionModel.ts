export type SourceStatus = "verified-index" | "declared-private";

export interface SourceRecord {
  id: string;
  label: string;
  status: SourceStatus;
}

export interface WorldRecord {
  id: string;
  name: string;
}

export interface WorkRecord {
  id: string;
  title: string;
  sourceId: string;
}

export interface WorldWorkRelation {
  worldId: string;
  workId: string;
  evidence: "explicit-metadata";
}

export interface ReadingUnitRecord {
  id: string;
  workId: string;
  position: number;
  label: string;
}

export interface ReadingProgress {
  workId: string;
  completedUnitIds: string[];
}

export interface SpoilerRequirement {
  workId: string;
  requiredUnitIds: string[];
}

export interface Catalogue {
  sources: SourceRecord[];
  worlds: WorldRecord[];
  works: WorkRecord[];
  relations: WorldWorkRelation[];
  units: ReadingUnitRecord[];
}

const idPattern = /^[a-z0-9][a-z0-9-]*$/;

export function validateCatalogue(catalogue: Catalogue): string[] {
  const errors: string[] = [];
  const duplicateIds = (items: { id: string }[], kind: string) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (!idPattern.test(item.id)) errors.push(`${kind} id is invalid: ${item.id}`);
      if (seen.has(item.id)) errors.push(`duplicate ${kind} id: ${item.id}`);
      seen.add(item.id);
    }
  };

  duplicateIds(catalogue.sources, "source");
  duplicateIds(catalogue.worlds, "world");
  duplicateIds(catalogue.works, "work");
  duplicateIds(catalogue.units, "reading unit");

  const sourceIds = new Set(catalogue.sources.map((source) => source.id));
  const worldIds = new Set(catalogue.worlds.map((world) => world.id));
  const workIds = new Set(catalogue.works.map((work) => work.id));

  for (const work of catalogue.works) {
    if (!work.title.trim()) errors.push(`work title is empty: ${work.id}`);
    if (!sourceIds.has(work.sourceId)) errors.push(`unknown source for work: ${work.id}`);
  }

  const relationKeys = new Set<string>();
  for (const relation of catalogue.relations) {
    const key = `${relation.worldId}:${relation.workId}`;
    if (relationKeys.has(key)) errors.push(`duplicate world-work relation: ${key}`);
    relationKeys.add(key);
    if (!worldIds.has(relation.worldId)) errors.push(`unknown world in relation: ${relation.worldId}`);
    if (!workIds.has(relation.workId)) errors.push(`unknown work in relation: ${relation.workId}`);
  }

  const unitPositions = new Set<string>();
  for (const unit of catalogue.units) {
    if (!workIds.has(unit.workId)) errors.push(`unknown work for reading unit: ${unit.id}`);
    if (!Number.isInteger(unit.position) || unit.position < 1) errors.push(`invalid reading position: ${unit.id}`);
    const key = `${unit.workId}:${unit.position}`;
    if (unitPositions.has(key)) errors.push(`duplicate reading position: ${key}`);
    unitPositions.add(key);
  }
  return errors;
}

export function canReveal(requirement: SpoilerRequirement, progress: ReadingProgress): boolean {
  if (requirement.workId !== progress.workId) return false;
  if (requirement.requiredUnitIds.length === 0) return false;
  const required = new Set(requirement.requiredUnitIds);
  if (required.size !== requirement.requiredUnitIds.length) return false;
  const completed = new Set(progress.completedUnitIds);
  return [...required].every((id) => completed.has(id));
}
