import { SourceCatalogEntry } from "./sourceCatalog";
import { BibliographyWorkAssignment } from "./bibliographyWorkAssignments";
import { BibliographyWorldAssignment } from "./bibliographyWorldAssignments";
import { resolveBibliographyAssignmentIntegrity } from "./bibliographyAssignmentIntegrity";

export interface BibliographyAssignmentCoverageResult {
  status: "complete" | "incomplete" | "blocked";
  coveredSourceIds: readonly string[];
  uncoveredSourceIds: readonly string[];
  blockedSourceIds: readonly string[];
}

/**
 * Reconciles explicit bibliography relationships without deriving missing
 * metadata. A source is covered only when it has both a work and a world
 * assignment. This is structural provenance coverage, not narrative evidence.
 */
export function resolveBibliographyAssignmentCoverage(
  catalog: readonly SourceCatalogEntry[],
  workAssignments: readonly BibliographyWorkAssignment[],
  worldAssignments: readonly BibliographyWorldAssignment[],
): BibliographyAssignmentCoverageResult {
  const integrity = resolveBibliographyAssignmentIntegrity(
    catalog,
    workAssignments,
    worldAssignments,
  );

  if (integrity.status === "blocked") {
    return {
      status: "blocked",
      coveredSourceIds: [],
      uncoveredSourceIds: [],
      blockedSourceIds: [...integrity.blockedSourceIds],
    };
  }

  const workSources = new Set(workAssignments.map((assignment) => assignment.sourceId));
  const worldSources = new Set(worldAssignments.map((assignment) => assignment.sourceId));
  const coveredSourceIds = catalog
    .map((source) => source.id)
    .filter((sourceId) => workSources.has(sourceId) && worldSources.has(sourceId));
  const uncoveredSourceIds = catalog
    .map((source) => source.id)
    .filter((sourceId) => !workSources.has(sourceId) || !worldSources.has(sourceId));

  return {
    status: uncoveredSourceIds.length ? "incomplete" : "complete",
    coveredSourceIds,
    uncoveredSourceIds,
    blockedSourceIds: [],
  };
}
