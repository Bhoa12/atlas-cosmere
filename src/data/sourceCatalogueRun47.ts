import type { SourceRecord, WorldRecord, WorkRecord } from "./cosmereExpansionRun47";

/**
 * Catalogue metadata only. No EPUB body text, chapter text, or inferred editorial
 * relationships are stored here. World assignment is intentionally absent until
 * supported metadata is available.
 */
export const COSMERE_SOURCES: SourceRecord[] = [
  { id: "cosmere-epub-index", label: "cosmere.epub", kind: "verified-index" },
  { id: "roshar-private-epubs", label: "Roshar private EPUB collection", kind: "declared-private" },
];

export const PRIORITY_WORLDS: WorldRecord[] = [
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
];

export const INDEXED_WORKS: WorkRecord[] = indexedTitles.map((title, index) => ({
  id: `indexed-work-${index + 1}`,
  title,
  sourceId: "cosmere-epub-index",
}));
