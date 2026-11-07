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
 * It never creates relationships from titles, collection names, or ordering.
 */
export function resolveSourceBindingCoverage(
  catalog: readonly SourceCatalogEntry[],
  bindings: readonly SourceWorkBinding[],
): SourceBindingCoverage {
  if (!hasValidSourceCatalog([...catalog]) || validateSourceWorkBindings(bindings).length > 0) {
    return { status: "blocked", coveredSourceIds: [], uncoveredSourceIds: [], unknownBindingSourceIds: [] };
  }
  const catalogIds = new Set(catalog.map((entry) => entry.id));
  const boundIds = new Set(bindings.map((binding) => binding.sourceId.trim()));
  const unknownBindingSourceIds = [...boundIds].filter((id) => !catalogIds.has(id)).sort();
  if (unknownBindingSourceIds.length) {
    return { status: "blocked", coveredSourceIds: [], uncoveredSourceIds: [], unknownBindingSourceIds };
  }
  return {
    status: "valid",
    coveredSourceIds: catalog.map((entry) => entry.id).filter((id) => boundIds.has(id)).sort(),
    uncoveredSourceIds: catalog.map((entry) => entry.id).filter((id) => !boundIds.has(id)).sort(),
    unknownBindingSourceIds: [],
  };
}
