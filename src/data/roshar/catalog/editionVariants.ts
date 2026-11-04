import { ReadingEditionVariant } from '../model';

/**
 * Variantes digitales observadas en los EPUB aportados para la auditoría.
 * No representan ISBN ni se declaran equivalentes a ediciones impresas.
 * Los localizadores se conservan como rutas NCX exactas por unidad.
 */
export const ROSHAR_EDITION_VARIANTS: ReadingEditionVariant[] = [
  {
    id: 'epub-user-stormlight-1-5',
    workId: 'twok',
    format: 'epub',
    provenance: 'user-supplied-file',
    sourceFile: 'El_Archivo_de_las_Tormentas_15_Brandon_Sanderson.epub',
    navigationDocument: 'NCX',
    contentRoot: 'OEBPS',
    isbn: null
  },
  {
    id: 'epub-user-stormlight-1-5-wor',
    workId: 'wor',
    format: 'epub',
    provenance: 'user-supplied-file',
    sourceFile: 'El_Archivo_de_las_Tormentas_15_Brandon_Sanderson.epub',
    navigationDocument: 'NCX',
    contentRoot: 'OEBPS',
    isbn: null
  },
  {
    id: 'epub-user-stormlight-1-5-o',
    workId: 'o',
    format: 'epub',
    provenance: 'user-supplied-file',
    sourceFile: 'El_Archivo_de_las_Tormentas_15_Brandon_Sanderson.epub',
    navigationDocument: 'NCX',
    contentRoot: 'OEBPS',
    isbn: null
  },
  {
    id: 'epub-user-stormlight-1-5-row',
    workId: 'row',
    format: 'epub',
    provenance: 'user-supplied-file',
    sourceFile: 'El_Archivo_de_las_Tormentas_15_Brandon_Sanderson.epub',
    navigationDocument: 'NCX',
    contentRoot: 'OEBPS',
    isbn: null
  },
  {
    id: 'epub-user-stormlight-1-5-wat',
    workId: 'wat',
    format: 'epub',
    provenance: 'user-supplied-file',
    sourceFile: 'El_Archivo_de_las_Tormentas_15_Brandon_Sanderson.epub',
    navigationDocument: 'NCX',
    contentRoot: 'OEBPS',
    isbn: null
  },
  {
    id: 'epub-user-edgedancer',
    workId: 'edgedancer',
    format: 'epub',
    provenance: 'user-supplied-file',
    sourceFile: '4 Danzante del Filo Brandon Sanderson.epub',
    navigationDocument: 'NCX',
    contentRoot: 'OEBPS',
    isbn: null
  },
  {
    id: 'epub-user-dawnshard',
    workId: 'dawnshard',
    format: 'epub',
    provenance: 'user-supplied-file',
    sourceFile: '6 Esquirla del amanecer Brandon Sanderson.epub',
    navigationDocument: 'NCX',
    contentRoot: 'OEBPS',
    isbn: null
  }
];
