import type { WorldCatalogEntry, WorkCatalogEntry } from '../domain/cosmereCatalog';

/**
 * Bibliographic structure only. Titles come from the user's private source
 * catalogue; no plot or lore is stored here. Reading units remain empty until
 * their boundaries are extracted and validated from an accessible source.
 */
function work(id: string, worldId: string, title: string, sequence: number, format: WorkCatalogEntry['format'] = 'novel'): WorkCatalogEntry {
  return { id, worldId, title, sequence, format, units: [] };
}

export const COSMERE_EXPANSION_SEED: readonly WorldCatalogEntry[] = [
  { id: 'scadrial', name: 'Scadrial', works: [
    work('mistborn-final-empire', 'scadrial', 'El Imperio Final', 1),
    work('mistborn-well-ascension', 'scadrial', 'El Pozo de la Ascensión', 2),
    work('mistborn-hero-ages', 'scadrial', 'El Héroe de las Eras', 3),
    work('mistborn-alloy-law', 'scadrial', 'Aleación de ley', 4),
    work('mistborn-shadows-self', 'scadrial', 'Sombras de identidad', 5),
    work('mistborn-bands-mourning', 'scadrial', 'Brazales de Duelo', 6),
    work('mistborn-lost-metal', 'scadrial', 'El metal perdido', 7),
  ] },
  { id: 'sel', name: 'Sel', works: [work('elantris', 'sel', 'Elantris', 1)] },
  { id: 'nalthis', name: 'Nalthis', works: [work('warbreaker', 'nalthis', 'El aliento de los dioses', 1)] },
  { id: 'taldain', name: 'Taldain', works: [
    work('white-sand-1', 'taldain', 'Arena Blanca, volumen 1', 1, 'graphic_novel'),
    work('white-sand-2', 'taldain', 'Arena Blanca, volumen 2', 2, 'graphic_novel'),
    work('white-sand-3', 'taldain', 'Arena Blanca, volumen 3', 3, 'graphic_novel'),
  ] },
  { id: 'lumar', name: 'Lumar', works: [work('tress-emerald-sea', 'lumar', 'Trenza del mar Esmeralda', 1)] },
  { id: 'canticle', name: 'Canticle', works: [work('sunlit-man', 'canticle', 'El Hombre Iluminado', 1)] },
];
