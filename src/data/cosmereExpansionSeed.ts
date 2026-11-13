import type { ExpansionCatalogue } from "./sourceSafeExpansion";

/**
 * Bibliographic seed from the user-provided verified index.
 * Titles are metadata only; no EPUB text is embedded here.
 *
 * World assignments and reading-unit granularity intentionally remain empty
 * until backed by explicit metadata.
 */
const indexedTitles = [
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
];

const slug = (title: string, index: number) =>
  "work-" + (index + 1).toString().padStart(2, "0");

export const cosmereExpansionSeed: ExpansionCatalogue = {
  sources: [
    {
      id: "cosmere-epub",
      label: "cosmere.epub",
      status: "verified-index",
    },
    {
      id: "roshar-private-epubs",
      label: "Colección privada de EPUBs de Roshar",
      status: "declared-private",
    },
  ],
  worlds: [
    { id: "scadrial", label: "Scadrial" },
    { id: "sel", label: "Sel" },
    { id: "nalthis", label: "Nalthis" },
    { id: "taldain", label: "Taldain" },
    { id: "roshar", label: "Roshar" },
  ],
  works: indexedTitles.map((title, index) => ({
    id: slug(title, index),
    title,
    sourceId: "cosmere-epub",
  })),
  units: [],
  assignments: [],
};
