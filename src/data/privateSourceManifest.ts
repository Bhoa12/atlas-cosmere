/**
 * Private-source manifest for expansion planning.
 *
 * This is bibliographic metadata only. It intentionally does not infer plot
 * facts, chapter boundaries or world assignments from titles alone. Works stay
 * in a pending state until an accessible source has been structurally verified.
 * Private EPUB files must never be committed to the repository.
 */
export type SourceProcessingStatus = 'catalogued' | 'structure_pending' | 'structure_verified';

export interface SourceWorkManifest {
  id: string;
  title: string;
  sourceCollection: 'cosmere.epub' | 'roshar-private-epubs';
  status: SourceProcessingStatus;
}

export const PRIVATE_SOURCE_MANIFEST: readonly SourceWorkManifest[] = [
  { id: 'mistborn-final-empire', title: 'El Imperio Final', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'mistborn-well-ascension', title: 'El Pozo de la Ascensión', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'mistborn-hero-ages', title: 'El Héroe de las Eras', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'mistborn-alloy-law', title: 'Aleación de ley', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'mistborn-shadows-self', title: 'Sombras de identidad', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'mistborn-bands-mourning', title: 'Brazales de Duelo', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'mistborn-lost-metal', title: 'El metal perdido', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'warbreaker', title: 'El aliento de los dioses', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'elantris', title: 'Elantris', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'white-sand-1', title: 'Arena blanca vol. 1', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'white-sand-2', title: 'Arena blanca vol. 2', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'white-sand-3', title: 'Arena blanca vol. 3', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'tress-emerald-sea', title: 'Trenza del mar Esmeralda', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'yumi-nightmare-painter', title: 'Yumi y el pintor de pesadillas', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'sunlit-man', title: 'El Hombre Iluminado', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'isles-emberdark', title: 'Islas de la ascuaoscura', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'arcanum-unbounded', title: 'Arcanum ilimitado', sourceCollection: 'cosmere.epub', status: 'catalogued' },
  { id: 'roshar-main-series', title: 'Cinco novelas principales de Roshar', sourceCollection: 'roshar-private-epubs', status: 'catalogued' },
  { id: 'edgedancer', title: 'Danzante del Filo', sourceCollection: 'roshar-private-epubs', status: 'catalogued' },
  { id: 'dawnshard', title: 'Esquirla del amanecer', sourceCollection: 'roshar-private-epubs', status: 'catalogued' },
];
