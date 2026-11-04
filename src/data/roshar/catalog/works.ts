import { SISTEMAS_COSMERE_COMPLETO } from '../../cosmereUniverse';
import { RosharWork } from '../model';

/**
 * Adaptador del catálogo legado más relatos cortos oficiales publicados.
 * Publication order is deliberately left null until each first-publication
 * date is verified independently. Recommended order follows official series
 * numbering; it is not an in-world chronology.
 */
const ROSHAR_WORK_METADATA: Record<string, { workType: RosharWork['workType']; recommendedReadingOrder: number }> = {
  twok: { workType: 'novel', recommendedReadingOrder: 1 },
  wor: { workType: 'novel', recommendedReadingOrder: 2 },
  edgedancer: { workType: 'novella', recommendedReadingOrder: 2.5 },
  o: { workType: 'novel', recommendedReadingOrder: 3 },
  dawnshard: { workType: 'novella', recommendedReadingOrder: 3.5 },
  row: { workType: 'novel', recommendedReadingOrder: 4 },
  wat: { workType: 'novel', recommendedReadingOrder: 5 }
};

const rosharSystem = SISTEMAS_COSMERE_COMPLETO.find(system => system.id === 'roshar');

if (!rosharSystem) {
  throw new Error('Roshar is missing from SISTEMAS_COSMERE_COMPLETO');
}

const LEGACY_ROSHAR_WORKS: RosharWork[] = rosharSystem.libros.map(book => {
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
    recommendedReadingOrder: metadata.recommendedReadingOrder
  };
});

/**
 * These stories are part of the official Stormlight Archive catalog, but are
 * not present in the legacy planet dataset. Keep separate IDs and no chapter
 * counts until an edition-specific unit inventory has been verified.
 */
const ADDITIONAL_ROSHAR_WORKS: RosharWork[] = [
  {
    id: 'elsecaller',
    planetId: 'roshar',
    seriesId: 'stormlight-archive',
    title: 'Elsecaller',
    workType: 'short-story',
    publicationOrder: null,
    recommendedReadingOrder: 2.6
  },
  {
    id: 'king-lopen',
    planetId: 'roshar',
    seriesId: 'stormlight-archive',
    title: 'King Lopen: The First of Alethkar',
    workType: 'short-story',
    publicationOrder: null,
    recommendedReadingOrder: 2.7
  }
];

export const ROSHAR_WORKS: RosharWork[] = [
  ...LEGACY_ROSHAR_WORKS,
  ...ADDITIONAL_ROSHAR_WORKS
];

export const ROSHAR_WORK_IDS = ROSHAR_WORKS.map(work => work.id);
