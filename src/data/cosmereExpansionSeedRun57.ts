import type { Source, World, Work } from "./cosmereExpansionRun57";

export const priorityWorlds: World[] = [
  { id: "scadrial", label: "Scadrial" },
  { id: "sel", label: "Sel" },
  { id: "nalthis", label: "Nalthis" },
  { id: "taldain", label: "Taldain" },
  { id: "roshar", label: "Roshar" },
];

export const sources: Source[] = [
  { id: "cosmere-index", kind: "verified-index", label: "cosmere.epub (índice verificado)" },
  { id: "roshar-private", kind: "declared-private", label: "EPUBs privados de Roshar (declarados)" },
];

// Titles are catalogue metadata supplied by the user. World relationships are
// deliberately omitted here rather than inferred from titles.
export const works: Work[] = [
  "El Imperio Final", "El Pozo de la Ascensión", "El Héroe de las Eras",
  "Aleación de ley", "Sombras de identidad", "Brazales de Duelo",
  "El metal perdido", "El aliento de los dioses", "Elantris",
  "Arena blanca vol. 1", "Arena blanca vol. 2", "Arena blanca vol. 3",
  "Trenza del mar Esmeralda", "Yumi y el pintor de pesadillas",
  "El Hombre Iluminado", "Islas de la ascuaoscura", "Arcanum ilimitado",
].map((title, index) => ({ id: "catalogue-" + (index + 1), title, sourceId: "cosmere-index" }));
