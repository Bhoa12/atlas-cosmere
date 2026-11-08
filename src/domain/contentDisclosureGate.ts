import { ContentEvidence, resolveContentEvidence } from "./contentEvidenceGate";
import { SourceCatalogEntry } from "./sourceCatalog";
import { SourceWorkBinding } from "./sourceWorkBinding";
import { ReadingProgressEntry } from "./readingProgressState";
import { ReadingUnit } from "./readingUnitRegistry";
import { SpoilerRevealRequest, resolveSpoilerAuthorization } from "./spoilerAuthorization";

export interface ContentDisclosureResolution {
  status: "available" | "withheld" | "unavailable" | "blocked";
}

/**
 * Resolves disclosure only when both independent gates agree: provenance/evidence
 * and reader spoiler authorization. This module deliberately contains no narrative
 * text and never upgrades one gate's result from the other.
 */
export function resolveContentDisclosure(
  catalog: readonly SourceCatalogEntry[],
  bindings: readonly SourceWorkBinding[],
  declaredWorkIds: readonly string[],
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgressEntry[],
  evidence: ContentEvidence,
  request: SpoilerRevealRequest,
): ContentDisclosureResolution {
  if (evidence.contentId !== request.contentId) return { status: "blocked" };

  const evidenceState = resolveContentEvidence(catalog, bindings, evidence);
  if (evidenceState.status === "blocked") return { status: "blocked" };
  if (evidenceState.status === "unavailable") return { status: "unavailable" };

  const spoilerState = resolveSpoilerAuthorization(declaredWorkIds, units, progress, request);
  if (spoilerState.status === "blocked") return { status: "blocked" };
  return spoilerState.status === "authorized"
    ? { status: "available" }
    : { status: "withheld" };
}
