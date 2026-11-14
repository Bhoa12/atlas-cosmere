/**
 * Reusable catalog, reading progress and spoiler-gate primitives.
 * Source records deliberately distinguish metadata availability from editorial access.
 */

export type SourceKind = "verified-index" | "declared-private" | "editorial-accessible";

export interface SourceRecord {
  id: string;
  kind: SourceKind;
  accessible: boolean;
}

export interface World { id: string; name: string; }
export interface Work {
  id: string;
  title: string;
  sourceId: string;
}
export interface WorldWorkLink { worldId: string; workId: string; sourceId: string; }
export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
  sourceId: string;
}
export interface ProgressSnapshot { workId: string; completedUnitIds: string[]; }
export interface SpoilerGate { workId: string; requiredUnitIds: string[]; }

export const priorityWorlds: readonly World[] = [
  { id: "scadrial", name: "Scadrial" },
  { id: "sel", name: "Sel" },
  { id: "nalthis", name: "Nalthis" },
  { id: "taldain", name: "Taldain" },
  { id: "roshar", name: "Roshar" },
];

/** Titles verified in the supplied cosmere.epub index. No world is inferred here. */
export const verifiedCatalogTitles = [
  "El Imperio Final",
  "El Pozo de la Ascensión",
  "El Héroe de las Eras",
  "Aleación de ley",
  "Sombras de identidad",
  "Brazales de Duelo",
  "El metal perdido",
  "El aliento de los dioses",
  "Elantris",
  "Arena blanca vol. 1",
  "Arena blanca vol. 2",
  "Arena blanca vol. 3",
  "Trenza del mar Esmeralda",
  "Yumi y el pintor de pesadillas",
  "El Hombre Iluminado",
  "Islas de la ascuaoscura",
  "Arcanum ilimitado",
] as const;

export function catalogWorks(sourceId = "cosmere-index"): Work[] {
  return verifiedCatalogTitles.map((title, index) => ({
    id: `catalog-${index + 1}`,
    title,
    sourceId,
  }));
}

export function sourceCanBackReadingStructure(source: SourceRecord | undefined): boolean {
  return Boolean(source && source.kind === "editorial-accessible" && source.accessible);
}

export function sourceCanBackOriginalSummary(source: SourceRecord | undefined): boolean {
  return sourceCanBackReadingStructure(source);
}

export function reconcileProgress(
  workId: string,
  units: readonly ReadingUnit[],
  snapshots: readonly ProgressSnapshot[],
): string[] {
  const known = units.filter(unit => unit.workId === workId);
  const knownIds = new Set(known.map(unit => unit.id));
  const completed = new Set<string>();

  for (const snapshot of snapshots) {
    if (snapshot.workId !== workId) continue;
    for (const id of snapshot.completedUnitIds) if (knownIds.has(id)) completed.add(id);
  }

  return known
    .filter(unit => completed.has(unit.id))
    .sort((a, b) => a.position - b.position)
    .map(unit => unit.id);
}

export interface SpoilerDecision {
  visible: boolean;
  pendingUnitIds: string[];
  reason?: "empty-requirements" | "duplicate-requirements" | "unknown-unit" | "incomplete-progress";
}

export function evaluateSpoilerGate(
  gate: SpoilerGate,
  units: readonly ReadingUnit[],
  completedUnitIds: readonly string[],
): SpoilerDecision {
  if (gate.requiredUnitIds.length === 0)
    return { visible: false, pendingUnitIds: [], reason: "empty-requirements" };

  if (new Set(gate.requiredUnitIds).size !== gate.requiredUnitIds.length)
    return { visible: false, pendingUnitIds: [], reason: "duplicate-requirements" };

  const known = new Set(units.filter(unit => unit.workId === gate.workId).map(unit => unit.id));
  if (gate.requiredUnitIds.some(id => !known.has(id)))
    return { visible: false, pendingUnitIds: [], reason: "unknown-unit" };

  const completed = new Set(completedUnitIds);
  const pendingUnitIds = gate.requiredUnitIds.filter(id => !completed.has(id));
  return pendingUnitIds.length
    ? { visible: false, pendingUnitIds, reason: "incomplete-progress" }
    : { visible: true, pendingUnitIds: [] };
}

export function validateExplicitWorldLinks(
  worlds: readonly World[],
  works: readonly Work[],
  links: readonly WorldWorkLink[],
): string[] {
  const worldIds = new Set(worlds.map(world => world.id));
  const workIds = new Set(works.map(work => work.id));
  const errors: string[] = [];
  for (const link of links) {
    if (!worldIds.has(link.worldId)) errors.push(`unknown-world:${link.worldId}`);
    if (!workIds.has(link.workId)) errors.push(`unknown-work:${link.workId}`);
    if (!link.sourceId) errors.push(`missing-link-source:${link.workId}`);
  }
  return errors;
}
