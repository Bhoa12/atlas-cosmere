import { WorldReadingCoverage, hasVerifiedWorldReadingCoverage } from "./worldReadingCoverage";
import { resolveWorldCatalogSnapshot } from "./worldCatalogSnapshot";

export type WorldExpansionReadinessStatus = "blocked" | "cataloged" | "structure-ready";

export interface WorldExpansionReadiness {
  status: WorldExpansionReadinessStatus;
  worldId: string | null;
  workCount: number;
  verifiedStructure: boolean;
}

/**
 * Produces a conservative integration status for a world.
 * Bibliographic presence and structural readiness remain separate: neither
 * status represents narrative verification or permission to expose spoilers.
 */
export function resolveWorldExpansionReadiness(
  coverage: WorldReadingCoverage,
): WorldExpansionReadiness {
  const catalog = resolveWorldCatalogSnapshot(
    coverage.catalogLinks,
    coverage.sources,
    coverage.worldId,
  );

  if (catalog.status === "blocked") {
    return { status: "blocked", worldId: null, workCount: 0, verifiedStructure: false };
  }

  const verifiedStructure = hasVerifiedWorldReadingCoverage(coverage);
  return {
    status: verifiedStructure ? "structure-ready" : "cataloged",
    worldId: catalog.worldId,
    workCount: catalog.works.length,
    verifiedStructure,
  };
}
