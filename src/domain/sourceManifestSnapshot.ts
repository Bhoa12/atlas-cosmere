import {
  BibliographicSourceEntry,
  validateBibliographicSourceManifest,
} from "./privateCosmereSourceCatalog";

export type SourceManifestStatus = "blocked" | "declared";

export interface SourceManifestSnapshot {
  status: SourceManifestStatus;
  sourceCount: number;
}

/**
 * Converts a bibliographic manifest into a conservative status.
 * A declared status only confirms a structurally valid list supplied to this
 * function; it never upgrades editorial access or reading evidence.
 */
export function resolveSourceManifestSnapshot(
  sources: readonly BibliographicSourceEntry[],
): SourceManifestSnapshot {
  if (sources.length === 0 || validateBibliographicSourceManifest(sources).length > 0) {
    return { status: "blocked", sourceCount: 0 };
  }
  return { status: "declared", sourceCount: sources.length };
}
