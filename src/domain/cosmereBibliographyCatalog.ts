import { SourceCatalogEntry, hasValidSourceCatalog } from "./sourceCatalog";

export interface BibliographyCatalog {
  status: "valid" | "blocked";
  sources: readonly SourceCatalogEntry[];
}

/**
 * Bibliographic manifest for private collections declared by the project owner.
 * This is metadata only: catalog membership never asserts that narrative text
 * or passages were read in the current environment.
 */
export const COSMERE_EPUB_BIBLIOGRAPHY: readonly SourceCatalogEntry[] = [
  ["mistborn-final-empire","El Imperio Final"],
  ["mistborn-well-of-ascension","El Pozo de la Ascensión"],
  ["mistborn-hero-of-ages","El Héroe de las Eras"],
  ["mistborn-alloy-of-law","Aleación de ley"],
  ["mistborn-shadows-of-self","Sombras de identidad"],
  ["mistborn-bands-of-mourning","Brazales de Duelo"],
  ["mistborn-lost-metal","El metal perdido"],
  ["warbreaker","El aliento de los dioses"],
  ["elantris","Elantris"],
  ["white-sand-vol-1","Arena blanca vol. 1"],
  ["white-sand-vol-2","Arena blanca vol. 2"],
  ["white-sand-vol-3","Arena blanca vol. 3"],
  ["tress-emerald-sea","Trenza del mar Esmeralda"],
  ["yumi-nightmare-painter","Yumi y el pintor de pesadillas"],
  ["sunlit-man","El Hombre Iluminado"],
  ["isles-emberdark","Islas de la ascuaoscura"],
  ["arcanum-unbounded","Arcanum ilimitado"],
].map(([id, title]) => ({
  id,
  title,
  sourceCollectionId: "cosmere.epub",
  access: "verified-structure" as const,
}));

/**
 * Validates an explicit bibliography without deriving entries from filenames,
 * title patterns, or external editorial knowledge.
 */
export function resolveBibliographyCatalog(
  sources: readonly SourceCatalogEntry[] = COSMERE_EPUB_BIBLIOGRAPHY,
): BibliographyCatalog {
  return hasValidSourceCatalog([...sources])
    ? { status: "valid", sources: [...sources] }
    : { status: "blocked", sources: [] };
}
