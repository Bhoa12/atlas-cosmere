/**
 * Source-safe expansion primitives for Atlas del Cosmere.
 *
 * This module stores metadata and access rules only. It deliberately does not
 * contain EPUB passages, quotes, chapter text, or inferred editorial facts.
 */

export type SourceStatus = "verified-index" | "declared-private";

export interface SourceRecord {
  id: string;
  label: string;
  status: SourceStatus;
}

export interface WorldRecord {
  id: string;
  label: string;
}

export interface WorkRecord {
  id: string;
  title: string;
  sourceId: string;
}

export interface ReadingUnitRecord {
  id: string;
  workId: string;
  order: number;
  label: string;
}

export interface ProgressRecord {
  workId: string;
  completedUnitIds: string[];
}

/**
 * A relationship or summary must carry explicit evidence metadata. The model
 * refuses to treat a title or filename as evidence.
 */
export interface SupportedEditorialRecord {
  id: string;
  sourceId: string;
  evidenceKind: "verified-index" | "explicit-metadata";
}

export interface WorldAssignment extends SupportedEditorialRecord {
  workId: string;
  worldId: string;
}

export interface SpoilerRequirement {
  id: string;
  workId: string;
  requiredUnitIds: string[];
}

export interface ExpansionCatalogue {
  sources: SourceRecord[];
  worlds: WorldRecord[];
  works: WorkRecord[];
  units: ReadingUnitRecord[];
  assignments: WorldAssignment[];
}

const validId = (value: string) => /^[a-z0-9][a-z0-9-]*$/.test(value);
const unique = (values: string[]) => new Set(values).size === values.length;

export function validateCatalogue(catalogue: ExpansionCatalogue): string[] {
  const errors: string[] = [];
  const checkIds = (kind: string, records: { id: string }[]) => {
    const ids = records.map((record) => record.id);
    if (ids.some((id) => !validId(id))) errors.push(kind + ":invalid-id");
    if (!unique(ids)) errors.push(kind + ":duplicate-id");
  };

  checkIds("source", catalogue.sources);
  checkIds("world", catalogue.worlds);
  checkIds("work", catalogue.works);
  checkIds("unit", catalogue.units);
  checkIds("assignment", catalogue.assignments);

  const sourceIds = new Set(catalogue.sources.map((source) => source.id));
  const worldIds = new Set(catalogue.worlds.map((world) => world.id));
  const workIds = new Set(catalogue.works.map((work) => work.id));

  for (const work of catalogue.works) {
    if (!work.title.trim()) errors.push("work:empty-title:" + work.id);
    if (!sourceIds.has(work.sourceId)) errors.push("work:unknown-source:" + work.id);
  }

  const unitPositions = new Set<string>();
  for (const unit of catalogue.units) {
    if (!workIds.has(unit.workId)) errors.push("unit:unknown-work:" + unit.id);
    if (!Number.isInteger(unit.order) || unit.order < 1) errors.push("unit:invalid-order:" + unit.id);
    const key = unit.workId + ":" + unit.order;
    if (unitPositions.has(key)) errors.push("unit:duplicate-order:" + key);
    unitPositions.add(key);
  }

  for (const assignment of catalogue.assignments) {
    if (!sourceIds.has(assignment.sourceId)) errors.push("assignment:unknown-source:" + assignment.id);
    if (!workIds.has(assignment.workId)) errors.push("assignment:unknown-work:" + assignment.id);
    if (!worldIds.has(assignment.worldId)) errors.push("assignment:unknown-world:" + assignment.id);
  }

  return errors;
}

export function canReveal(
  requirement: SpoilerRequirement,
  progress: ProgressRecord,
  units: ReadingUnitRecord[],
): boolean {
  if (requirement.workId !== progress.workId) return false;
  if (requirement.requiredUnitIds.length === 0) return false;
  if (!unique(requirement.requiredUnitIds)) return false;

  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  for (const unitId of requirement.requiredUnitIds) {
    const unit = unitById.get(unitId);
    if (!unit || unit.workId !== requirement.workId) return false;
    if (!progress.completedUnitIds.includes(unitId)) return false;
  }
  return true;
}

/**
 * Resolve only an explicitly recorded world assignment. Ambiguity and absence
 * are both represented as undefined rather than guessed.
 */
export function resolveWorld(
  workId: string,
  assignments: WorldAssignment[],
): string | undefined {
  const matches = assignments.filter((assignment) => assignment.workId === workId);
  return matches.length === 1 ? matches[0].worldId : undefined;
}
