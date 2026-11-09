import { hasValidSourceCatalog, SourceCatalogEntry } from "./sourceCatalog";
import { CatalogWorldAssignment, WorldCatalogCoverageRequest, resolveWorldCatalogCoverage } from "./sourceCatalogWorldCoverage";

export interface WorldCatalogExpansionReadiness {
  worldId: string;
  status: "ready" | "cataloged" | "blocked";
}

/**
 * Converts explicit catalog coverage into a conservative expansion-readiness
 * signal. It does not inspect source text or create editorial facts.
 */
export function resolveWorldCatalogExpansionReadiness(
  catalog: readonly SourceCatalogEntry[],
  assignments: readonly CatalogWorldAssignment[],
  request: WorldCatalogCoverageRequest,
): readonly WorldCatalogExpansionReadiness[] {
  const blocked = request.expectedWorldIds.map((worldId) => ({ worldId, status: "blocked" as const }));

  if (!hasValidSourceCatalog([...catalog])) return blocked;

  const coverage = resolveWorldCatalogCoverage(catalog, assignments, request);
  if (coverage.status === "blocked") return blocked;

  return request.expectedWorldIds.map((worldId) => ({
    worldId,
    status: coverage.coveredWorldIds.includes(worldId) ? "ready" : "cataloged",
  }));
}
