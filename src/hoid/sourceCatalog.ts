import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import type { HoidCatalogEntry } from "./contracts";

/**
 * Verified source catalog for Hoid IA.
 *
 * The bibliography is the single canonical identity registry for private
 * sources. Deriving this catalog from it prevents reading progress, source
 * provenance and spoiler authorization from drifting into incompatible ID
 * namespaces.
 *
 * This file intentionally exposes only bibliographic metadata. It does not
 * embed EPUB text, quotations, or narrative claims.
 */
export const HOID_SOURCE_CATALOG: readonly HoidCatalogEntry[] =
  HOID_SOURCE_BIBLIOGRAPHY.map(({ id, title }) => ({ id, title }));

export const HOID_SOURCE_CATALOG_IDS: ReadonlySet<string> = new Set(
  HOID_SOURCE_CATALOG.map((entry) => entry.id),
);
