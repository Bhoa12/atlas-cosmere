import { HOID_SOURCE_CATALOG, HOID_SOURCE_CATALOG_IDS } from "./sourceCatalog";

/**
 * Lightweight catalog invariants kept dependency-free so they can be reused
 * by any future test runner.
 */
export function assertHoidSourceCatalog(): void {
  if (HOID_SOURCE_CATALOG.length === 0) throw new Error("Source catalog is empty");
  if (HOID_SOURCE_CATALOG_IDS.size !== HOID_SOURCE_CATALOG.length) {
    throw new Error("Source catalog contains duplicate identifiers");
  }

  for (const entry of HOID_SOURCE_CATALOG) {
    if (entry.id.trim().length === 0 || entry.title.trim().length === 0) {
      throw new Error("Source catalog contains an incomplete metadata entry");
    }
  }
}
