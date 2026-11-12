/**
 * Verified source catalogue for the Cosmere expansion.
 *
 * This module stores bibliographic metadata supplied by the project owner.
 * It deliberately does not infer world assignments, chronology, chapter
 * boundaries, summaries, or other editorial facts from a title alone.
 */
export type SourceCatalogueEntry = {
  id: string;
  title: string;
  sourceBundle: 'cosmere.epub' | 'roshar-private-epubs';
  kind: 'novel' | 'novella' | 'graphic-novel-volume' | 'collection';
};

const entries: readonly SourceCatalogueEntry[] = [
  { id: 'mistborn-era1-final-empire', title: 'El Imperio Final', sourceBundle: 'cosmere.epub', kind: 'novel' },
  { id: 'mistborn-era1-well-ascension', title: 'El Pozo de la Ascensión', sourceBundle: 'cosmere.epub', kind: 'novel' },
  { id: 'mistborn-era1-hero-ages', title: 'El Héroe de las Eras', sourceBundle: 'cosmere.epub', kind: 'novel' },
  { id: 'mistborn-era2-alloy-law', title: 'Aleación de ley', sourceBundle: 'cosmere.epub', kind: 'novel' },
  { id: 'mistborn-era2-shadows-self', title: 'Sombras de identidad', sourceBundle: 'cosmere.epub', kind: 'novel' },
  { id: 'mistborn-era2-bands-mourning', title: 'Brazales de Duelo', sourceBundle: 'cosmere.epub', kind: 'novel' },
  { id: 'mistborn-era2-lost-metal', title: 'El metal perdido', sourceBundle: 'cosmere.epub', kind: 'novel' },
  { id: 'warbreaker', title: 'El aliento de los dioses', sourceBundle: 'cosmere.epub', kind: 'novel' },
  { id: 'elantris', title: 'Elantris', sourceBundle: 'cosmere.epub', kind: 'novel' },
  { id: 'white-sand-vol-1', title: 'Arena blanca vol. 1', sourceBundle: 'cosmere.epub', kind: 'graphic-novel-volume' },
  { id: 'white-sand-vol-2', title: 'Arena blanca vol. 2', sourceBundle: 'cosmere.epub', kind: 'graphic-novel-volume' },
  { id: 'white-sand-vol-3', title: 'Arena blanca vol. 3', sourceBundle: 'cosmere.epub', kind: 'graphic-novel-volume' },
  { id: 'tress-emerald-sea', title: 'Trenza del mar Esmeralda', sourceBundle: 'cosmere.epub', kind: 'novel' },
  { id: 'yumi-nightmare-painter', title: 'Yumi y el pintor de pesadillas', sourceBundle: 'cosmere.epub', kind: 'novel' },
  { id: 'sunlit-man', title: 'El Hombre Iluminado', sourceBundle: 'cosmere.epub', kind: 'novel' },
  { id: 'isles-emberdark', title: 'Islas de la ascuaoscura', sourceBundle: 'cosmere.epub', kind: 'novel' },
  { id: 'arcanum-unbounded', title: 'Arcanum ilimitado', sourceBundle: 'cosmere.epub', kind: 'collection' },
  { id: 'roshar-main-five', title: 'Cinco novelas principales de Roshar', sourceBundle: 'roshar-private-epubs', kind: 'novel' },
  { id: 'edgedancer', title: 'Danzante del Filo', sourceBundle: 'roshar-private-epubs', kind: 'novella' },
  { id: 'dawnshard', title: 'Esquirla del amanecer', sourceBundle: 'roshar-private-epubs', kind: 'novella' },
];

export const VERIFIED_SOURCE_CATALOGUE: readonly SourceCatalogueEntry[] = entries;

export type CatalogueValidation =
  | { valid: true }
  | { valid: false; reason: 'invalid-id' | 'duplicate-id' | 'invalid-title' | 'invalid-source-bundle' };

export function validateSourceCatalogue(
  catalogue: readonly SourceCatalogueEntry[],
): CatalogueValidation {
  const seen = new Set<string>();
  for (const entry of catalogue) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) return { valid: false, reason: 'invalid-id' };
    if (seen.has(entry.id)) return { valid: false, reason: 'duplicate-id' };
    seen.add(entry.id);
    if (!entry.title.trim()) return { valid: false, reason: 'invalid-title' };
    if (entry.sourceBundle !== 'cosmere.epub' && entry.sourceBundle !== 'roshar-private-epubs') {
      return { valid: false, reason: 'invalid-source-bundle' };
    }
  }
  return { valid: true };
}
