import type { WorldCatalogEntry } from "./cosmereCatalog";
import type { CatalogProvenance, CatalogProvenanceIssue } from "./catalogProvenance";
import { validateCatalogProvenance } from "./catalogProvenance";
import type { BibliographicSource } from "./bibliographicSources";
import type { CompositeSpoilerGate } from "./compositeSpoilerGates";
import type { SpoilerGateValidationIssue } from "./spoilerGateValidation";
import { validateCompositeSpoilerGates } from "./spoilerGateValidation";

export type CatalogExpansionValidationIssue =
  | { layer: "provenance"; issue: CatalogProvenanceIssue }
  | { layer: "spoiler_gate"; issue: SpoilerGateValidationIssue };

export interface CatalogExpansionValidationInput {
  worlds: readonly WorldCatalogEntry[];
  provenance: readonly CatalogProvenance[];
  sources: readonly BibliographicSource[];
  gates: readonly CompositeSpoilerGate[];
  knownWorkIds: readonly string[];
}

/** Aggregates existing structural validators without inferring editorial data. */
export function validateCatalogExpansion(
  input: CatalogExpansionValidationInput,
): readonly CatalogExpansionValidationIssue[] {
  return [
    ...validateCatalogProvenance(input.worlds, input.provenance, input.sources)
      .map((issue) => ({ layer: "provenance" as const, issue })),
    ...validateCompositeSpoilerGates(input.gates, input.knownWorkIds)
      .map((issue) => ({ layer: "spoiler_gate" as const, issue })),
  ];
}
