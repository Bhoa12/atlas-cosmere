import { DeclaredContentScopeEntry } from "./declaredContentScope";
import { ContentEvidence } from "./contentEvidenceGate";
import { resolveContentDisclosureDecisionBatch, ContentDisclosureDecisionBatch } from "./contentDisclosureDecisionBatch";
import { resolveContentScopeIntegrity } from "./contentScopeIntegrity";
import { SourceCatalogEntry } from "./sourceCatalog";
import { SourceWorkBinding } from "./sourceWorkBinding";
import { ReadingProgressEntry } from "./readingProgressState";
import { ReadingUnit } from "./readingUnitRegistry";
import { SpoilerRevealRequest } from "./spoilerAuthorization";

export interface CosmereDisclosurePlan extends ContentDisclosureDecisionBatch {
  integrity: "valid" | "blocked";
}

/**
 * Application-facing orchestration boundary for a declared content scope.
 * Structural identity is checked before any disclosure decision is produced,
 * so a batch cannot silently cross works while reusing technical content IDs.
 * This function carries no narrative payload and preserves fail-closed behavior.
 */
export function resolveCosmereDisclosurePlan(
  scope: readonly DeclaredContentScopeEntry[],
  catalog: readonly SourceCatalogEntry[],
  bindings: readonly SourceWorkBinding[],
  declaredWorkIds: readonly string[],
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgressEntry[],
  evidence: readonly ContentEvidence[],
  requests: readonly SpoilerRevealRequest[],
): CosmereDisclosurePlan {
  const integrity = resolveContentScopeIntegrity(scope, evidence, requests);
  if (integrity.status === "blocked") {
    return { status: "blocked", integrity: "blocked", decisions: [], blockedContentIds: [] };
  }

  const batch = resolveContentDisclosureDecisionBatch(
    catalog, bindings, declaredWorkIds, units, progress, evidence, requests,
  );
  return { ...batch, integrity: "valid" };
}
