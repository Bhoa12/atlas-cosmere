export type SourceKind = "verified-index" | "declared-private" | "accessible";
export interface SourceRecord { id: string; kind: SourceKind; label: string; }
export interface WorldRecord { id: string; label: string; }
export interface WorkRecord { id: string; title: string; sourceId: string; worldIds?: string[]; }
export interface ReadingUnit { id: string; workId: string; position: number; label: string; }
export interface ReadingProgress { workId: string; completedUnitIds: string[]; }
export interface SpoilerGate { workId: string; requiredUnitIds: string[]; }
export interface GateDecision { allowed: boolean; reason: "ready" | "no-requirements" | "invalid-requirements" | "wrong-work" | "incomplete"; pendingUnitIds: string[]; }

export function normalizeProgress(progress: ReadingProgress, units: ReadingUnit[]): ReadingProgress {
  const valid = new Set(units.filter(u => u.workId === progress.workId).map(u => u.id));
  return { workId: progress.workId, completedUnitIds: [...new Set(progress.completedUnitIds.filter(id => valid.has(id)))] };
}

export function evaluateSpoilerGate(gate: SpoilerGate, progress: ReadingProgress | undefined, units: ReadingUnit[]): GateDecision {
  if (!gate.requiredUnitIds.length) return { allowed: false, reason: "no-requirements", pendingUnitIds: [] };
  if (new Set(gate.requiredUnitIds).size !== gate.requiredUnitIds.length) return { allowed: false, reason: "invalid-requirements", pendingUnitIds: [] };
  const valid = new Set(units.filter(u => u.workId === gate.workId).map(u => u.id));
  if (!gate.requiredUnitIds.every(id => valid.has(id))) return { allowed: false, reason: "invalid-requirements", pendingUnitIds: [] };
  if (!progress || progress.workId !== gate.workId) return { allowed: false, reason: "wrong-work", pendingUnitIds: gate.requiredUnitIds };
  const completed = new Set(normalizeProgress(progress, units).completedUnitIds);
  const pendingUnitIds = gate.requiredUnitIds.filter(id => !completed.has(id));
  return pendingUnitIds.length ? { allowed: false, reason: "incomplete", pendingUnitIds } : { allowed: true, reason: "ready", pendingUnitIds: [] };
}

export function worksForWorld(worldId: string, worlds: WorldRecord[], works: WorkRecord[]): WorkRecord[] {
  if (!worlds.some(world => world.id === worldId)) return [];
  return works.filter(work => work.worldIds?.includes(worldId));
}

// Bibliographic seed only: titles supplied from a verified private index.
// World membership and internal reading structure are intentionally not inferred.
export const priorityWorlds: WorldRecord[] = [
  { id: "scadrial", label: "Scadrial" }, { id: "sel", label: "Sel" },
  { id: "nalthis", label: "Nalthis" }, { id: "taldain", label: "Taldain" },
  { id: "roshar", label: "Roshar" },
];

export const verifiedIndexTitles = [
  "El Imperio Final", "El Pozo de la Ascensión", "El Héroe de las Eras",
  "Aleación de ley", "Sombras de identidad", "Brazales de Duelo", "El metal perdido",
  "El aliento de los dioses", "Elantris", "Arena blanca vol. 1", "Arena blanca vol. 2",
  "Arena blanca vol. 3", "Trenza del mar Esmeralda", "Yumi y el pintor de pesadillas",
  "El Hombre Iluminado", "Islas de la ascuaoscura", "Arcanum ilimitado"
] as const;
