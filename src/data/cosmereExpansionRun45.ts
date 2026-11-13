export type SourceProvenance = "verified-index" | "declared-private";

export interface SourceRecord { id: string; provenance: SourceProvenance; label: string; }
export interface WorldRecord { id: string; label: string; }
export interface WorkRecord { id: string; title: string; sourceId: string; }
export interface ReadingUnit { id: string; workId: string; position: number; label: string; }
export interface ReadingProgress { workId: string; completedUnitIds: readonly string[]; }
export interface SpoilerGate { workId: string; requiredUnitIds: readonly string[]; }

const validId = (id: string) => /^[a-z0-9][a-z0-9-]*$/.test(id);

export function validateCatalogue(sources: readonly SourceRecord[], worlds: readonly WorldRecord[], works: readonly WorkRecord[], units: readonly ReadingUnit[]): string[] {
 const errors: string[]=[]; const duplicate=(items:readonly {id:string}[])=>items.some((x,i)=>items.findIndex(y=>y.id===x.id)!==i);
 if ([sources,worlds,works,units].some(duplicate)) errors.push("duplicate-id");
 for (const item of [...sources,...worlds,...works,...units]) if(!validId(item.id)) errors.push("invalid-id");
 const sourceIds=new Set(sources.map(x=>x.id)), workIds=new Set(works.map(x=>x.id));
 for(const work of works){ if(!work.title.trim()) errors.push("empty-title"); if(!sourceIds.has(work.sourceId)) errors.push("unknown-source"); }
 const seen=new Set<string>(); for(const unit of units){ if(!workIds.has(unit.workId)) errors.push("unknown-work"); if(!Number.isInteger(unit.position)||unit.position<1) errors.push("invalid-position"); const key=unit.workId+":"+unit.position; if(seen.has(key)) errors.push("duplicate-position"); seen.add(key); }
 return [...new Set(errors)];
}

export function canReveal(gate: SpoilerGate, progress: ReadingProgress, units: readonly ReadingUnit[]): boolean {
 if(progress.workId!==gate.workId || gate.requiredUnitIds.length===0) return false;
 const required=new Set(gate.requiredUnitIds); if(required.size!==gate.requiredUnitIds.length) return false;
 const known=new Set(units.filter(u=>u.workId===gate.workId).map(u=>u.id));
 if([...required].some(id=>!known.has(id))) return false;
 const completed=new Set(progress.completedUnitIds);
 return [...required].every(id=>completed.has(id));
}