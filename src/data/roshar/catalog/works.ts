import { SISTEMAS_COSMERE_COMPLETO } from '../../cosmereUniverse';
import { RosharWork } from '../model';

/**
 * Adaptador inicial del catálogo legado.
 *
 * No establece todavía el orden de publicación ni crea unidades de lectura.
 * Esos datos se añadirán cuando se contrasten con bibliografía y ediciones
 * oficiales. Conserva los IDs históricos usados por AsyncStorage y pantallas.
 */
const ROSHAR_WORK_METADATA: Record<string, Pick<RosharWork, 'workType'>> = {
  twok: { workType: 'novel' },
  wor: { workType: 'novel' },
  edgedancer: { workType: 'novella' },
  o: { workType: 'novel' },
  dawnshard: { workType: 'novella' },
  row: { workType: 'novel' },
  wat: { workType: 'novel' }
};

const rosharSystem = SISTEMAS_COSMERE_COMPLETO.find(system => system.id === 'roshar');

if (!rosharSystem) {
  throw new Error('Roshar is missing from SISTEMAS_COSMERE_COMPLETO');
}

export const ROSHAR_WORKS: RosharWork[] = rosharSystem.libros.map(book => {
  const metadata = ROSHAR_WORK_METADATA[book.id];
  if (!metadata) {
    throw new Error(`Missing Roshar work metadata for legacy ID: ${book.id}`);
  }

  return {
    id: book.id,
    planetId: 'roshar',
    seriesId: 'stormlight-archive',
    title: book.titulo,
    workType: metadata.workType,
    publicationOrder: null,
    recommendedReadingOrder: Number.isFinite(book.ordenLecturaRecomendado)
      ? book.ordenLecturaRecomendado
      : null
  };
});

export const ROSHAR_WORK_IDS = ROSHAR_WORKS.map(work => work.id);
