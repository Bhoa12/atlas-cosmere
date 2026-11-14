export type CosmereSourceKind = "verified-index" | "declared-private" | "editorial-accessible";

export interface CatalogSource {
  id: string;
  kind: CosmereSourceKind;
  accessible: boolean;
}

export interface CatalogWork {
  id: string;
  title: string;
  sourceId: string;
}

export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
  sourceId: string;
}

export interface ProgressSnapshot {
  workId: string;
  completedUnitIds: readonly string[];
}

export const catalogTitles = [
  "El Imperio Final", "El Pozo de la Ascensión", "El Héroe de las Eras",
  "Aleación de ley", "Sombras de identidad", "Brazales de Duelo", "El metal perdido",
  "El aliento de los dioses", "Elantris", "Arena blanca vol. 1",
  "Arena blanca vol. 2", "Arena blanca vol. 3", "Trenza del mar Esmeralda",
  "Yumi y el pintor de pesadillas", "El Hombre Iluminado",
  "Islas de la ascuaoscura", "Arcanum ilimitado"
] as const;

export function sourceCanBackReadingUnit(source: CatalogSource | undefined): boolean {
  return source?.kind === "editorial-accessible" && source.accessible;
}

export function validateReadingUnits(
  units: readonly ReadingUnit[],
  sources: readonly CatalogSource[],
  works: readonly CatalogWork[]
): string[] {
  const sourceById = new Map(sources.map(source => [source.id, source]));
  const workIds = new Set(works.map(work => work.id));
  const errors: string[] = [];
  const positions = new Set<string>();

  for (const unit of units) {
    if (!workIds.has(unit.workId)) errors.push(`unknown-work:${unit.id}`);
    if (!sourceCanBackReadingUnit(sourceById.get(unit.sourceId))) {
      errors.push(`untrusted-reading-unit:${unit.id}`);
    }
    const key = `${unit.workId}:${unit.position}`;
    if (positions.has(key)) errors.push(`duplicate-position:${key}`);
    positions.add(key);
  }
  return errors;
}

export function reconcileProgress(
  workId: string,
  units: readonly ReadingUnit[],
  snapshots: readonly ProgressSnapshot[]
): string[] {
  const valid = new Set(units.filter(unit => unit.workId === workId).map(unit => unit.id));
  const completed = new Set<string>();
  for (const snapshot of snapshots) {
    if (snapshot.workId !== workId) continue;
    for (const id of snapshot.completedUnitIds) if (valid.has(id)) completed.add(id);
  }
  return units.filter(unit => unit.workId === workId && completed.has(unit.id))
    .sort((a, b) => a.position - b.position).map(unit => unit.id);
}

export function evaluateSpoilerGate(
  requirements: readonly string[],
  completed: readonly string[],
  knownUnits: readonly ReadingUnit[]
): { unlocked: boolean; pending: string[] } {
  if (!requirements.length || new Set(requirements).size !== requirements.length) {
    return { unlocked: false, pending: [...requirements] };
  }
  const known = new Set(knownUnits.map(unit => unit.id));
  if (requirements.some(id => !known.has(id))) return { unlocked: false, pending: [...requirements] };
  const done = new Set(completed);
  const pending = requirements.filter(id => !done.has(id));
  return { unlocked: pending.length === 0, pending };
}
