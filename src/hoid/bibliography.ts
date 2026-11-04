/**
 * Metadata-only bibliography for Hoid IA.
 *
 * This list identifies private source works supplied by the user. It must never
 * contain EPUB text, extracted passages, or unverified claims about a work.
 * Knowledge entries may cite sourceId + chapter only after editorial verification.
 */
export type HoidSourceWork = {
  id: string;
  title: string;
  sourceGroup: "cosmere.epub" | "roshar-epubs";
};

export const HOID_SOURCE_BIBLIOGRAPHY: readonly HoidSourceWork[] = [
  { id: "tfe", title: "El Imperio Final", sourceGroup: "cosmere.epub" },
  { id: "woa", title: "El Pozo de la Ascensión", sourceGroup: "cosmere.epub" },
  { id: "hoa", title: "El Héroe de las Eras", sourceGroup: "cosmere.epub" },
  { id: "aol", title: "Aleación de ley", sourceGroup: "cosmere.epub" },
  { id: "sos", title: "Sombras de identidad", sourceGroup: "cosmere.epub" },
  { id: "bom", title: "Brazales de Duelo", sourceGroup: "cosmere.epub" },
  { id: "tlm", title: "El metal perdido", sourceGroup: "cosmere.epub" },
  { id: "warbreaker", title: "El aliento de los dioses", sourceGroup: "cosmere.epub" },
  { id: "elantris", title: "Elantris", sourceGroup: "cosmere.epub" },
  { id: "white-sand-1", title: "Arena blanca vol. 1", sourceGroup: "cosmere.epub" },
  { id: "white-sand-2", title: "Arena blanca vol. 2", sourceGroup: "cosmere.epub" },
  { id: "white-sand-3", title: "Arena blanca vol. 3", sourceGroup: "cosmere.epub" },
  { id: "tress", title: "Trenza del mar Esmeralda", sourceGroup: "cosmere.epub" },
  { id: "yumi", title: "Yumi y el pintor de pesadillas", sourceGroup: "cosmere.epub" },
  { id: "sunlit", title: "El Hombre Iluminado", sourceGroup: "cosmere.epub" },
  { id: "isles", title: "Islas de la ascuaoscura", sourceGroup: "cosmere.epub" },
  { id: "arcanum", title: "Arcanum ilimitado", sourceGroup: "cosmere.epub" },
  { id: "twok", title: "El Camino de los Reyes", sourceGroup: "roshar-epubs" },
  { id: "wor", title: "Palabras radiantes", sourceGroup: "roshar-epubs" },
  { id: "ob", title: "Juramentada", sourceGroup: "roshar-epubs" },
  { id: "row", title: "El Ritmo de la Guerra", sourceGroup: "roshar-epubs" },
  { id: "sawt", title: "Viento y Verdad", sourceGroup: "roshar-epubs" },
  { id: "edgedancer", title: "Danzante del Filo", sourceGroup: "roshar-epubs" },
  { id: "dawnshard", title: "Esquirla del amanecer", sourceGroup: "roshar-epubs" },
];

export function isKnownHoidSource(sourceId: string): boolean {
  return HOID_SOURCE_BIBLIOGRAPHY.some(source => source.id === sourceId);
}
