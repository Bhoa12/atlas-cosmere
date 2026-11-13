/**
 * Canonical, non-narrative source catalog for Hoid IA.
 *
 * This module intentionally stores only bibliographic metadata and reading
 * structure. It must not be treated as evidence that a passage was accessed.
 */
export type SourceCoverage =
  | "catalog_only"
  | "structure_verified"
  | "summary_backed"
  | "unavailable";

export interface HoidCatalogWork {
  id: string;
  title: string;
  sourceId: string;
  coverage: SourceCoverage;
  /** Optional structural information; never narrative text. */
  readingOrder?: number;
}

export interface HoidSourceCatalog {
  readonly sources: readonly {
    id: string;
    label: string;
    works: readonly HoidCatalogWork[];
  }[];
}

export const COSMERE_EPUB_WORKS: readonly HoidCatalogWork[] = [
  "El Imperio Final","El Pozo de la Ascensión","El Héroe de las Eras",
  "Aleación de ley","Sombras de identidad","Brazales de Duelo","El metal perdido",
  "El aliento de los dioses","Elantris","Arena blanca vol. 1","Arena blanca vol. 2",
  "Arena blanca vol. 3","Trenza del mar Esmeralda","Yumi y el pintor de pesadillas",
  "El Hombre Iluminado","Islas de la ascuaoscura","Arcanum ilimitado"
].map((title, readingOrder) => ({
  id: "cosmere-" + (readingOrder + 1),
  title,
  sourceId: "cosmere.epub",
  coverage: "structure_verified" as const,
  readingOrder: readingOrder + 1,
}));

/**
 * Roshar source files are catalogued by their verified collection shape here.
 * Individual filenames or passage availability remain external concerns.
 */
export const ROSHAR_WORK_TITLES = [
  "El Camino de los Reyes",
  "Palabras Radiantes",
  "Juramentada",
  "El Ritmo de la Guerra",
  "Viento y Verdad",
  "Danzante del Filo",
  "Esquirla del amanecer",
] as const;

export function createPrivateSourceCatalog(): HoidSourceCatalog {
  return {
    sources: [
      { id: "cosmere.epub", label: "cosmere.epub", works: COSMERE_EPUB_WORKS },
      {
        id: "roshar-private",
        label: "EPUBs privados de Roshar",
        works: ROSHAR_WORK_TITLES.map((title, readingOrder) => ({
          id: "roshar-" + (readingOrder + 1),
          title,
          sourceId: "roshar-private",
          coverage: "structure_verified" as const,
          readingOrder: readingOrder + 1,
        })),
      },
    ],
  };
}

/**
 * Fail closed: catalog membership alone never authorizes a narrative claim.
 */
export function isNarrativeEvidenceAvailable(
  work: HoidCatalogWork,
): boolean {
  return work.coverage === "summary_backed";
}
