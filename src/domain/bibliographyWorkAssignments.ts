import { SourceCatalogEntry } from "./sourceCatalog";

export interface BibliographyWorkAssignment {
  sourceId: string;
  workId: string;
}

export interface BibliographyWorkAssignmentResult {
  status: "valid" | "blocked";
  assignments: readonly BibliographyWorkAssignment[];
  blockedSourceIds: readonly string[];
  blockedWorkIds: readonly string[];
}

/**
 * Validates explicitly declared source-to-work metadata.
 * It does not infer a work from a title, filename, collection, or narrative
 * knowledge. The caller must provide the complete relationship explicitly.
 */
export function resolveBibliographyWorkAssignments(
  catalog: readonly SourceCatalogEntry[],
  assignments: readonly BibliographyWorkAssignment[],
): BibliographyWorkAssignmentResult {
  const catalogIds = new Set(catalog.map((source) => source.id));
  const seenSources = new Set<string>();
  const seenWorks = new Set<string>();
  const blockedSources = new Set<string>();
  const blockedWorks = new Set<string>();

  for (const assignment of assignments) {
    const sourceId = assignment.sourceId;
    const workId = assignment.workId;

    if (!sourceId || seenSources.has(sourceId) || !catalogIds.has(sourceId)) {
      blockedSources.add(sourceId);
    }
    if (!workId || seenWorks.has(workId)) blockedWorks.add(workId);

    seenSources.add(sourceId);
    seenWorks.add(workId);
  }

  if (blockedSources.size || blockedWorks.size) {
    return {
      status: "blocked",
      assignments: [],
      blockedSourceIds: [...blockedSources],
      blockedWorkIds: [...blockedWorks],
    };
  }

  return {
    status: "valid",
    assignments: [...assignments],
    blockedSourceIds: [],
    blockedWorkIds: [],
  };
}
