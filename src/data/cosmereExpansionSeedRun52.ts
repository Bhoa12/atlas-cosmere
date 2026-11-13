import type { SourceRecord, WorkRecord } from "./cosmereExpansionRun52";

export const cosmereSourcesRun52: readonly SourceRecord[] = [
  { id: "cosmere-epub", provenance: "verified-index", label: "cosmere.epub" },
  { id: "roshar-private", provenance: "declared-private", label: "Roshar EPUB collection" },
];

const indexedTitles = [
  "El Imperio Final", "El Pozo de la Ascensión", "El Héroe de las Eras",
  "Aleación de ley", "Sombras de identidad", "Brazales de Duelo", "El metal perdido",
  "El aliento de los dioses", "Elantris", "Arena blanca vol. 1", "Arena blanca vol. 2",
  "Arena blanca vol. 3", "Trenza del mar Esmeralda", "Yumi y el pintor de pesadillas",
  "El Hombre Iluminado", "Islas de la ascuaoscura", "Arcanum ilimitado",
] as const;

export const cosmereWorksRun52: readonly WorkRecord[] = indexedTitles.map((title, index) => ({
  id: "indexed-" + (index + 1),
  title,
  sourceId: "cosmere-epub",
}));

// No world assignments or internal reading units are inferred from titles or file names.
