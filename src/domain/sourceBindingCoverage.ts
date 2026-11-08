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
 * Missing bindings remain pending; this function never infers a relationship
 * from titles, collection names, ordering, or narrative metadata.
 */
export function resolveSourceBindingCoverage(
  catalog: readonly SourceCatalogEntry[],
  bindings: readonly SourceWorkBinding[],
): SourceBindingCoverage {
  const catalogEntries = [...catalog];
  const bindingEntries = [...bindings];

  if (
    !hasValidSourceCatalog(catalogEntries) ||
    validateSourceWorkBindings(bindingEntries).length > 0
  ) {
    return {
      status: "blocked",
      coveredSourceIds: [],
      uncoveredSourceIds: [],
      unknownBindingSourceIds: [],
    };
  }

  const catalogIds = new Set(catalogEntries.map((entry) => entry.id));
  const boundIds = new Set(bindingEntries.map((binding) => binding.sourceId.trim()));
  const unknownBindingSourceIds = [...boundIds]
    .filter((id) => !catalogIds.has(id))
    .sort();

  if (unknownBindingSourceIds.length > 0) {
    return {
      status: "blocked",
      coveredSourceIds: [],
      uncoveredSourceIds: [],
      unknownBindingSourceIds,
    };
  }

  const coveredSourceIds = [...catalogIds].filter((id) => boundIds.has(id)).sort();
  const uncoveredSourceIds = [...catalogIds].filter((id) => !boundIds.has(id)).sort();

  return {
    status: "valid",
    coveredSourceIds,
    uncoveredSourceIds,
    unknownBindingSourceIds: [],
  };
}

/** Returns true only when every catalog source has an explicit binding. */
export function hasCompleteSourceBindingCoverage(
  catalog: readonly SourceCatalogEntry[],
  bindings: readonly SourceWorkBinding[],
): boolean {
  const coverage = resolveSourceBindingCoverage(catalog, bindings);
  return coverage.status === "valid" && coverage.uncoveredSourceIds.length === 0;
}

/** Backwards-compatible name for callers using the original audit terminology. */
export const auditSourceBindingCoverage = resolveSourceBindingCoverage;
