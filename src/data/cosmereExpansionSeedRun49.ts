import { SourceRecord, WorldRecord, WorkRecord } from "./cosmereExpansionRun49";

export const sources: SourceRecord[] = [
  { id: "cosmere-epub-index", label: "cosmere.epub (índice verificado)", kind: "verified-index" },
  { id: "roshar-private-epubs", label: "EPUBs privados de Roshar", kind: "declared-private" },
];

export const worlds: WorldRecord[] = [
  { id: "scadrial", label: "Scadrial" },
  { id: "sel", label: "Sel" },
  { id: "nalthis", label: "Nalthis" },
  { id: "taldain", label: "Taldain" },
  { id: "roshar", label: "Roshar" },
];

const indexedTitles = [
  "El Imperio Final", "El Pozo de la Ascensión", "El Héroe de las Eras",
  "Aleación de ley", "Sombras de identidad", "Brazales de Duelo", "El metal perdido",
  "El aliento de los dioses", "Elantris", "Arena blanca vol. 1", "Arena blanca vol. 2",
  "Arena blanca vol. 3", "Trenza del mar Esmeralda", "Yumi y el pintor de pesadillas",
  "El Hombre Iluminado", "Islas de la ascuaoscura", "Arcanum ilimitado",
] as const;

export const works: WorkRecord[] = indexedTitles.map((title, index) => ({
  id: `indexed-${index + 1}`,
  title,
  sourceId: "cosmere-epub-index",
}));

// Intentionally no world assignments or internal reading units: neither is inferred from titles.
