export type SourceAccess = "verified-index" | "declared-private" | "accessible";
export interface SourceRecord { id: string; access: SourceAccess; label: string; }
export interface WorldRecord { id: string; label: string; }
export interface WorkRecord { id: string; title: string; sourceId: string; worldIds?: string[]; }
export interface ReadingUnit { id: string; workId: string; position: number; label: string; sourceId: string; }
export interface ContentRecord {
  id: string;
  workId: string;
  sourceId: string;
  status: "metadata-only" | "backed-summary";
  summary?: string;
  gateUnitIds: string[];
}

export interface CatalogIssue { code: string; id: string; }
export interface CatalogValidation { valid: boolean; issues: CatalogIssue[]; }

/**
 * Validates provenance without reading or inferring editorial content.
 * A backed summary is accepted only when its source is explicitly marked accessible.
 */
export function validateCatalog(
  sources: SourceRecord[],
  worlds: WorldRecord[],
  works: WorkRecord[],
  units: ReadingUnit[],
  content: ContentRecord[],
): CatalogValidation {
  const issues: CatalogIssue[] = [];
  const duplicateIds = <T extends { id: string }>(items: T[], code: string) => {
    const seen = new Set<string>();
    for (const item of items) {
      if (!item.id || seen.has(item.id)) issues.push({ code, id: item.id || "<empty>" });
      seen.add(item.id);
    }
  };
  duplicateIds(sources, "duplicate-source");
  duplicateIds(worlds, "duplicate-world");
  duplicateIds(works, "duplicate-work");
  duplicateIds(units, "duplicate-unit");
  duplicateIds(content, "duplicate-content");

  const sourceById = new Map(sources.map(source => [source.id, source]));
  const workById = new Map(works.map(work => [work.id, work]));
  const worldIds = new Set(worlds.map(world => world.id));
  const unitById = new Map(units.map(unit => [unit.id, unit]));

  for (const work of works) {
    if (!work.title.trim()) issues.push({ code: "empty-title", id: work.id });
    if (!sourceById.has(work.sourceId)) issues.push({ code: "unknown-work-source", id: work.id });
    for (const worldId of work.worldIds ?? []) if (!worldIds.has(worldId))
      issues.push({ code: "unknown-world", id: work.id });
  }
  for (const unit of units) {
    if (!workById.has(unit.workId)) issues.push({ code: "unknown-unit-work", id: unit.id });
    if (!sourceById.has(unit.sourceId)) issues.push({ code: "unknown-unit-source", id: unit.id });
    if (!Number.isInteger(unit.position) || unit.position < 1)
      issues.push({ code: "invalid-unit-position", id: unit.id });
  }
  for (const item of content) {
    const source = sourceById.get(item.sourceId);
    if (!workById.has(item.workId)) issues.push({ code: "unknown-content-work", id: item.id });
    if (!source) issues.push({ code: "unknown-content-source", id: item.id });
    if (item.status === "metadata-only" && item.summary)
      issues.push({ code: "summary-without-access", id: item.id });
    if (item.status === "backed-summary" && (!source || source.access !== "accessible" || !item.summary?.trim()))
      issues.push({ code: "unbacked-summary", id: item.id });
    const unique = new Set(item.gateUnitIds);
    if (!item.gateUnitIds.length || unique.size !== item.gateUnitIds.length)
      issues.push({ code: "invalid-content-gate", id: item.id });
    for (const unitId of item.gateUnitIds) {
      const unit = unitById.get(unitId);
      if (!unit || unit.workId !== item.workId)
        issues.push({ code: "invalid-content-unit", id: item.id });
    }
  }
  return { valid: issues.length === 0, issues };
}

/**
 * Returns only content that is both provenance-valid and unlocked.
 * Unknown or invalid state fails closed and returns no editorial text.
 */
export function revealContent(
  item: ContentRecord,
  completedUnitIds: string[],
  validation: CatalogValidation,
): ContentRecord | null {
  if (!validation.valid || item.status !== "backed-summary") return null;
  const completed = new Set(completedUnitIds);
  return item.gateUnitIds.every(id => completed.has(id)) ? item : null;
}

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
