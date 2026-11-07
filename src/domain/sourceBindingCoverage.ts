import { hasValidSourceCatalog, SourceCatalogEntry } from "./sourceCatalog";
import { SourceWorkBinding, validateSourceWorkBindings } from "./sourceWorkBinding";

export interface SourceBindingCoverage {
  status: "valid" | "blocked";
  coveredSourceIds: readonly string[];
  uncoveredSourceIds: readonly string[];
  unknownBindingSourceIds: readonly string[];
}

/**
 * Audits explicit source-to-work provenance against a declared catalog.
 * It never creates relationships from titles, collection names or ordering.
 */
export function auditSourceBindingCoverage(
  catalog: readonly SourceCatalogEntry[],
  bindings: readonly SourceWorkBinding[],
): SourceBindingCoverage {
  if (!hasValidSourceCatalog(catalog) || validateSourceWorkBindings(bindings).length > 0) {
    return { status: "blocked", coveredSourceIds: [], uncoveredSourceIds: [], unknownBindingSourceIds: [] };
  }
  const catalogIds = new Set(catalog.map((entry) => entry.sourceId));
  const boundIds = new Set(bindings.map((binding) => binding.sourceId));
  const unknown = [...boundIds].filter((id) => !catalogIds.has(id)).sort();
  if (unknown.length > 0) {
    return { status: "blocked", coveredSourceIds: [], uncoveredSourceIds: [], unknownBindingSourceIds: unknown };
  }
  const coveredSourceIds = [...catalogIds].filter((id) => boundIds.has(id)).sort();
  const uncoveredSourceIds = [...catalogIds].filter((id) => !boundIds.has(id)).sort();
  return { status: "valid", coveredSourceIds, uncoveredSourceIds, unknownBindingSourceIds: [] };
}
