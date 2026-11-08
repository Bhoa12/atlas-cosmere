import { SourceCatalogEntry, hasValidSourceCatalog } from "./sourceCatalog";
import { SourceWorkBinding, validateSourceWorkBindings } from "./sourceWorkBinding";

export interface DeclaredWorkCoverage {
  status: "valid" | "blocked";
  coveredWorkIds: readonly string[];
  pendingWorkIds: readonly string[];
}

/**
 * Audits a declared reading-model work list against explicit source bindings.
 * It never infers a source from titles, world names, or bibliography order.
 */
export function resolveDeclaredWorkCoverage(
  declaredWorkIds: readonly string[],
  catalog: readonly SourceCatalogEntry[],
  bindings: readonly SourceWorkBinding[],
): DeclaredWorkCoverage {
  const normalizedWorks = declaredWorkIds.map((id) =>
    typeof id === "string" ? id.trim() : "",
  );
  if (
    normalizedWorks.length === 0 ||
    normalizedWorks.some((id) => !id) ||
    new Set(normalizedWorks).size !== normalizedWorks.length ||
    !hasValidSourceCatalog([...catalog]) ||
    validateSourceWorkBindings(bindings).length > 0
  ) {
    return { status: "blocked", coveredWorkIds: [], pendingWorkIds: [] };
  }

  const catalogIds = new Set(catalog.map((entry) => entry.id.trim()));
  if (bindings.some((binding) => !catalogIds.has(binding.sourceId.trim()))) {
    return { status: "blocked", coveredWorkIds: [], pendingWorkIds: [] };
  }

  const boundWorks = new Set(bindings.map((binding) => binding.workId.trim()));
  const coveredWorkIds = normalizedWorks.filter((id) => boundWorks.has(id)).sort();
  const pendingWorkIds = normalizedWorks.filter((id) => !boundWorks.has(id)).sort();
  return { status: "valid", coveredWorkIds, pendingWorkIds };
}
