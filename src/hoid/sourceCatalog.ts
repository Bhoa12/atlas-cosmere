/**
 * Hoid IA source catalog.
 * Metadata only: catalog membership never grants narrative access.
 */
export type SourceWork = {
  id: string;
  title: string;
  collection: "mistborn" | "standalone" | "graphic-novel" | "secret-project" | "arcanum" | "roshar";
};

export const SOURCE_CATALOG: readonly SourceWork[] = [
  { id: "mistborn-1", title: "El Imperio Final", collection: "mistborn" },
  { id: "mistborn-2", title: "El Pozo de la Ascensión", collection: "mistborn" },
  { id: "mistborn-3", title: "El Héroe de las Eras", collection: "mistborn" },
  { id: "alloy-of-law", title: "Aleación de ley", collection: "mistborn" },
  { id: "shadows-of-self", title: "Sombras de identidad", collection: "mistborn" },
  { id: "bands-of-mourning", title: "Brazales de Duelo", collection: "mistborn" },
  { id: "lost-metal", title: "El metal perdido", collection: "mistborn" },
  { id: "warbreaker", title: "El aliento de los dioses", collection: "standalone" },
  { id: "elantris", title: "Elantris", collection: "standalone" },
  { id: "white-sand-1", title: "Arena blanca vol. 1", collection: "graphic-novel" },
  { id: "white-sand-2", title: "Arena blanca vol. 2", collection: "graphic-novel" },
  { id: "white-sand-3", title: "Arena blanca vol. 3", collection: "graphic-novel" },
  { id: "tress", title: "Trenza del mar Esmeralda", collection: "secret-project" },
  { id: "yumi", title: "Yumi y el pintor de pesadillas", collection: "secret-project" },
  { id: "sunlit-man", title: "El Hombre Iluminado", collection: "secret-project" },
  { id: "isles-emberdark", title: "Islas de la ascuaoscura", collection: "secret-project" },
  { id: "arcanum", title: "Arcanum ilimitado", collection: "arcanum" },
  { id: "stormlight-1", title: "El Camino de los Reyes", collection: "roshar" },
  { id: "stormlight-2", title: "Palabras Radiantes", collection: "roshar" },
  { id: "stormlight-3", title: "Juramentada", collection: "roshar" },
  { id: "stormlight-4", title: "El Ritmo de la Guerra", collection: "roshar" },
  { id: "stormlight-5", title: "Viento y Verdad", collection: "roshar" },
  { id: "edgedancer", title: "Danzante del Filo", collection: "roshar" },
  { id: "dawnshard", title: "Esquirla del amanecer", collection: "roshar" },
] as const;

export function isCataloguedWork(workId: string): boolean {
  return SOURCE_CATALOG.some((work) => work.id === workId);
}
