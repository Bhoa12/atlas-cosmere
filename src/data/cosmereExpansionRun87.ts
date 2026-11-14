export type SourceKind = "verified-index" | "declared-private" | "editorial-accessible";

export interface SourceRecord { id: string; kind: SourceKind; accessible: boolean; }
export interface WorldRecord { id: string; name: string; }
export interface WorkRecord { id: string; title: string; sourceId: string; }
export interface ReadingUnit { id: string; workId: string; position: number; sourceId: string; }
export interface ProgressSnapshot { workId: string; completedUnitIds: string[]; }
export interface SpoilerGate { requiredUnitIds: string[]; }

export const priorityWorlds: WorldRecord[] = [
  { id: "scadrial", name: "Scadrial" }, { id: "sel", name: "Sel" },
  { id: "nalthis", name: "Nalthis" }, { id: "taldain", name: "Taldain" },
  { id: "roshar", name: "Roshar" }
];

export function validReadingUnits(units: ReadingUnit[], sources: SourceRecord[]): ReadingUnit[] {
  const sourceById = new Map(sources.map(s => [s.id, s]));
  const ids = new Set<string>(), positions = new Set<string>();
  return units.filter(unit => {
    const source = sourceById.get(unit.sourceId);
    const key = unit.workId + ":" + unit.position;
    if (!source || source.kind !== "editorial-accessible" || !source.accessible || ids.has(unit.id) || positions.has(key)) return false;
    ids.add(unit.id); positions.add(key); return true;
  }).sort((a,b) => a.position - b.position);
}

export function reconcileProgress(workId: string, units: ReadingUnit[], snapshot: ProgressSnapshot): string[] {
  if (snapshot.workId !== workId) return [];
  const valid = units.filter(u => u.workId === workId);
  const requested = new Set(snapshot.completedUnitIds);
  return valid.filter(u => requested.has(u.id)).map(u => u.id);
}

export function evaluateSpoilerGate(gate: SpoilerGate, completedUnitIds: string[], knownUnits: ReadingUnit[]) {
  const required = gate.requiredUnitIds;
  const known = new Set(knownUnits.map(u => u.id));
  const unique = new Set(required);
  if (required.length === 0 || unique.size !== required.length || required.some(id => !known.has(id))) {
    return { unlocked: false, pending: [...required] };
  }
  const completed = new Set(completedUnitIds);
  const pending = required.filter(id => !completed.has(id));
  return { unlocked: pending.length === 0, pending };
}
