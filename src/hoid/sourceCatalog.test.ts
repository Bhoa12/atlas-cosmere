import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  HOID_SOURCE_CATALOG,
  HOID_SOURCE_CATALOG_IDS,
  isKnownHoidCatalogSourceId,
} from "./sourceCatalog";

/** Lightweight catalog invariants kept dependency-free. */
export function assertHoidSourceCatalog(): void {
  if (HOID_SOURCE_CATALOG.length === 0) throw new Error("Source catalog is empty");
  if (HOID_SOURCE_CATALOG_IDS.length !== HOID_SOURCE_CATALOG.length) {
    throw new Error("Source catalog contains duplicate identifiers");
  }

  const bibliographyIds = new Set(HOID_SOURCE_BIBLIOGRAPHY.map((entry) => entry.id));
  if (bibliographyIds.size !== HOID_SOURCE_BIBLIOGRAPHY.length) {
    throw new Error("Bibliography contains duplicate identifiers");
  }

  if (bibliographyIds.size !== HOID_SOURCE_CATALOG_IDS.length) {
    throw new Error("Source catalog and bibliography disagree on source identities");
  }

  if (!Object.isFrozen(HOID_SOURCE_CATALOG) || !Object.isFrozen(HOID_SOURCE_CATALOG_IDS)) {
    throw new Error("Source catalog identity snapshots must be immutable");
  }

  for (const entry of HOID_SOURCE_CATALOG) {
    if (!Object.isFrozen(entry)) throw new Error("Source catalog metadata entries must be immutable");
    if (entry.id.trim().length === 0 || entry.title.trim().length === 0) {
      throw new Error("Source catalog contains an incomplete metadata entry");
    }
    if (!bibliographyIds.has(entry.id) || !isKnownHoidCatalogSourceId(entry.id)) {
      throw new Error("Source catalog contains an identity outside the bibliography");
    }
  }

  if (isKnownHoidCatalogSourceId("unknown-source")) {
    throw new Error("Unknown source must not enter the authorization namespace");
  }
}
