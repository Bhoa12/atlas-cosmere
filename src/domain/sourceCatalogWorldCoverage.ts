import { hasValidSourceCatalog, SourceCatalogEntry } from "./sourceCatalog";

export interface CatalogWorldAssignment {
  catalogEntryId: string;
  worldId: string;
}

export interface WorldCatalogCoverageRequest {
  expectedWorldIds: readonly string[];
}

export interface WorldCatalogCoverageResult {
  status: "complete" | "incomplete" | "blocked";
  coveredWorldIds: readonly string[];
  missingWorldIds: readonly string[];
}

/**
 * Relates declared catalog entries to declared world identifiers without
 * inspecting narrative text. World membership is supplied as explicit metadata;
 * it is never inferred from a title, filename, series, or source contents.
 */
export function resolveWorldCatalogCoverage(
  catalog: readonly SourceCatalogEntry[],
  assignments: readonly CatalogWorldAssignment[],
  request: WorldCatalogCoverageRequest,
): WorldCatalogCoverageResult {
  const blocked = (): WorldCatalogCoverageResult => ({
    status: "blocked",
    coveredWorldIds: [],
    missingWorldIds: [],
  });

  if (
    !hasValidSourceCatalog([...catalog]) ||
    !Array.isArray(request.expectedWorldIds) ||
    request.expectedWorldIds.length === 0
  ) return blocked();

  const expected = new Set<string>();
  for (const worldId of request.expectedWorldIds) {
    if (typeof worldId !== "string" || !worldId.trim() || expected.has(worldId)) {
      return blocked();
    }
    expected.add(worldId);
  }

  const catalogIds = new Set(catalog.map((entry) => entry.id));
  const assignedEntryIds = new Set<string>();
  const covered = new Set<string>();

  for (const assignment of assignments) {
    if (
      !assignment ||
      typeof assignment.catalogEntryId !== "string" ||
      !assignment.catalogEntryId.trim() ||
      typeof assignment.worldId !== "string" ||
      !assignment.worldId.trim() ||
      !catalogIds.has(assignment.catalogEntryId) ||
      assignedEntryIds.has(assignment.catalogEntryId)
    ) return blocked();

    assignedEntryIds.add(assignment.catalogEntryId);
    if (expected.has(assignment.worldId)) covered.add(assignment.worldId);
  }

  const coveredWorldIds = request.expectedWorldIds.filter((id) => covered.has(id));
  const missingWorldIds = request.expectedWorldIds.filter((id) => !covered.has(id));

  return {
    status: missingWorldIds.length === 0 ? "complete" : "incomplete",
    coveredWorldIds,
    missingWorldIds,
  };
}
