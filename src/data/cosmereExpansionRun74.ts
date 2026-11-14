export type SourceAccess = "verified-index" | "declared-private" | "accessible";

export interface Source { id: string; access: SourceAccess; }
export interface World { id: string; name: string; }
export interface Work { id: string; title: string; sourceId: string; worldIds: string[]; }
export interface ReadingUnit { id: string; workId: string; position: number; }
export interface ProgressSnapshot { workId: string; completedUnitIds: string[]; }
export interface SpoilerContent { id: string; workId: string; sourceId: string; kind: "metadata-only" | "backed-summary"; summary?: string; requiresUnitIds: string[]; }

export const priorityWorlds: World[] = [
  { id: "scadrial", name: "Scadrial" },
  { id: "sel", name: "Sel" },
  { id: "nalthis", name: "Nalthis" },
  { id: "taldain", name: "Taldain" },
  { id: "roshar", name: "Roshar" },
];

export const verifiedIndexTitles = [
  "El Imperio Final", "El Pozo de la Ascensión", "El Héroe de las Eras",
  "Aleación de ley", "Sombras de identidad", "Brazales de Duelo", "El metal perdido",
  "El aliento de los dioses", "Elantris", "Arena blanca vol. 1", "Arena blanca vol. 2",
  "Arena blanca vol. 3", "Trenza del mar Esmeralda", "Yumi y el pintor de pesadillas",
  "El Hombre Iluminado", "Islas de la ascuaoscura", "Arcanum ilimitado",
] as const;

export function validateCatalog(
  sources: Source[], worlds: World[], works: Work[], units: ReadingUnit[],
): string[] {
  const errors: string[] = [];
  const duplicate = (values: string[]) => new Set(values).size !== values.length;
  if (duplicate(sources.map(x => x.id))) errors.push("duplicate-source");
  if (duplicate(worlds.map(x => x.id))) errors.push("duplicate-world");
  if (duplicate(works.map(x => x.id))) errors.push("duplicate-work");
  if (duplicate(units.map(x => x.id))) errors.push("duplicate-unit");
  const sourceIds = new Set(sources.map(x => x.id));
  const worldIds = new Set(worlds.map(x => x.id));
  const workIds = new Set(works.map(x => x.id));
  for (const work of works) {
    if (!sourceIds.has(work.sourceId)) errors.push("unknown-work-source:" + work.id);
    if (new Set(work.worldIds).size !== work.worldIds.length) errors.push("duplicate-work-world:" + work.id);
    for (const worldId of work.worldIds) if (!worldIds.has(worldId)) errors.push("unknown-work-world:" + work.id);
  }
  const positions = new Set<string>();
  for (const unit of units) {
    if (!workIds.has(unit.workId)) errors.push("unknown-unit-work:" + unit.id);
    const key = unit.workId + ":" + unit.position;
    if (positions.has(key)) errors.push("duplicate-unit-position:" + unit.workId);
    positions.add(key);
  }
  return errors;
}

export function reconcileProgress(
  workId: string, units: ReadingUnit[], snapshots: ProgressSnapshot[],
): string[] {
  const allowed = new Set(units.filter(u => u.workId === workId).map(u => u.id));
  const seen = new Set<string>();
  for (const snapshot of snapshots) if (snapshot.workId === workId)
    for (const id of snapshot.completedUnitIds) if (allowed.has(id)) seen.add(id);
  return units.filter(u => u.workId === workId && seen.has(u.id))
    .sort((a,b) => a.position - b.position).map(u => u.id);
}

export function canReveal(
  content: SpoilerContent, sources: Source[], units: ReadingUnit[], snapshots: ProgressSnapshot[],
): { reveal: boolean; reason: string } {
  const source = sources.find(s => s.id === content.sourceId);
  if (content.kind === "metadata-only" && content.summary) return { reveal: false, reason: "metadata-cannot-carry-summary" };
  if (content.kind === "backed-summary" && (!content.summary || source?.access !== "accessible"))
    return { reveal: false, reason: "unbacked-summary" };
  if (!content.requiresUnitIds.length || new Set(content.requiresUnitIds).size !== content.requiresUnitIds.length)
    return { reveal: false, reason: "invalid-requirements" };
  const workUnits = new Set(units.filter(u => u.workId === content.workId).map(u => u.id));
  if (content.requiresUnitIds.some(id => !workUnits.has(id))) return { reveal: false, reason: "unknown-requirement" };
  const completed = new Set(reconcileProgress(content.workId, units, snapshots));
  return content.requiresUnitIds.every(id => completed.has(id))
    ? { reveal: true, reason: "ready" } : { reveal: false, reason: "incomplete" };
}
