import {
  evaluateSpoilerGate,
  validateCatalog,
  type Catalog,
  type ProgressSnapshot,
  type SpoilerDecision,
} from "./cosmereExpansionRun72";

export interface ContentRecord {
  id: string;
  workId: string;
  sourceId: string;
  sourceKind: "accessible" | "metadata-only";
  summary?: string;
  requiredUnitIds: string[];
}

export interface ContentDecision {
  visible: boolean;
  reason: "invalid-catalog" | "invalid-content" | SpoilerDecision["reason"];
  pendingUnitIds: string[];
}

/**
 * Validates provenance without interpreting editorial facts.
 * A summary is accepted only when its declared source is explicitly accessible.
 */
export function validateContentRecord(catalog: Catalog, content: ContentRecord): string[] {
  const errors: string[] = [];
  if (!content.id.trim()) errors.push("content:empty-id");
  const work = catalog.works.find(item => item.id === content.workId);
  if (!work) errors.push("content:unknown-work:" + content.id);
  const source = catalog.sources.find(item => item.id === content.sourceId);
  if (!source) errors.push("content:unknown-source:" + content.id);
  if (content.sourceKind === "metadata-only" && content.summary?.trim()) {
    errors.push("content:summary-without-accessible-source:" + content.id);
  }
  if (content.summary?.trim() && source?.kind !== "accessible") {
    errors.push("content:summary-source-not-accessible:" + content.id);
  }
  if (content.sourceKind === "accessible" && source?.kind !== "accessible") {
    errors.push("content:declared-accessible-but-source-is-not:" + content.id);
  }
  return errors;
}

/** Fail closed: invalid provenance or reading state never reveals editorial content. */
export function evaluateContentVisibility(
  catalog: Catalog,
  content: ContentRecord,
  snapshots: ProgressSnapshot[],
): ContentDecision {
  if (validateCatalog(catalog).length) {
    return { visible: false, reason: "invalid-catalog", pendingUnitIds: [] };
  }
  if (validateContentRecord(catalog, content).length) {
    return { visible: false, reason: "invalid-content", pendingUnitIds: [] };
  }
  const gate = evaluateSpoilerGate(catalog, content.workId, content.requiredUnitIds, snapshots);
  return {
    visible: gate.allowed,
    reason: gate.reason,
    pendingUnitIds: gate.pendingUnitIds,
  };
}
