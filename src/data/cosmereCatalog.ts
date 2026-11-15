/**
 * Provenance-first catalog model for expanding the Atlas del Cosmere.
 *
 * This module intentionally contains bibliographic metadata only. A work is
 * not assigned to a world, reading unit, summary, or spoiler gate unless that
 * relationship is supplied by an appropriately accessible source.
 */

export type SourceKind = 'verified-index' | 'declared-private' | 'editorial-accessible';

export interface CatalogSource {
  id: string;
  label: string;
  kind: SourceKind;
  accessibleForEditorialClaims: boolean;
}

export interface CatalogWork {
  id: string;
  title: string;
  sourceId: string;
}

export interface WorldRecord {
  id: string;
  label: string;
}

export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
  sourceId: string;
}

export interface SpoilerGate {
  id: string;
  workId: string;
  requiredUnitIds: string[];
}

export interface ExpansionCatalog {
  sources: CatalogSource[];
  worlds: WorldRecord[];
  works: CatalogWork[];
  readingUnits: ReadingUnit[];
  spoilerGates: SpoilerGate[];
}

export interface CatalogAudit {
  valid: boolean;
  errors: string[];
}

/**
 * Bibliographic catalog supplied through the verified index of cosmere.epub.
 * Titles are retained as metadata; no narrative facts or world assignments are
 * inferred here.
 */
export const verifiedCosmereIndexTitles = [
  'El Imperio Final',
  'El Pozo de la Ascensión',
  'El Héroe de las Eras',
  'Aleación de ley',
  'Sombras de identidad',
  'Brazales de Duelo',
  'El metal perdido',
  'El aliento de los dioses',
  'Elantris',
  'Arena blanca vol. 1',
  'Arena blanca vol. 2',
  'Arena blanca vol. 3',
  'Trenza del mar Esmeralda',
  'Yumi y el pintor de pesadillas',
  'El Hombre Iluminado',
  'Islas de la ascuaoscura',
  'Arcanum ilimitado',
] as const;

export const priorityWorlds: WorldRecord[] = [
  { id: 'scadrial', label: 'Scadrial' },
  { id: 'sel', label: 'Sel' },
  { id: 'nalthis', label: 'Nalthis' },
  { id: 'taldain', label: 'Taldain' },
  { id: 'roshar', label: 'Roshar' },
];

const duplicateIds = (ids: string[]) =>
  ids.filter((id, index) => ids.indexOf(id) !== index);

export function auditExpansionCatalog(catalog: ExpansionCatalog): CatalogAudit {
  const errors: string[] = [];
  const sourceIds = new Set(catalog.sources.map((source) => source.id));
  const workIds = new Set(catalog.works.map((work) => work.id));
  const unitIds = new Set(catalog.readingUnits.map((unit) => unit.id));

  for (const id of duplicateIds(catalog.sources.map((source) => source.id))) {
    errors.push(`duplicate source: ${id}`);
  }
  for (const id of duplicateIds(catalog.works.map((work) => work.id))) {
    errors.push(`duplicate work: ${id}`);
  }
  for (const id of duplicateIds(catalog.readingUnits.map((unit) => unit.id))) {
    errors.push(`duplicate reading unit: ${id}`);
  }

  for (const work of catalog.works) {
    if (!sourceIds.has(work.sourceId)) errors.push(`unknown source for work: ${work.id}`);
    if (!work.title.trim()) errors.push(`empty work title: ${work.id}`);
  }

  for (const unit of catalog.readingUnits) {
    const source = catalog.sources.find((candidate) => candidate.id === unit.sourceId);
    if (!workIds.has(unit.workId)) errors.push(`unknown work for unit: ${unit.id}`);
    if (!Number.isInteger(unit.position) || unit.position < 1) {
      errors.push(`invalid position for unit: ${unit.id}`);
    }
    if (!source || !source.accessibleForEditorialClaims) {
      errors.push(`unit lacks accessible editorial provenance: ${unit.id}`);
    }
  }

  for (const gate of catalog.spoilerGates) {
    if (!workIds.has(gate.workId)) errors.push(`unknown work for gate: ${gate.id}`);
    if (gate.requiredUnitIds.length === 0) errors.push(`empty gate: ${gate.id}`);
    for (const unitId of gate.requiredUnitIds) {
      const unit = catalog.readingUnits.find((candidate) => candidate.id === unitId);
      if (!unitIds.has(unitId) || !unit) errors.push(`unknown gate unit: ${unitId}`);
      else if (unit.workId !== gate.workId) errors.push(`cross-work gate unit: ${unitId}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isSpoilerGateUnlocked(
  catalog: ExpansionCatalog,
  gateId: string,
  completedUnitIds: readonly string[],
): boolean {
  const audit = auditExpansionCatalog(catalog);
  if (!audit.valid) return false;

  const gate = catalog.spoilerGates.find((candidate) => candidate.id === gateId);
  if (!gate) return false;

  const completed = new Set(completedUnitIds);
  return gate.requiredUnitIds.every((id) => completed.has(id));
}
