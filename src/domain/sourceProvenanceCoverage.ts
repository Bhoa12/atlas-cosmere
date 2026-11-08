import { hasValidSourceCatalog, SourceCatalogEntry } from "./sourceCatalog";
import { SourceWorkBinding, validateSourceWorkBindings } from "./sourceWorkBinding";

export interface SourceProvenanceCoverageResolution {
  status: "complete" | "incomplete" | "blocked";
  uncoveredWorkIds: string[];
}

/**
 * Verifies structural source coverage for declared works. Coverage means only
 * that a cataloged source is explicitly bound to the work; it never claims
 * that narrative text or editorial facts were accessed.
 */
export function resolveSourceProvenanceCoverage(
  declaredWorkIds: readonly string[],
  catalog: readonly SourceCatalogEntry[],
  bindings: readonly SourceWorkBinding[],
): SourceProvenanceCoverageResolution {
  const works = declaredWorkIds.map((id) => typeof id === "string" ? id.trim() : "");

  if (
    works.length === 0 ||
    works.some((id) => !id) ||
    new Set(works).size !== works.length ||
    !hasValidSourceCatalog([...catalog]) ||
    validateSourceWorkBindings(bindings).length > 0
  ) return { status: "blocked", uncoveredWorkIds: [] };

  const catalogIds = new Set(catalog.map((entry) => entry.id.trim()));
  const covered = new Set<string>();

  for (const binding of bindings) {
    const sourceId = binding.sourceId.trim();
    const workId = binding.workId.trim();
    if (!catalogIds.has(sourceId)) return { status: "blocked", uncoveredWorkIds: [] };
    if (works.includes(workId)) covered.add(workId);
  }

  const uncoveredWorkIds = works.filter((workId) => !covered.has(workId));
  return {
    status: uncoveredWorkIds.length === 0 ? "complete" : "incomplete",
    uncoveredWorkIds,
  };
}
