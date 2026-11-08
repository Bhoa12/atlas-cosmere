import { ContentEvidence } from "./contentEvidenceGate";
import { ContentDisclosureResolution, resolveContentDisclosure } from "./contentDisclosureGate";
import { SourceCatalogEntry } from "./sourceCatalog";
import { SourceWorkBinding } from "./sourceWorkBinding";
import { ReadingProgressEntry } from "./readingProgressState";
import { ReadingUnit } from "./readingUnitRegistry";
import { SpoilerRevealRequest } from "./spoilerAuthorization";

export type ContentDisclosureReason =
  | "ready"
  | "missing-reading-progress"
  | "insufficient-evidence"
  | "invalid-request";

export interface ContentDisclosureDecision extends ContentDisclosureResolution {
  reason: ContentDisclosureReason;
}

/**
 * Converts the fail-closed disclosure state into a stable, non-narrative reason
 * suitable for UI and diagnostics. It deliberately does not reveal which reading
 * unit, event, or source passage caused a decision.
 */
export function resolveContentDisclosureDecision(
  catalog: readonly SourceCatalogEntry[],
  bindings: readonly SourceWorkBinding[],
  declaredWorkIds: readonly string[],
  units: readonly ReadingUnit[],
  progress: readonly ReadingProgressEntry[],
  evidence: ContentEvidence,
  request: SpoilerRevealRequest,
): ContentDisclosureDecision {
  const resolution = resolveContentDisclosure(
    catalog, bindings, declaredWorkIds, units, progress, evidence, request,
  );

  switch (resolution.status) {
    case "available":
      return { status: "available", reason: "ready" };
    case "withheld":
      return { status: "withheld", reason: "missing-reading-progress" };
    case "unavailable":
      return { status: "unavailable", reason: "insufficient-evidence" };
    default:
      return { status: "blocked", reason: "invalid-request" };
  }
}
