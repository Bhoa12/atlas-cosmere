import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
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

  const bibliographyIds = new Set(HOID_SOURCE_BIBLIOGRAPHY.map((entry) => entry.id));
  if (bibliographyIds.size !== HOID_SOURCE_BIBLIOGRAPHY.length) {
    throw new Error("Bibliography contains duplicate identifiers");
  }

  if (bibliographyIds.size !== HOID_SOURCE_CATALOG_IDS.size) {
    throw new Error("Source catalog and bibliography disagree on source identities");
  }

  if (!Object.isFrozen(HOID_SOURCE_CATALOG)) {
    throw new Error("Source catalog must be frozen at its shared identity boundary");
  }

  for (const entry of HOID_SOURCE_CATALOG) {
    if (!Object.isFrozen(entry)) {
      throw new Error("Source catalog metadata entries must be immutable");
    }
    if (entry.id.trim().length === 0 || entry.title.trim().length === 0) {
      throw new Error("Source catalog contains an incomplete metadata entry");
    }
    if (!bibliographyIds.has(entry.id)) {
      throw new Error("Source catalog contains an identity outside the bibliography");
    }
  }
}
