export type SourceKind = "verified-index" | "declared-private";

export interface SourceRecord {
  id: string;
  kind: SourceKind;
  label: string;
}

export interface WorldRecord {
  id: string;
  label: string;
}

export interface WorkRecord {
  id: string;
  title: string;
  sourceId: string;
}

export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
  label: string;
}

export interface ProgressRecord {
  workId: string;
  completedUnitIds: string[];
}

export interface SpoilerGate {
  workId: string;
  requiredUnitIds: string[];
}

export interface Catalogue {
  sources: SourceRecord[];
  worlds: WorldRecord[];
  works: WorkRecord[];
  units: ReadingUnit[];
}

export function validateCatalogue(catalogue: Catalogue): string[] {
  const errors: string[] = [];
  const unique = (ids: string[], label: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (!id.trim()) errors.push(`${label} id vacío`);
      if (seen.has(id)) errors.push(`${label} duplicado: ${id}`);
      seen.add(id);
    }
  };
  unique(catalogue.sources.map(x => x.id), "source");
  unique(catalogue.worlds.map(x => x.id), "world");
  unique(catalogue.works.map(x => x.id), "work");
  unique(catalogue.units.map(x => x.id), "unit");

  const sourceIds = new Set(catalogue.sources.map(x => x.id));
  const workIds = new Set(catalogue.works.map(x => x.id));
  for (const work of catalogue.works) {
    if (!work.title.trim()) errors.push(`work sin título: ${work.id}`);
    if (!sourceIds.has(work.sourceId)) errors.push(`source desconocida: ${work.sourceId}`);
  }
  const positions = new Set<string>();
  for (const unit of catalogue.units) {
    if (!workIds.has(unit.workId)) errors.push(`obra desconocida: ${unit.workId}`);
    if (!Number.isInteger(unit.position) || unit.position < 1) errors.push(`posición inválida: ${unit.id}`);
    const key = `${unit.workId}:${unit.position}`;
    if (positions.has(key)) errors.push(`posición duplicada: ${key}`);
    positions.add(key);
  }
  return errors;
}

export function canReveal(gate: SpoilerGate, progress: ProgressRecord | undefined, units: ReadingUnit[]): boolean {
  if (!progress || progress.workId !== gate.workId) return false;
  if (gate.requiredUnitIds.length === 0) return false;
  if (new Set(gate.requiredUnitIds).size !== gate.requiredUnitIds.length) return false;
  const byId = new Map(units.map(unit => [unit.id, unit]));
  for (const id of gate.requiredUnitIds) {
    const unit = byId.get(id);
    if (!unit || unit.workId !== gate.workId || !progress.completedUnitIds.includes(id)) return false;
  }
  return true;
}

// Catálogo semilla: solo metadatos proporcionados por el usuario; no contiene texto protegido.
export const sourceCatalogue: Catalogue = {
  sources: [
    { id: "cosmere-index", kind: "verified-index", label: "cosmere.epub (índice verificado)" },
    { id: "roshar-private", kind: "declared-private", label: "Colección privada de Roshar" }
  ],
  worlds: [
    { id: "scadrial", label: "Scadrial" },
    { id: "sel", label: "Sel" },
    { id: "nalthis", label: "Nalthis" },
    { id: "taldain", label: "Taldain" },
    { id: "roshar", label: "Roshar" }
  ],
  works: [
    "El Imperio Final","El Pozo de la Ascensión","El Héroe de las Eras","Aleación de ley","Sombras de identidad","Brazales de Duelo","El metal perdido","El aliento de los dioses","Elantris","Arena blanca vol. 1","Arena blanca vol. 2","Arena blanca vol. 3","Trenza del mar Esmeralda","Yumi y el pintor de pesadillas","El Hombre Iluminado","Islas de la ascuaoscura","Arcanum ilimitado"
  ].map((title, index) => ({ id: `work-${index + 1}`, title, sourceId: "cosmere-index" })),
  units: []
};
