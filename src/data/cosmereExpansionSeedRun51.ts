import type { ExpansionCatalogue, WorldRecord } from "./cosmereExpansionRun51";

export const priorityWorlds: WorldRecord[] = [
  { id: "scadrial", title: "Scadrial" },
  { id: "sel", title: "Sel" },
  { id: "nalthis", title: "Nalthis" },
  { id: "taldain", title: "Taldain" },
  { id: "roshar", title: "Roshar" }
];

const verifiedIndexTitles = [
  "El Imperio Final", "El Pozo de la Ascensión", "El Héroe de las Eras",
  "Aleación de ley", "Sombras de identidad", "Brazales de Duelo", "El metal perdido",
  "El aliento de los dioses", "Elantris", "Arena blanca vol. 1", "Arena blanca vol. 2",
  "Arena blanca vol. 3", "Trenza del mar Esmeralda", "Yumi y el pintor de pesadillas",
  "El Hombre Iluminado", "Islas de la ascuaoscura", "Arcanum ilimitado"
];

export const cosmereExpansionSeed: ExpansionCatalogue = {
  sources: [
    { id: "cosmere-epub-index", title: "cosmere.epub", status: "verified-index" },
    { id: "roshar-private-collection", title: "Colección privada de EPUBs de Roshar", status: "declared-private" }
  ],
  worlds: priorityWorlds,
  works: verifiedIndexTitles.map((title, index) => ({
    id: "verified-work-" + (index + 1),
    title,
    sourceId: "cosmere-epub-index"
  })),
  readingUnits: []
};
// worldId and internal reading structure are intentionally absent: neither is inferred from titles.
