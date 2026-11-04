export type WorldId = string;
export type WorkId = string;
export type ReadingUnitId = string;
export interface WorldCatalog { id: WorldId; name: string; works: WorkCatalog[]; }
export interface WorkCatalog { id: WorkId; worldId: WorldId; title: string; units: ReadingUnit[]; }
export interface ReadingUnit { id: ReadingUnitId; workId: WorkId; order: number; label: string; }
export function validateWorldCatalog(catalog: WorldCatalog): string[] {
 const errors: string[]=[]; const workIds=new Set<string>();
 for(const work of catalog.works){ if(work.worldId!==catalog.id) errors.push('Work '+work.id+' belongs to a different world'); if(workIds.has(work.id)) errors.push('Duplicate work id: '+work.id); workIds.add(work.id); const unitIds=new Set<string>(); let previous=-Infinity; for(const unit of work.units){ if(unit.workId!==work.id) errors.push('Unit '+unit.id+' belongs to a different work'); if(unitIds.has(unit.id)) errors.push('Duplicate unit id: '+unit.id); unitIds.add(unit.id); if(!Number.isInteger(unit.order)||unit.order<0) errors.push('Invalid order for unit '+unit.id); if(unit.order<=previous) errors.push('Units for '+work.id+' are not strictly ordered'); previous=unit.order; }} return errors;
}