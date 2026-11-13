import type { SourceRecord, WorkRecord, WorldRecord } from "./cosmereExpansionModel";

export const sourceCatalogue: SourceRecord[] = [
  { id: "cosmere-epub-index", label: "cosmere.epub (índice verificado)", status: "verified-index" },
  { id: "roshar-private-epubs", label: "EPUBs privados de Roshar", status: "declared-private" },
];

const titles = [
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

export const sourceWorks: WorkRecord[] = titles.map((title, index) => ({
  id: `catalogue-work-${index + 1}`,
  title,
  sourceId: "cosmere-epub-index",
}));

export const priorityWorlds: WorldRecord[] = [
  { id: "scadrial", name: "Scadrial" },
  { id: "sel", name: "Sel" },
  { id: "nalthis", name: "Nalthis" },
  { id: "taldain", name: "Taldain" },
  { id: "roshar", name: "Roshar" },
];

// This catalogue deliberately contains no inferred work-to-world relations.
