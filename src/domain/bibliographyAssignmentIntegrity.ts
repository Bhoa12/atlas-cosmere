import { SourceCatalogEntry } from "./sourceCatalog";
import { BibliographyWorkAssignment } from "./bibliographyWorkAssignments";
import { BibliographyWorldAssignment } from "./bibliographyWorldAssignments";

export interface BibliographyAssignmentIntegrityResult {
  status: "valid" | "blocked";
  sourceIds: readonly string[];
  blockedSourceIds: readonly string[];
  blockedWorkIds: readonly string[];
  blockedWorldIds: readonly string[];
}

/**
 * Validates that independently declared bibliography relationships agree on the
 * same catalog source. This is metadata integrity only: it never infers a
 * world, work, narrative fact, or reading requirement.
 */
export function resolveBibliographyAssignmentIntegrity(
  catalog: readonly SourceCatalogEntry[],
  workAssignments: readonly BibliographyWorkAssignment[],
  worldAssignments: readonly BibliographyWorldAssignment[],
): BibliographyAssignmentIntegrityResult {
  const catalogIds = new Set(catalog.map((source) => source.id));
  const workBySource = new Map<string, string>();
  const worldBySource = new Map<string, string>();
  const blockedSourceIds = new Set<string>();
  const blockedWorkIds = new Set<string>();
  const blockedWorldIds = new Set<string>();

  for (const assignment of workAssignments) {
    if (!assignment.sourceId || !catalogIds.has(assignment.sourceId) || workBySource.has(assignment.sourceId)) {
      blockedSourceIds.add(assignment.sourceId);
    }
    if (!assignment.workId) blockedWorkIds.add(assignment.workId);
    workBySource.set(assignment.sourceId, assignment.workId);
  }

  for (const assignment of worldAssignments) {
    if (!assignment.sourceId || !catalogIds.has(assignment.sourceId) || worldBySource.has(assignment.sourceId)) {
      blockedSourceIds.add(assignment.sourceId);
    }
    if (!assignment.worldId) blockedWorldIds.add(assignment.worldId);
    worldBySource.set(assignment.sourceId, assignment.worldId);
  }

  const sourceIds = new Set([...workBySource.keys(), ...worldBySource.keys()]);
  if (blockedSourceIds.size || blockedWorkIds.size || blockedWorldIds.size) {
    return { status: "blocked", sourceIds: [], blockedSourceIds: [...blockedSourceIds], blockedWorkIds: [...blockedWorkIds], blockedWorldIds: [...blockedWorldIds] };
  }

  return { status: "valid", sourceIds: [...sourceIds], blockedSourceIds: [], blockedWorkIds: [], blockedWorldIds: [] };
}
