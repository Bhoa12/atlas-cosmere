export type SourceStatus = "verified-index" | "declared-private";

export interface CatalogueSource {
  id: string;
  title: string;
  status: SourceStatus;
}

export interface WorldRecord {
  id: string;
  title: string;
}

export interface WorkRecord {
  id: string;
  title: string;
  sourceId: string;
}

export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
  label: string;
}

export interface ReadingProgress {
  workId: string;
  completedUnitIds: string[];
}

export interface SpoilerGate {
  workId: string;
  requiredUnitIds: string[];
}

/**
 * Returns false unless every requirement is valid and completed.
 * This deliberately fails closed when catalogue data is incomplete.
 */
export function canReveal(
  gate: SpoilerGate,
  progress: ReadingProgress,
  units: ReadingUnit[],
): boolean {
  if (gate.workId !== progress.workId || gate.requiredUnitIds.length === 0) return false;
  if (new Set(gate.requiredUnitIds).size !== gate.requiredUnitIds.length) return false;

  const completed = new Set(progress.completedUnitIds);
  const byId = new Map(units.map((unit) => [unit.id, unit]));

  return gate.requiredUnitIds.every((id) => {
    const unit = byId.get(id);
    return unit?.workId === gate.workId && completed.has(id);
  });
}

export function validateCatalogue(
  sources: CatalogueSource[],
  worlds: WorldRecord[],
  works: WorkRecord[],
  units: ReadingUnit[],
): string[] {
  const errors: string[] = [];
  const duplicate = (ids: string[], label: string) => {
    if (new Set(ids).size !== ids.length) errors.push("duplicate-" + label);
  };

  duplicate(sources.map((x) => x.id), "source");
  duplicate(worlds.map((x) => x.id), "world");
  duplicate(works.map((x) => x.id), "work");
  duplicate(units.map((x) => x.id), "unit");

  const sourceIds = new Set(sources.map((x) => x.id));
  const workIds = new Set(works.map((x) => x.id));

  for (const work of works) {
    if (!sourceIds.has(work.sourceId)) errors.push("unknown-source:" + work.id);
    if (!work.title.trim()) errors.push("empty-work-title:" + work.id);
  }

  const positions = new Set<string>();
  for (const unit of units) {
    if (!workIds.has(unit.workId)) errors.push("unknown-work:" + unit.id);
    if (!Number.isInteger(unit.position) || unit.position < 1) errors.push("invalid-position:" + unit.id);
    const key = unit.workId + ":" + unit.position;
    if (positions.has(key)) errors.push("duplicate-position:" + key);
    positions.add(key);
  }

  return errors;
}