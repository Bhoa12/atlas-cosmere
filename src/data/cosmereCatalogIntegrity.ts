export type CatalogWorld = { id: string; name: string };
export type CatalogWork = { id: string; title: string; sourceId: string };
export type CatalogAssignment = { workId: string; worldId: string; sourceId: string };
export type CatalogIntegrityInput = { worlds: CatalogWorld[]; works: CatalogWork[]; assignments: CatalogAssignment[] };
export type CatalogIntegrityReport = { valid: boolean; duplicateWorldIds: string[]; duplicateWorkIds: string[]; unknownAssignments: CatalogAssignment[]; unassignedWorkIds: string[] };

const duplicates = (ids: string[]) => [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];

/** Audits explicit catalog relationships only; it never infers a world's contents. */
export function auditCatalogIntegrity(input: CatalogIntegrityInput): CatalogIntegrityReport {
  const duplicateWorldIds = duplicates(input.worlds.map(x => x.id));
  const duplicateWorkIds = duplicates(input.works.map(x => x.id));
  const worlds = new Set(input.worlds.map(x => x.id));
  const works = new Set(input.works.map(x => x.id));
  const unknownAssignments = input.assignments.filter(x => !worlds.has(x.worldId) || !works.has(x.workId) || !x.sourceId.trim());
  const assigned = new Set(input.assignments.filter(x => works.has(x.workId) && worlds.has(x.worldId)).map(x => x.workId));
  const unassignedWorkIds = input.works.filter(x => !assigned.has(x.id)).map(x => x.id);
  return { valid: !duplicateWorldIds.length && !duplicateWorkIds.length && !unknownAssignments.length, duplicateWorldIds, duplicateWorkIds, unknownAssignments, unassignedWorkIds };
}