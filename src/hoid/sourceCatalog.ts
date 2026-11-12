import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import type { HoidCatalogEntry } from "./contracts";

/** Verified metadata-only source catalog for Hoid IA. */
export const HOID_SOURCE_CATALOG: readonly Readonly<HoidCatalogEntry>[] = Object.freeze(
  HOID_SOURCE_BIBLIOGRAPHY.map(({ id, title }) => Object.freeze({ id, title })),
);

/** Keep the mutable Set implementation private so callers cannot alter the authorization namespace. */
const HOID_SOURCE_CATALOG_ID_SET = new Set(HOID_SOURCE_CATALOG.map((entry) => entry.id));

/** Immutable snapshot for callers that need to enumerate canonical IDs. */
export const HOID_SOURCE_CATALOG_IDS: readonly string[] = Object.freeze([...HOID_SOURCE_CATALOG_ID_SET]);

/** Provider-neutral membership check for catalog-bound authorization. */
export function isKnownHoidCatalogSourceId(value: unknown): value is string {
  return typeof value === "string" && HOID_SOURCE_CATALOG_ID_SET.has(value.trim());
}
