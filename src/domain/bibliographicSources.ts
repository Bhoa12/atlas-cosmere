/**
 * Bibliographic source manifest for the private material supplied by the user.
 * This file intentionally stores only source-level metadata. It is not a
 * transcription, chapter index, plot database, or proof that a work's full text
 * has been inspected.
 */
export interface BibliographicSource {
  id: string;
  label: string;
  works: readonly string[];
}

export const PRIVATE_BIBLIOGRAPHIC_SOURCES: readonly BibliographicSource[] = [
  {
    id: 'cosmere-epub',
    label: 'cosmere.epub',
    works: [
      'El Imperio Final',
      'El Pozo de la Ascensión',
      'El Héroe de las Eras',
      'Aleación de ley',
      'Sombras de identidad',
      'Brazales de Duelo',
      'El metal perdido',
      'El aliento de los dioses',
      'Elantris',
      'Arena blanca vol. 1',
      'Arena blanca vol. 2',
      'Arena blanca vol. 3',
      'Trenza del mar Esmeralda',
      'Yumi y el pintor de pesadillas',
      'El Hombre Iluminado',
      'Islas de la ascuaoscura',
      'Arcanum ilimitado',
    ],
  },
  {
    id: 'roshar-private-epubs',
    label: 'EPUBs privados de Roshar',
    works: [
      'Las cinco novelas principales de El Archivo de las Tormentas',
      'Danzante del Filo',
      'Esquirla del amanecer',
    ],
  },
] as const;

export function getSourceForWork(workTitle: string): BibliographicSource | undefined {
  return PRIVATE_BIBLIOGRAPHIC_SOURCES.find((source) => source.works.includes(workTitle));
}
