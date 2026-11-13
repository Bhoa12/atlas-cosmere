import { AtlasCatalog, ReadingProgress, ReadingUnit, SpoilerGate } from "./cosmereExpansionRun59";

export interface SourceRecord {
  id: string;
  provenance: "verified-index" | "declared-private";
  label: string;
}

export interface CatalogWithSources extends AtlasCatalog {
  sources: readonly SourceRecord[];
}

/**
 * Returns structural problems without deriving editorial facts from titles.
 */
export function validateCatalog(catalog: CatalogWithSources): string[] {
  const problems: string[] = [];
  const sourceIds = new Set<string>();
  for (const source of catalog.sources) {
    if (!source.id.trim() || !source.label.trim()) problems.push("source metadata must be non-empty");
    if (sourceIds.has(source.id)) problems.push(`duplicate source: ${source.id}`);
    sourceIds.add(source.id);
  }
  const workIds = new Set(catalog.works.map((work) => work.id));
  for (const work of catalog.works) {
    if (!work.title.trim()) problems.push(`work title must be non-empty: ${work.id}`);
    if (!sourceIds.has(work.sourceId)) problems.push(`unknown source: ${work.sourceId}`);
  }
  const seenPositions = new Set<string>();
  for (const unit of catalog.units) {
    if (!workIds.has(unit.workId)) problems.push(`unknown work: ${unit.workId}`);
    if (!Number.isInteger(unit.position) || unit.position < 1) problems.push(`invalid position: ${unit.id}`);
    const key = `${unit.workId}:${unit.position}`;
    if (seenPositions.has(key)) problems.push(`duplicate position: ${key}`);
    seenPositions.add(key);
  }
  return problems;
}

/**
 * Combines persisted progress snapshots conservatively.
 * Snapshots for another work or unknown/cross-work units are discarded.
 */
export function mergeProgress(
  catalog: AtlasCatalog,
  workId: string,
  snapshots: readonly ReadingProgress[],
): ReadingProgress {
  const valid = new Set(
    catalog.units.filter((unit) => unit.workId === workId).map((unit) => unit.id),
  );
  const completed = new Set<string>();
  for (const snapshot of snapshots) {
    if (snapshot.workId !== workId) continue;
    for (const unitId of snapshot.completedUnitIds) {
      if (valid.has(unitId)) completed.add(unitId);
    }
  }
  return { workId, completedUnitIds: [...completed] };
}

/**
 * Produces a spoiler gate only from explicit unit ids belonging to one work.
 * Invalid or duplicate requirements result in an undefined gate rather than
 * silently broadening what can be revealed.
 */
export function createGate(
  units: readonly ReadingUnit[],
  workId: string,
  requiredUnitIds: readonly string[],
): SpoilerGate | undefined {
  if (requiredUnitIds.length === 0 || new Set(requiredUnitIds).size !== requiredUnitIds.length) {
    return undefined;
  }
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  if (!requiredUnitIds.every((id) => byId.get(id)?.workId === workId)) return undefined;
  return { workId, requiredUnitIds: [...requiredUnitIds] };
}
