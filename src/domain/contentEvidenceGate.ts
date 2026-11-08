import { hasValidSourceCatalog, SourceCatalogEntry } from "./sourceCatalog";
import { isSourceBoundToWork, SourceWorkBinding, validateSourceWorkBindings } from "./sourceWorkBinding";

export interface ContentEvidence {
  contentId: string;
  workId: string;
  sourceId: string;
  evidenceKind: "metadata" | "original-summary";
}

export interface ContentEvidenceResolution {
  status: "available" | "unavailable" | "blocked";
}

/**
 * Resolves whether a content item has explicit structural evidence. This module
 * stores no source passages: an original summary is available only when its
 * source is explicitly bound to the declared work and that source has verified
 * structure. Metadata may use a cataloged source. Unknown or ambiguous evidence
 * always fails closed.
 */
export function resolveContentEvidence(
  catalog: readonly SourceCatalogEntry[],
  bindings: readonly SourceWorkBinding[],
  evidence: ContentEvidence,
): ContentEvidenceResolution {
  const contentId = typeof evidence.contentId === "string" ? evidence.contentId.trim() : "";
  const workId = typeof evidence.workId === "string" ? evidence.workId.trim() : "";
  const sourceId = typeof evidence.sourceId === "string" ? evidence.sourceId.trim() : "";

  if (
    !contentId || !workId || !sourceId ||
    (evidence.evidenceKind !== "metadata" && evidence.evidenceKind !== "original-summary") ||
    !hasValidSourceCatalog([...catalog]) ||
    validateSourceWorkBindings(bindings).length > 0 ||
    !isSourceBoundToWork(sourceId, workId, bindings)
  ) return { status: "blocked" };

  const source = catalog.find((entry) => entry.id.trim() === sourceId);
  if (!source) return { status: "blocked" };

  if (evidence.evidenceKind === "metadata") return { status: "available" };
  return source.access === "verified-structure"
    ? { status: "available" }
    : { status: "unavailable" };
}
