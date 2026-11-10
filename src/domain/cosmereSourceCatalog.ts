export type CosmereCatalogSourceId =
  | "cosmere-epub"
  | "roshar-main-novels"
  | "danzante-del-filo"
  | "esquirla-del-amanecer";

export interface CosmereCatalogWork {
  id: string;
  title: string;
  worldId: string | null;
  sourceId: CosmereCatalogSourceId;
}

/**
 * Verified bibliographic metadata supplied for Atlas del Cosmere.
 *
 * This catalog deliberately stores only source-level metadata. It does not
 * contain EPUB text, chapter boundaries, quotations or inferred narrative
 * facts. A null worldId means the source entry is not assigned here without
 * a separate, reviewable metadata decision.
 */
export const COSMERE_SOURCE_CATALOG: readonly CosmereCatalogWork[] = [
  { id: "el-imperio-final", title: "El Imperio Final", worldId: "scadrial", sourceId: "cosmere-epub" },
  { id: "el-pozo-de-la-ascension", title: "El Pozo de la Ascensión", worldId: "scadrial", sourceId: "cosmere-epub" },
  { id: "el-heroe-de-las-eras", title: "El Héroe de las Eras", worldId: "scadrial", sourceId: "cosmere-epub" },
  { id: "aleacion-de-ley", title: "Aleación de ley", worldId: "scadrial", sourceId: "cosmere-epub" },
  { id: "sombras-de-identidad", title: "Sombras de identidad", worldId: "scadrial", sourceId: "cosmere-epub" },
  { id: "brazales-de-duelo", title: "Brazales de Duelo", worldId: "scadrial", sourceId: "cosmere-epub" },
  { id: "el-metal-perdido", title: "El metal perdido", worldId: "scadrial", sourceId: "cosmere-epub" },
  { id: "el-aliento-de-los-dioses", title: "El aliento de los dioses", worldId: "nalthis", sourceId: "cosmere-epub" },
  { id: "elantris", title: "Elantris", worldId: "sel", sourceId: "cosmere-epub" },
  { id: "arena-blanca-vol-1", title: "Arena blanca vol. 1", worldId: "taldain", sourceId: "cosmere-epub" },
  { id: "arena-blanca-vol-2", title: "Arena blanca vol. 2", worldId: "taldain", sourceId: "cosmere-epub" },
  { id: "arena-blanca-vol-3", title: "Arena blanca vol. 3", worldId: "taldain", sourceId: "cosmere-epub" },
  { id: "trenza-del-mar-esmeralda", title: "Trenza del mar Esmeralda", worldId: null, sourceId: "cosmere-epub" },
  { id: "yumi-y-el-pintor-de-pesadillas", title: "Yumi y el pintor de pesadillas", worldId: null, sourceId: "cosmere-epub" },
  { id: "el-hombre-iluminado", title: "El Hombre Iluminado", worldId: null, sourceId: "cosmere-epub" },
  { id: "islas-de-la-ascuaoscura", title: "Islas de la ascuaoscura", worldId: null, sourceId: "cosmere-epub" },
  { id: "arcanum-ilimitado", title: "Arcanum ilimitado", worldId: null, sourceId: "cosmere-epub" },
] as const;

export function listCatalogWorksForWorld(worldId: string): readonly CosmereCatalogWork[] {
  if (typeof worldId !== "string" || !worldId.trim() || worldId !== worldId.trim()) return [];
  return COSMERE_SOURCE_CATALOG.filter((work) => work.worldId === worldId);
}
