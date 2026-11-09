import { WorldReadingActivation } from "./worldReadingActivation";

export interface ReadingUnitManifestEntry {
  worldId: string;
  unitId: string;
  sourceCatalogEntryId: string;
  order: number;
}

export interface ReadingUnitManifestResult {
  status: "valid" | "blocked";
  entries: readonly ReadingUnitManifestEntry[];
  invalidWorldIds: readonly string[];
}

/**
 * Validates metadata-only reading-unit manifests. Units are allowed only for
 * worlds whose activation has been independently validated. This layer does
 * not inspect source text, infer chapters, or attach editorial summaries.
 */
export function resolveReadingUnitManifest(
  activation: readonly WorldReadingActivation[],
  activationValid: boolean,
  entries: readonly ReadingUnitManifestEntry[],
): ReadingUnitManifestResult {
  if (!activationValid) {
    return { status: "blocked", entries: [], invalidWorldIds: [] };
  }

  const activeWorlds = new Set<string>();
  const seenWorlds = new Set<string>();
  for (const item of activation) {
    if (!item || !item.worldId.trim() || seenWorlds.has(item.worldId)) {
      return { status: "blocked", entries: [], invalidWorldIds: [] };
    }
    seenWorlds.add(item.worldId);
    if (item.reason === "activated" && item.readingReady === true) {
      activeWorlds.add(item.worldId);
    }
  }

  const seenUnitIds = new Set<string>();
  const seenOrders = new Map<string, Set<number>>();
  const invalidWorldIds = new Set<string>();

  for (const entry of entries) {
    if (
      !entry ||
      !entry.worldId.trim() ||
      !entry.unitId.trim() ||
      !entry.sourceCatalogEntryId.trim() ||
      !Number.isInteger(entry.order) ||
      entry.order < 0 ||
      seenUnitIds.has(entry.unitId)
    ) {
      return { status: "blocked", entries: [], invalidWorldIds: [] };
    }

    seenUnitIds.add(entry.unitId);
    if (!activeWorlds.has(entry.worldId)) invalidWorldIds.add(entry.worldId);

    const orders = seenOrders.get(entry.worldId) ?? new Set<number>();
    if (orders.has(entry.order)) {
      return { status: "blocked", entries: [], invalidWorldIds: [] };
    }
    orders.add(entry.order);
    seenOrders.set(entry.worldId, orders);
  }

  if (invalidWorldIds.size > 0) {
    return {
      status: "blocked",
      entries: [],
      invalidWorldIds: [...invalidWorldIds],
    };
  }

  return {
    status: "valid",
    entries: entries.slice().sort((a, b) =>
      a.worldId.localeCompare(b.worldId) || a.order - b.order,
    ),
    invalidWorldIds: [],
  };
}
