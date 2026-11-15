export type CatalogWorld = { id: string; name: string };
export type CatalogWork = { id: string; title: string; sourceId: string };
export type CatalogAssignment = { workId: string; worldId: string; sourceId: string };
export type ReadingUnit = { id: string; workId: string; position: number; sourceId: string; accessible: boolean };
export type CatalogNavigationInput = {
  worlds: CatalogWorld[];
  works: CatalogWork[];
  assignments: CatalogAssignment[];
  units: ReadingUnit[];
};
export type CatalogNavigationReport = {
  valid: boolean;
  duplicateAssignmentKeys: string[];
  invalidUnits: ReadingUnit[];
  worksByWorld: Record<string, string[]>;
  unitsByWork: Record<string, string[]>;
};

const duplicate = (values: string[]) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];

/**
 * Builds navigation only from explicit relationships. It deliberately does not
 * infer a work's world, reading order, or inaccessible editorial structure.
 */
export function auditCatalogNavigation(input: CatalogNavigationInput): CatalogNavigationReport {
  const worldIds = new Set(input.worlds.map(world => world.id));
  const workIds = new Set(input.works.map(work => work.id));
  const assignmentKeys = input.assignments.map(x => `${x.workId}::${x.worldId}`);
  const duplicateAssignmentKeys = duplicate(assignmentKeys);
  const worksByWorld: Record<string, string[]> = {};
  for (const assignment of input.assignments) {
    if (!worldIds.has(assignment.worldId) || !workIds.has(assignment.workId) || !assignment.sourceId.trim()) continue;
    (worksByWorld[assignment.worldId] ??= []).push(assignment.workId);
  }
  for (const worldId of Object.keys(worksByWorld)) worksByWorld[worldId] = [...new Set(worksByWorld[worldId])];
  const unitIds = new Set<string>();
  const positions = new Set<string>();
  const invalidUnits = input.units.filter(unit => {
    const key = `${unit.workId}::${unit.position}`;
    const invalid = !workIds.has(unit.workId) || !unit.sourceId.trim() || !unit.accessible ||
      !Number.isInteger(unit.position) || unit.position < 1 || unitIds.has(unit.id) || positions.has(key);
    unitIds.add(unit.id);
    positions.add(key);
    return invalid;
  });
  const unitsByWork: Record<string, string[]> = {};
  for (const unit of input.units) {
    if (invalidUnits.includes(unit)) continue;
    (unitsByWork[unit.workId] ??= []).push(unit.id);
  }
  for (const workId of Object.keys(unitsByWork)) {
    unitsByWork[workId].sort((a, b) => {
      const left = input.units.find(unit => unit.id === a)!;
      const right = input.units.find(unit => unit.id === b)!;
      return left.position - right.position;
    });
  }
  return {
    valid: !duplicateAssignmentKeys.length && !invalidUnits.length,
    duplicateAssignmentKeys,
    invalidUnits,
    worksByWorld,
    unitsByWork,
  };
}
