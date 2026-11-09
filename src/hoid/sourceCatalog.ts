import type { HoidCatalogEntry } from "./contracts";

/**
 * Verified source catalog for Hoid IA.
 *
 * This file intentionally contains only bibliographic metadata. It does not
 * embed EPUB text, quotations, or narrative claims. The Roshar entries whose
 * individual titles are not asserted here remain numbered so catalog identity
 * stays independent from unavailable source text.
 */
export const HOID_SOURCE_CATALOG: readonly HoidCatalogEntry[] = [
  { id: "mistborn-era1-final-empire", title: "El Imperio Final" },
  { id: "mistborn-era1-well-of-ascension", title: "El Pozo de la Ascensión" },
  { id: "mistborn-era1-hero-of-ages", title: "El Héroe de las Eras" },
  { id: "mistborn-era2-alloy-of-law", title: "Aleación de ley" },
  { id: "mistborn-era2-shadows-of-self", title: "Sombras de identidad" },
  { id: "mistborn-era2-bands-of-mourning", title: "Brazales de Duelo" },
  { id: "mistborn-era2-lost-metal", title: "El metal perdido" },
  { id: "warbreaker", title: "El aliento de los dioses" },
  { id: "elantris", title: "Elantris" },
  { id: "white-sand-1", title: "Arena blanca vol. 1" },
  { id: "white-sand-2", title: "Arena blanca vol. 2" },
  { id: "white-sand-3", title: "Arena blanca vol. 3" },
  { id: "tress-emerald-sea", title: "Trenza del mar Esmeralda" },
  { id: "yumi-nightmare-painter", title: "Yumi y el pintor de pesadillas" },
  { id: "sunlit-man", title: "El Hombre Iluminado" },
  { id: "isles-emberdark", title: "Islas de la ascuaoscura" },
  { id: "arcanum-unbounded", title: "Arcanum ilimitado" },
  { id: "roshar-main-1", title: "Archivo de las Tormentas — novela principal 1" },
  { id: "roshar-main-2", title: "Archivo de las Tormentas — novela principal 2" },
  { id: "roshar-main-3", title: "Archivo de las Tormentas — novela principal 3" },
  { id: "roshar-main-4", title: "Archivo de las Tormentas — novela principal 4" },
  { id: "roshar-main-5", title: "Archivo de las Tormentas — novela principal 5" },
  { id: "edgedancer", title: "Danzante del Filo" },
  { id: "dawnshard", title: "Esquirla del amanecer" },
] as const;

export const HOID_SOURCE_CATALOG_IDS: ReadonlySet<string> = new Set(
  HOID_SOURCE_CATALOG.map((entry) => entry.id),
);
