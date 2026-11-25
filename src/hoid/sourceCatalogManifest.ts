import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { sha256Hex } from "./sha256";

export type HoidSourceCatalogManifest = Readonly<{
  schemaVersion: 1;
  scope: "metadata-only";
  /** This manifest makes no assertion that the private source bytes are currently accessible. */
  accessStatus: "not-asserted";
  sourceContentIncluded: false;
  fingerprint: string;
  workCount: number;
  groups: Readonly<{
    cosmereEpub: number;
    rosharEpubs: number;
  }>;
  works: readonly Readonly<{
    id: string;
    title: string;
    sourceGroup: "cosmere.epub" | "roshar-epubs";
  }>[];
}>;

/**
 * A deterministic identity snapshot for the user-supplied source catalogue.
 *
 * The fingerprint covers only the ordered (id, title, sourceGroup) tuples.
 * It does not fingerprint EPUB bytes, edition navigation, chapter documents,
 * summaries or current file availability. It is descriptive metadata and must
 * never be used as an authorization or spoiler-unlock input.
 */
const works = Object.freeze(HOID_SOURCE_BIBLIOGRAPHY.map(source => Object.freeze({
  id: source.id,
  title: source.title,
  sourceGroup: source.sourceGroup,
})));

const canonicalPayload = JSON.stringify({
  schemaVersion: 1,
  works: works.map(source => [source.id, source.title, source.sourceGroup]),
});

export const HOID_SOURCE_CATALOG_MANIFEST: HoidSourceCatalogManifest = Object.freeze({
  schemaVersion: 1,
  scope: "metadata-only",
  accessStatus: "not-asserted",
  sourceContentIncluded: false,
  fingerprint: sha256Hex(canonicalPayload),
  workCount: works.length,
  groups: Object.freeze({
    cosmereEpub: works.filter(source => source.sourceGroup === "cosmere.epub").length,
    rosharEpubs: works.filter(source => source.sourceGroup === "roshar-epubs").length,
  }),
  works,
});

/** Return the immutable metadata-only source catalogue snapshot. */
export function getHoidSourceCatalogManifest(): HoidSourceCatalogManifest {
  return HOID_SOURCE_CATALOG_MANIFEST;
}
