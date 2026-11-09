import { SpoilerAccessDecision } from "./spoilerAccessPolicy";

export interface SpoilerDisclosureItem {
  contentId: string;
  kind: string;
}

export interface SpoilerDisclosureManifestEntry extends SpoilerDisclosureItem {
  visible: boolean;
}

export interface SpoilerDisclosureManifestResult {
  status: "valid" | "blocked";
  entries: readonly SpoilerDisclosureManifestEntry[];
}

/**
 * Produces a UI-facing disclosure manifest from explicit access decisions.
 *
 * This layer intentionally transports identifiers and classification metadata only.
 * Narrative payloads remain outside the result so an authorization bug cannot expose
 * protected text by omission of a later filtering step.
 */
export function resolveSpoilerDisclosureManifest(
  items: readonly SpoilerDisclosureItem[],
  access: readonly SpoilerAccessDecision[],
): SpoilerDisclosureManifestResult {
  const itemIds = new Set<string>();
  const accessById = new Map<string, SpoilerAccessDecision>();

  for (const decision of access) {
    if (
      !decision.contentId ||
      typeof decision.allowed !== "boolean" ||
      accessById.has(decision.contentId)
    ) {
      return { status: "blocked", entries: [] };
    }
    accessById.set(decision.contentId, decision);
  }

  const entries: SpoilerDisclosureManifestEntry[] = [];
  for (const item of items) {
    if (!item.contentId || !item.kind || itemIds.has(item.contentId)) {
      return { status: "blocked", entries: [] };
    }
    itemIds.add(item.contentId);

    const decision = accessById.get(item.contentId);
    if (!decision) return { status: "blocked", entries: [] };
    entries.push({ ...item, visible: decision.allowed });
  }

  for (const contentId of accessById.keys()) {
    if (!itemIds.has(contentId)) return { status: "blocked", entries: [] };
  }

  return { status: "valid", entries };
}
