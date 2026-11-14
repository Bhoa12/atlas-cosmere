export type SourceCapability = "catalog" | "private-declared" | "editorial-accessible";

export interface Source {
  id: string;
  capability: SourceCapability;
  accessible: boolean;
}

export interface World {
  id: string;
  name: string;
}

export interface Work {
  id: string;
  title: string;
  sourceId: string;
}

export interface WorldWorkLink {
  worldId: string;
  workId: string;
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
  completedUnitIds: string[];
}

export const catalogTitles = [
  "El Imperio Final", "El Pozo de la Ascensión", "El Héroe de las Eras",
  "Aleación de ley", "Sombras de identidad", "Brazales de Duelo", "El metal perdido",
  "El aliento de los dioses", "Elantris", "Arena blanca vol. 1", "Arena blanca vol. 2",
  "Arena blanca vol. 3", "Trenza del mar Esmeralda", "Yumi y el pintor de pesadillas",
  "El Hombre Iluminado", "Islas de la ascuaoscura", "Arcanum ilimitado",
] as const;

export const priorityWorlds: World[] = [
  { id: "scadrial", name: "Scadrial" },
  { id: "sel", name: "Sel" },
  { id: "nalthis", name: "Nalthis" },
  { id: "taldain", name: "Taldain" },
  { id: "roshar", name: "Roshar" },
];

/** Catalog titles do not imply world, chronology, or internal structure. */
export function worksForWorld(
  worldId: string,
  works: Work[],
  links: WorldWorkLink[],
  sources: Source[],
): Work[] {
  const allowed = new Set(sources.filter(s => s.capability !== "private-declared" || s.accessible).map(s => s.id));
  const ids = new Set(links.filter(l => l.worldId === worldId && allowed.has(l.sourceId)).map(l => l.workId));
  return works.filter(w => ids.has(w.id));
}

export function safeReadingUnits(units: ReadingUnit[], sources: Source[]): ReadingUnit[] {
  const sourceMap = new Map(sources.map(s => [s.id, s]));
  return units
    .filter(unit => {
      const source = sourceMap.get(unit.sourceId);
      return source?.capability === "editorial-accessible" && source.accessible;
    })
    .sort((a, b) => a.position - b.position);
}

export function reconcileProgress(
  workId: string,
  units: ReadingUnit[],
  snapshots: ProgressSnapshot[],
): string[] {
  const valid = new Set(units.filter(u => u.workId === workId).map(u => u.id));
  const completed = new Set(
    snapshots.filter(s => s.workId === workId).flatMap(s => s.completedUnitIds).filter(id => valid.has(id)),
  );
  return units.filter(u => u.workId === workId && completed.has(u.id)).sort((a, b) => a.position - b.position).map(u => u.id);
}

export function spoilerGate(
  requiredUnitIds: string[],
  completedUnitIds: string[],
  knownUnitIds: string[],
): { unlocked: boolean; pending: string[] } {
  if (requiredUnitIds.length === 0 || new Set(requiredUnitIds).size !== requiredUnitIds.length) {
    return { unlocked: false, pending: requiredUnitIds };
  }
  const known = new Set(knownUnitIds);
  const completed = new Set(completedUnitIds);
  const pending = requiredUnitIds.filter(id => !known.has(id) || !completed.has(id));
  return { unlocked: pending.length === 0, pending };
}
