/**
 * Hoid IA source catalog.
 *
 * This catalog intentionally contains metadata only. It does not embed or
 * reproduce private EPUB text. Availability in this catalog never authorizes
 * narrative context by itself; callers must also provide explicit reading
 * progress and accessible, chapter-bounded evidence.
 */
export type HoidSource = {
  id: string;
  title: string;
  collection: "mistborn" | "standalone" | "graphic" | "secret-project" | "arcanum" | "roshar";
};

export const HOID_SOURCE_CATALOG: readonly HoidSource[] = [
  { id: "mistborn-era1-1", title: "El Imperio Final", collection: "mistborn" },
  { id: "mistborn-era1-2", title: "El Pozo de la Ascensión", collection: "mistborn" },
  { id: "mistborn-era1-3", title: "El Héroe de las Eras", collection: "mistborn" },
  { id: "mistborn-era2-1", title: "Aleación de ley", collection: "mistborn" },
  { id: "mistborn-era2-2", title: "Sombras de identidad", collection: "mistborn" },
  { id: "mistborn-era2-3", title: "Brazales de Duelo", collection: "mistborn" },
  { id: "mistborn-era2-4", title: "El metal perdido", collection: "mistborn" },
  { id: "warbreaker", title: "El aliento de los dioses", collection: "standalone" },
  { id: "elantris", title: "Elantris", collection: "standalone" },
  { id: "white-sand-1", title: "Arena blanca vol. 1", collection: "graphic" },
  { id: "white-sand-2", title: "Arena blanca vol. 2", collection: "graphic" },
  { id: "white-sand-3", title: "Arena blanca vol. 3", collection: "graphic" },
  { id: "tress", title: "Trenza del mar Esmeralda", collection: "secret-project" },
  { id: "yumi", title: "Yumi y el pintor de pesadillas", collection: "secret-project" },
  { id: "sunlit", title: "El Hombre Iluminado", collection: "secret-project" },
  { id: "isles", title: "Islas de la ascuaoscura", collection: "secret-project" },
  { id: "arcanum", title: "Arcanum ilimitado", collection: "arcanum" },
  { id: "stormlight-1", title: "El Camino de los Reyes", collection: "roshar" },
  { id: "stormlight-2", title: "Palabras Radiantes", collection: "roshar" },
  { id: "stormlight-3", title: "Juramentada", collection: "roshar" },
  { id: "stormlight-4", title: "El Ritmo de la Guerra", collection: "roshar" },
  { id: "stormlight-5", title: "Viento y Verdad", collection: "roshar" },
  { id: "edgedancer", title: "Danzante del Filo", collection: "roshar" },
  { id: "dawnshard", title: "Esquirla del amanecer", collection: "roshar" },
] as const;

export function isKnownSource(id: string): boolean {
  return HOID_SOURCE_CATALOG.some((source) => source.id === id);
}
