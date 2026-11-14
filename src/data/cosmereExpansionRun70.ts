/**
 * Source-safe Cosmere expansion seed.
 * This module intentionally models only metadata explicitly supplied to the app.
 * It does not infer worlds, chapters, narrative facts, or reading structure.
 */
export type SourceKind = "verified-index" | "declared-private";
export interface SourceRecord { id:string; kind:SourceKind; label:string; accessible:boolean }
export interface WorldRecord { id:string; name:string }
export interface WorkRecord { id:string; title:string; sourceId:string; worldIds:string[] }
export interface ReadingUnit { id:string; workId:string; position:number; label:string }
export interface ProgressSnapshot { workId:string; completedUnitIds:string[] }
export interface ValidationIssue { code:string; id?:string }

export const PRIORITY_WORLDS: WorldRecord[] = [
  {id:"scadrial",name:"Scadrial"}, {id:"sel",name:"Sel"},
  {id:"nalthis",name:"Nalthis"}, {id:"taldain",name:"Taldain"},
  {id:"roshar",name:"Roshar"}
];

export const COSMERE_INDEX_SOURCE: SourceRecord = {
  id:"cosmere-index", kind:"verified-index", label:"cosmere.epub verified index", accessible:false
};

const titles = [
  "El Imperio Final","El Pozo de la Ascensión","El Héroe de las Eras",
  "Aleación de ley","Sombras de identidad","Brazales de Duelo","El metal perdido",
  "El aliento de los dioses","Elantris","Arena blanca vol. 1","Arena blanca vol. 2",
  "Arena blanca vol. 3","Trenza del mar Esmeralda","Yumi y el pintor de pesadillas",
  "El Hombre Iluminado","Islas de la ascuaoscura","Arcanum ilimitado"
] as const;

export const CATALOG_WORKS: WorkRecord[] = titles.map((title, index) => ({
  id:`cosmere-index-${index + 1}`, title, sourceId:COSMERE_INDEX_SOURCE.id,
  // Deliberately empty: title metadata alone does not prove a world relation.
  worldIds:[]
}));

export function validateCatalog(
  sources: SourceRecord[], worlds: WorldRecord[], works: WorkRecord[], units: ReadingUnit[] = []
): ValidationIssue[] {
  const issues: ValidationIssue[]=[]; const ids=new Set<string>();
  for (const item of [...sources,...worlds,...works,...units]) {
    if (!item.id || ids.has(item.id)) issues.push({code:"duplicate-or-empty-id",id:item.id});
    ids.add(item.id);
  }
  const sourceIds=new Set(sources.map(s=>s.id)), worldIds=new Set(worlds.map(w=>w.id)), workIds=new Set(works.map(w=>w.id));
  for (const work of works) {
    if (!work.title.trim()) issues.push({code:"empty-work-title",id:work.id});
    if (!sourceIds.has(work.sourceId)) issues.push({code:"unknown-source",id:work.id});
    for (const worldId of work.worldIds) if (!worldIds.has(worldId)) issues.push({code:"unknown-world",id:work.id});
  }
  const positions=new Set<string>();
  for (const unit of units) {
    if (!workIds.has(unit.workId)) issues.push({code:"unknown-work",id:unit.id});
    const key=`${unit.workId}:${unit.position}`;
    if (!Number.isInteger(unit.position) || unit.position < 1 || positions.has(key)) issues.push({code:"invalid-or-duplicate-position",id:unit.id});
    positions.add(key);
  }
  return issues;
}

export function acceptedProgress(snapshot: ProgressSnapshot, units: ReadingUnit[]): string[] {
  const known=new Set(units.filter(u=>u.workId===snapshot.workId).map(u=>u.id));
  return [...new Set(snapshot.completedUnitIds.filter(id=>known.has(id)))];
}
