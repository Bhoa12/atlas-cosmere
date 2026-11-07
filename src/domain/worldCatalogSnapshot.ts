import { CatalogWorldLink, findWorkIdsForWorld } from "./worldCatalogIndex";
import { SourceCatalogEntry, findCatalogEntry, hasValidSourceCatalog } from "./sourceCatalog";

export type WorldCatalogSnapshotStatus = "blocked" | "cataloged";

export interface WorldCatalogWorkSnapshot {
  workId: string;
  sourceAccess: SourceCatalogEntry["access"];
}

export interface WorldCatalogSnapshot {
  status: WorldCatalogSnapshotStatus;
  worldId: string | null;
  works: WorldCatalogWorkSnapshot[];
}

/**
 * Exposes bibliographic associations without treating them as narrative evidence.
 * Invalid indexes, sources, or missing source records fail closed.
 */
export function resolveWorldCatalogSnapshot(
  links: CatalogWorldLink[],
  sources: SourceCatalogEntry[],
  worldId: string,
): WorldCatalogSnapshot {
  if (
    typeof worldId !== "string" ||
    !worldId.trim() ||
    !hasValidSourceCatalog(sources)
  ) return { status: "blocked", worldId: null, works: [] };

  const workIds = findWorkIdsForWorld(links, worldId);
  if (!workIds) return { status: "blocked", worldId: null, works: [] };

  const works = workIds.map((workId) => {
    const source = findCatalogEntry(sources, workId);
    return source ? { workId, sourceAccess: source.access } : null;
  });

  if (works.some((work) => work === null)) {
    return { status: "blocked", worldId: null, works: [] };
  }

  return {
    status: "cataloged",
    worldId,
    works: works as WorldCatalogWorkSnapshot[],
  };
}
