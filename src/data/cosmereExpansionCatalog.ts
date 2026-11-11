/**
 * Bibliographic source catalog for Atlas del Cosmere.
 *
 * This module intentionally stores only metadata supplied by the project's
 * verified source inventory. It does not contain book text, chapter text,
 * plot summaries, or inferred editorial structure.
 */

export type SourceCatalogEntry = {
  id: string;
  title: string;
  sourceCollection: 'cosmere.epub' | 'roshar-private-epubs';
  worldIds: readonly string[];
  editorialStructureVerified: boolean;
};

const emptyWorldAssignment = [] as const;

export const COSMERE_SOURCE_CATALOG: readonly SourceCatalogEntry[] = [
  { id: 'mistborn-final-empire', title: 'El Imperio Final', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'mistborn-well-of-ascension', title: 'El Pozo de la Ascensión', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'mistborn-hero-of-ages', title: 'El Héroe de las Eras', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'mistborn-alloy-of-law', title: 'Aleación de ley', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'mistborn-shadows-of-self', title: 'Sombras de identidad', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'mistborn-bands-of-mourning', title: 'Brazales de Duelo', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'mistborn-lost-metal', title: 'El metal perdido', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'warbreaker', title: 'El aliento de los dioses', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'elantris', title: 'Elantris', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'white-sand-vol-1', title: 'Arena blanca vol. 1', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'white-sand-vol-2', title: 'Arena blanca vol. 2', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'white-sand-vol-3', title: 'Arena blanca vol. 3', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'tress', title: 'Trenza del mar Esmeralda', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'yumi', title: 'Yumi y el pintor de pesadillas', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'sunlit-man', title: 'El Hombre Iluminado', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'isles-of-the-emberdark', title: 'Islas de la ascuaoscura', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
  { id: 'arcanum-unbounded', title: 'Arcanum ilimitado', sourceCollection: 'cosmere.epub', worldIds: emptyWorldAssignment, editorialStructureVerified: false },
] as const;

export function findSourceCatalogEntry(id: string): SourceCatalogEntry | undefined {
  return COSMERE_SOURCE_CATALOG.find((entry) => entry.id === id);
}
