/**
 * Source-safe catalog primitives for the Cosmere Atlas.
 * This module stores metadata only; it intentionally contains no EPUB text.
 */

export type SourceKind = "verified-index" | "declared-private";

export interface CatalogSource {
  id: string;
  label: string;
  kind: SourceKind;
}

export interface CosmereWorld {
  id: string;
  label: string;
  priority: number;
}

export interface CatalogWork {
  id: string;
  title: string;
  sourceId: string;
  /** Optional: relationships must be explicitly supplied, never inferred from a title. */
  worldId?: string;
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

export type RevealDecision =
  | { allowed: true; pendingUnitIds: [] }
  | { allowed: false; reason: "missing-progress" | "wrong-work" | "invalid-gate" | "invalid-unit" | "incomplete"; pendingUnitIds: string[] };

const unique = (values: string[]) => new Set(values).size === values.length;

export function validateCatalog(
  sources: CatalogSource[],
  worlds: CosmereWorld[],
  works: CatalogWork[],
  units: ReadingUnit[],
): string[] {
  const issues: string[] = [];
  const ids = (values: { id: string }[]) => values.map((value) => value.id);

  if (!unique(ids(sources))) issues.push("duplicate-source-id");
  if (!unique(ids(worlds))) issues.push("duplicate-world-id");
  if (!unique(ids(works))) issues.push("duplicate-work-id");
  if (!unique(ids(units))) issues.push("duplicate-unit-id");

  const sourceIds = new Set(ids(sources));
  const worldIds = new Set(ids(worlds));
  const workIds = new Set(ids(works));
  const seenPositions = new Set<string>();

  works.forEach((work) => {
    if (!work.title.trim()) issues.push(`empty-work-title:${work.id}`);
    if (!sourceIds.has(work.sourceId)) issues.push(`unknown-work-source:${work.id}`);
    if (work.worldId && !worldIds.has(work.worldId)) issues.push(`unknown-work-world:${work.id}`);
  });

  units.forEach((unit) => {
    if (!workIds.has(unit.workId)) issues.push(`unknown-unit-work:${unit.id}`);
    if (!unit.label.trim() || !Number.isInteger(unit.position) || unit.position < 1) {
      issues.push(`invalid-reading-unit:${unit.id}`);
    }
    const key = `${unit.workId}:${unit.position}`;
    if (seenPositions.has(key)) issues.push(`duplicate-reading-position:${key}`);
    seenPositions.add(key);
  });

  return issues;
}

export function normalizeProgress(
  progress: ReadingProgress,
  units: ReadingUnit[],
): ReadingProgress {
  const validIds = new Set(units.filter((unit) => unit.workId === progress.workId).map((unit) => unit.id));
  return {
    workId: progress.workId,
    completedUnitIds: [...new Set(progress.completedUnitIds.filter((id) => validIds.has(id)))],
  };
}

export function evaluateSpoilerGate(
  gate: SpoilerGate,
  progress: ReadingProgress | undefined,
  units: ReadingUnit[],
): RevealDecision {
  if (!progress) return { allowed: false, reason: "missing-progress", pendingUnitIds: gate.requiredUnitIds };
  if (progress.workId !== gate.workId) return { allowed: false, reason: "wrong-work", pendingUnitIds: gate.requiredUnitIds };
  if (!gate.requiredUnitIds.length || !unique(gate.requiredUnitIds)) {
    return { allowed: false, reason: "invalid-gate", pendingUnitIds: [] };
  }

  const valid = new Set(units.filter((unit) => unit.workId === gate.workId).map((unit) => unit.id));
  const invalid = gate.requiredUnitIds.filter((id) => !valid.has(id));
  if (invalid.length) return { allowed: false, reason: "invalid-unit", pendingUnitIds: invalid };

  const completed = new Set(normalizeProgress(progress, units).completedUnitIds);
  const pendingUnitIds = gate.requiredUnitIds.filter((id) => !completed.has(id));
  return pendingUnitIds.length
    ? { allowed: false, reason: "incomplete", pendingUnitIds }
    : { allowed: true, pendingUnitIds: [] };
}

/**
 * Bibliographic seed supplied by the user. Titles are catalog metadata only.
 * No world assignments are inferred here.
 */
export const sourceSafeCatalog = {
  sources: [
    { id: "cosmere-index", label: "cosmere.epub — índice verificado", kind: "verified-index" as const },
    { id: "roshar-private", label: "EPUBs privados de Roshar", kind: "declared-private" as const },
  ],
  worlds: [
    { id: "scadrial", label: "Scadrial", priority: 1 },
    { id: "sel", label: "Sel", priority: 2 },
    { id: "nalthis", label: "Nalthis", priority: 3 },
    { id: "taldain", label: "Taldain", priority: 4 },
    { id: "roshar", label: "Roshar", priority: 5 },
  ],
  works: [
    "El Imperio Final", "El Pozo de la Ascensión", "El Héroe de las Eras",
    "Aleación de ley", "Sombras de identidad", "Brazales de Duelo", "El metal perdido",
    "El aliento de los dioses", "Elantris", "Arena blanca vol. 1", "Arena blanca vol. 2",
    "Arena blanca vol. 3", "Trenza del mar Esmeralda", "Yumi y el pintor de pesadillas",
    "El Hombre Iluminado", "Islas de la ascuaoscura", "Arcanum ilimitado",
  ].map((title, index) => ({ id: `catalog-work-${index + 1}`, title, sourceId: "cosmere-index" })),
} as const;
