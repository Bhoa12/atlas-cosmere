import type { ReaderProgress, WorldCatalogEntry } from "./cosmereCatalog";
import type { CatalogProvenance } from "./catalogProvenance";
import { validateCatalog } from "./cosmereCatalog";
import { validateProgressBoundaries, type ProgressBoundaryIssue } from "./progressBoundaryValidation";
import { validateCatalogSourceCoverage, type CatalogSourceCoverageIssue } from "./catalogSourceCoverage";
import { validateWorkSequences, type WorkSequenceIssue } from "./workSequenceValidation";
import type { CompositeSpoilerGate } from "./compositeSpoilerGates";
import { validateSpoilerGateCatalogCoverage, type SpoilerGateCatalogIssue } from "./spoilerGateCatalogCoverage";

export type ExpansionIntegrityIssue =
  | { layer: "catalog"; message: string }
  | { layer: "progress"; issue: ProgressBoundaryIssue }
  | { layer: "provenance"; issue: CatalogSourceCoverageIssue }
  | { layer: "sequence"; issue: WorkSequenceIssue }
  | { layer: "spoiler_gate_catalog"; issue: SpoilerGateCatalogIssue };

export interface ExpansionIntegrityInput {
  worlds: readonly WorldCatalogEntry[];
  progress: readonly ReaderProgress[];
  provenance?: readonly CatalogProvenance[];
  gates?: readonly CompositeSpoilerGate[];
}

/**
 * Runs metadata-only integrity checks across the reusable expansion model.
 * Optional provenance and gates enable additional checks without requiring callers
 * to invent source links or spoiler checkpoints when metadata is unavailable.
 */
export function validateExpansionIntegrity(input: ExpansionIntegrityInput): readonly ExpansionIntegrityIssue[] {
  const works = input.worlds.flatMap((world) => world.works);
  const issues: ExpansionIntegrityIssue[] = [
    ...validateCatalog(input.worlds).map((message) => ({ layer: "catalog" as const, message })),
    ...validateWorkSequences(works).map((issue) => ({ layer: "sequence" as const, issue })),
    ...validateProgressBoundaries(works, input.progress).map((issue) => ({ layer: "progress" as const, issue })),
  ];

  if (input.gates) {
    issues.push(
      ...validateSpoilerGateCatalogCoverage(input.worlds, input.gates).map(
        (issue) => ({ layer: "spoiler_gate_catalog" as const, issue }),
      ),
    );
  }

  if (input.provenance) {
    issues.push(
      ...validateCatalogSourceCoverage(input.worlds, input.provenance).map(
        (issue) => ({ layer: "provenance" as const, issue }),
      ),
    );
  }

  return issues;
}
