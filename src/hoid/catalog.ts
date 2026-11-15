/**
 * Hoid IA — catalog metadata and spoiler-safe source boundary.
 *
 * This module intentionally contains no copyrighted book text. It only models
 * source identities supplied by the user so later adapters can attach chapter
 * metadata and original, reviewable summaries.
 */

export type HoidSourceId =
  | "mistborn-era-1-final-empire"
  | "mistborn-era-1-well-of-ascension"
  | "mistborn-era-1-hero-of-ages"
  | "mistborn-era-2-alloy-of-law"
  | "mistborn-era-2-shadows-of-self"
  | "mistborn-era-2-bands-of-mourning"
  | "mistborn-era-2-lost-metal"
  | "warbreaker" | "elantris"
  | "white-sand-1" | "white-sand-2" | "white-sand-3"
  | "tress" | "yumi" | "sunlit-man" | "isles-of-emberdark"
  | "arcanum-unbounded"
  | "stormlight-1" | "stormlight-2" | "stormlight-3"
  | "stormlight-4" | "stormlight-5"
  | "edgedancer" | "dawnshard";

export interface HoidSource {
  id: HoidSourceId;
  title: string;
  kind: "novel" | "novella" | "graphic" | "collection";
}

export const HOID_CATALOG: readonly HoidSource[] = [
  ["mistborn-era-1-final-empire","El Imperio Final","novel"],
  ["mistborn-era-1-well-of-ascension","El Pozo de la Ascensión","novel"],
  ["mistborn-era-1-hero-of-ages","El Héroe de las Eras","novel"],
  ["mistborn-era-2-alloy-of-law","Aleación de ley","novel"],
  ["mistborn-era-2-shadows-of-self","Sombras de identidad","novel"],
  ["mistborn-era-2-bands-of-mourning","Brazales de Duelo","novel"],
  ["mistborn-era-2-lost-metal","El metal perdido","novel"],
  ["warbreaker","El aliento de los dioses","novel"],
  ["elantris","Elantris","novel"],
  ["white-sand-1","Arena blanca vol. 1","graphic"],
  ["white-sand-2","Arena blanca vol. 2","graphic"],
  ["white-sand-3","Arena blanca vol. 3","graphic"],
  ["tress","Trenza del mar Esmeralda","novel"],
  ["yumi","Yumi y el pintor de pesadillas","novel"],
  ["sunlit-man","El Hombre Iluminado","novel"],
  ["isles-of-emberdark","Islas de la ascuaoscura","novel"],
  ["arcanum-unbounded","Arcanum ilimitado","collection"],
  ["stormlight-1","El Camino de los Reyes","novel"],
  ["stormlight-2","Palabras radiantes","novel"],
  ["stormlight-3","Juramentada","novel"],
  ["stormlight-4","El Ritmo de la Guerra","novel"],
  ["stormlight-5","Viento y verdad","novel"],
  ["edgedancer","Danzante del Filo","novella"],
  ["dawnshard","Esquirla del amanecer","novella"],
].map(([id,title,kind]) => ({ id: id as HoidSourceId, title, kind: kind as HoidSource["kind"] }));

export function isCatalogSource(id: string): id is HoidSourceId {
  return HOID_CATALOG.some(source => source.id === id);
}
