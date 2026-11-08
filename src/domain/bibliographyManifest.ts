import { SourceCatalogEntry, hasValidSourceCatalog } from "./sourceCatalog";
import { SourceWorkBinding, validateSourceWorkBindings } from "./sourceWorkBinding";

export interface BibliographyManifestResolution {
  status: "complete" | "incomplete" | "blocked";
  uncoveredWorkIds: readonly string[];
}

/**
 * Checks bibliographic provenance without deriving editorial relationships.
 * A work is covered only by an explicit source-to-work binding whose source
 * exists in the supplied catalog. Catalog membership alone never proves that
 * narrative text was read or that content may be disclosed.
 */
export function resolveBibliographyManifest(
  catalog: readonly SourceCatalogEntry[],
  bindings: readonly SourceWorkBinding[],
  declaredWorkIds: readonly string[],
): BibliographyManifestResolution {
  if (
    !hasValidSourceCatalog([...catalog]) ||
    validateSourceWorkBindings(bindings).length > 0 ||
    declaredWorkIds.length === 0
  ) {
    return { status: "blocked", uncoveredWorkIds: [] };
  }

  const workIds = new Set<string>();
  for (const workId of declaredWorkIds) {
    if (typeof workId !== "string" || !workId.trim() || workIds.has(workId)) {
      return { status: "blocked", uncoveredWorkIds: [] };
    }
    workIds.add(workId);
  }

  const sourceIds = new Set(catalog.map((source) => source.id));
  const coveredWorkIds = new Set<string>();
  for (const binding of bindings) {
    if (!sourceIds.has(binding.sourceId) || !workIds.has(binding.workId)) {
      return { status: "blocked", uncoveredWorkIds: [] };
    }
    coveredWorkIds.add(binding.workId);
  }

  const uncoveredWorkIds = declaredWorkIds.filter((workId) => !coveredWorkIds.has(workId));
  return uncoveredWorkIds.length === 0
    ? { status: "complete", uncoveredWorkIds: [] }
    : { status: "incomplete", uncoveredWorkIds };
}
