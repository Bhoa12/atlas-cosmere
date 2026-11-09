import { SourceCatalogEntry } from "./sourceCatalog";

export interface BibliographyWorldAssignment {
  sourceId: string;
  worldId: string;
}

export interface BibliographyWorldAssignmentResult {
  status: "valid" | "blocked";
  assignments: readonly BibliographyWorldAssignment[];
  blockedSourceIds: readonly string[];
}

/**
 * Validates explicitly declared source-to-world metadata.
 * It never infers a world from a title, filename, series name, or narrative
 * knowledge. Sources may remain intentionally unassigned until backed metadata
 * is available.
 */
export function resolveBibliographyWorldAssignments(
  catalog: readonly SourceCatalogEntry[],
  assignments: readonly BibliographyWorldAssignment[],
): BibliographyWorldAssignmentResult {
  const catalogIds = new Set(catalog.map((source) => source.id));
  const seenSources = new Set<string>();
  const blocked = new Set<string>();

  for (const assignment of assignments) {
    if (!assignment.sourceId || !assignment.worldId || seenSources.has(assignment.sourceId)) {
      blocked.add(assignment.sourceId);
    }
    seenSources.add(assignment.sourceId);
    if (!catalogIds.has(assignment.sourceId)) blocked.add(assignment.sourceId);
  }

  return blocked.size
    ? { status: "blocked", assignments: [], blockedSourceIds: [...blocked] }
    : { status: "valid", assignments: [...assignments], blockedSourceIds: [] };
}
