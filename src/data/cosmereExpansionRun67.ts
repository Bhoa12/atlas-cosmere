export interface WorldRecord { id: string; label: string; }
export interface WorkRecord { id: string; title: string; sourceId: string; worldIds?: string[]; }
export interface ReadingUnit { id: string; workId: string; position: number; label: string; }
export interface ReadingProgress { workId: string; completedUnitIds: string[]; }
export interface ProgressSnapshot { workId: string; completedUnitIds: string[]; }
export interface SpoilerGate { workId: string; requiredUnitIds: string[]; }

export type GateReason = "ready" | "no-requirements" | "invalid-requirements" | "wrong-work" | "incomplete";
export interface GateDecision {
  allowed: boolean;
  reason: GateReason;
  pendingUnitIds: string[];
}

/**
 * Returns a canonical, source-independent view of progress.
 * Unknown, cross-work and duplicate unit IDs are removed; input is never mutated.
 */
export function reconcileProgress(
  workId: string,
  snapshots: ProgressSnapshot[],
  units: ReadingUnit[],
): ReadingProgress {
  const known = new Set(units.filter(unit => unit.workId === workId).map(unit => unit.id));
  const completed = new Set<string>();
  for (const snapshot of snapshots) {
    if (snapshot.workId !== workId) continue;
    for (const id of snapshot.completedUnitIds) if (known.has(id)) completed.add(id);
  }
  const order = new Map(units.filter(unit => unit.workId === workId).map(unit => [unit.id, unit.position]));
  return {
    workId,
    completedUnitIds: [...completed].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0) || a.localeCompare(b)),
  };
}

export function evaluateSpoilerGate(
  gate: SpoilerGate,
  snapshots: ProgressSnapshot[],
  units: ReadingUnit[],
): GateDecision {
  if (!gate.requiredUnitIds.length)
    return { allowed: false, reason: "no-requirements", pendingUnitIds: [] };
  if (new Set(gate.requiredUnitIds).size !== gate.requiredUnitIds.length)
    return { allowed: false, reason: "invalid-requirements", pendingUnitIds: [] };

  const valid = new Set(units.filter(unit => unit.workId === gate.workId).map(unit => unit.id));
  if (!gate.requiredUnitIds.every(id => valid.has(id)))
    return { allowed: false, reason: "invalid-requirements", pendingUnitIds: [] };

  const hasMatchingSnapshot = snapshots.some(snapshot => snapshot.workId === gate.workId);
  if (!hasMatchingSnapshot)
    return { allowed: false, reason: "wrong-work", pendingUnitIds: [...gate.requiredUnitIds] };

  const completed = new Set(reconcileProgress(gate.workId, snapshots, units).completedUnitIds);
  const pendingUnitIds = gate.requiredUnitIds.filter(id => !completed.has(id));
  return pendingUnitIds.length
    ? { allowed: false, reason: "incomplete", pendingUnitIds }
    : { allowed: true, reason: "ready", pendingUnitIds: [] };
}

export function worksForWorld(worldId: string, worlds: WorldRecord[], works: WorkRecord[]): WorkRecord[] {
  if (!worlds.some(world => world.id === worldId)) return [];
  return works.filter(work => work.worldIds?.includes(worldId));
}

// Bibliographic metadata only. Relationships and narrative structure are intentionally absent
// unless explicitly supplied by an accessible source.
export const priorityWorlds: WorldRecord[] = [
  { id: "scadrial", label: "Scadrial" },
  { id: "sel", label: "Sel" },
  { id: "nalthis", label: "Nalthis" },
  { id: "taldain", label: "Taldain" },
  { id: "roshar", label: "Roshar" },
];

export const verifiedIndexTitles = [
  "El Imperio Final", "El Pozo de la Ascensión", "El Héroe de las Eras",
  "Aleación de ley", "Sombras de identidad", "Brazales de Duelo", "El metal perdido",
  "El aliento de los dioses", "Elantris", "Arena blanca vol. 1", "Arena blanca vol. 2",
  "Arena blanca vol. 3", "Trenza del mar Esmeralda", "Yumi y el pintor de pesadillas",
  "El Hombre Iluminado", "Islas de la ascuaoscura", "Arcanum ilimitado",
] as const;
