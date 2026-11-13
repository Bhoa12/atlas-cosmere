export type SourceKind = 'verified-index' | 'declared-private';

export interface SourceRecord { id: string; label: string; kind: SourceKind; }
export interface WorldRecord { id: string; label: string; }
export interface WorkRecord { id: string; title: string; sourceId: string; worldId?: string; }
export interface ReadingUnit { id: string; workId: string; position: number; label: string; }
export interface ReadingProgress { workId: string; completedUnitIds: string[]; }
export interface SpoilerGate { workId: string; requiredUnitIds: string[]; }

export interface Catalog {
  sources: SourceRecord[];
  worlds: WorldRecord[];
  works: WorkRecord[];
  units: ReadingUnit[];
}

export interface CatalogIssue { code: string; id?: string; }

const unique = (values: string[]) => new Set(values).size === values.length;

export function validateCatalog(catalog: Catalog): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  for (const collection of [catalog.sources, catalog.worlds, catalog.works, catalog.units]) {
    const ids = collection.map(item => item.id);
    if (ids.some(id => !id.trim())) issues.push({ code: 'empty-id' });
    if (!unique(ids)) issues.push({ code: 'duplicate-id' });
  }
  const sourceIds = new Set(catalog.sources.map(s => s.id));
  const worldIds = new Set(catalog.worlds.map(w => w.id));
  const workIds = new Set(catalog.works.map(w => w.id));
  for (const work of catalog.works) {
    if (!work.title.trim()) issues.push({ code: 'empty-work-title', id: work.id });
    if (!sourceIds.has(work.sourceId)) issues.push({ code: 'unknown-source', id: work.id });
    if (work.worldId && !worldIds.has(work.worldId)) issues.push({ code: 'unknown-world', id: work.id });
  }
  const positions = new Map<string, Set<number>>();
  for (const unit of catalog.units) {
    if (!workIds.has(unit.workId)) issues.push({ code: 'unknown-work', id: unit.id });
    if (!Number.isInteger(unit.position) || unit.position < 1) issues.push({ code: 'invalid-position', id: unit.id });
    const seen = positions.get(unit.workId) ?? new Set<number>();
    if (seen.has(unit.position)) issues.push({ code: 'duplicate-position', id: unit.workId });
    seen.add(unit.position); positions.set(unit.workId, seen);
  }
  return issues;
}

export function normalizeProgress(progress: ReadingProgress, units: ReadingUnit[]): ReadingProgress {
  const valid = new Set(units.filter(unit => unit.workId === progress.workId).map(unit => unit.id));
  return { workId: progress.workId, completedUnitIds: [...new Set(progress.completedUnitIds.filter(id => valid.has(id)))] };
}

export function canReveal(gate: SpoilerGate, progress: ReadingProgress | undefined, units: ReadingUnit[]): boolean {
  if (!progress || progress.workId !== gate.workId || gate.requiredUnitIds.length === 0 || !unique(gate.requiredUnitIds)) return false;
  const unitMap = new Map(units.map(unit => [unit.id, unit]));
  if (gate.requiredUnitIds.some(id => unitMap.get(id)?.workId !== gate.workId)) return false;
  const completed = new Set(normalizeProgress(progress, units).completedUnitIds);
  return gate.requiredUnitIds.every(id => completed.has(id));
}

export const verifiedCatalogSeed = {
  source: { id: 'cosmere-index', label: 'cosmere.epub verified index', kind: 'verified-index' as const },
  worlds: ['Scadrial', 'Sel', 'Nalthis', 'Taldain', 'Roshar'].map(label => ({ id: label.toLowerCase(), label })),
  titles: [
    'El Imperio Final','El Pozo de la Ascensión','El Héroe de las Eras','Aleación de ley','Sombras de identidad','Brazales de Duelo','El metal perdido','El aliento de los dioses','Elantris','Arena blanca vol. 1','Arena blanca vol. 2','Arena blanca vol. 3','Trenza del mar Esmeralda','Yumi y el pintor de pesadillas','El Hombre Iluminado','Islas de la ascuaoscura','Arcanum ilimitado'
  ]
};