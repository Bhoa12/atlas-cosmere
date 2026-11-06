/**
 * Bibliographic source manifest for the private Cosmere EPUB collection.
 *
 * This file records only titles whose presence in the supplied source index has
 * been verified. It deliberately does not assert chapter structure, world
 * assignment, chronology, or narrative facts.
 */
export type SourceAvailability = "declared";

export interface BibliographicSourceEntry {
  sourceId: string;
  title: string;
  availability: SourceAvailability;
}

export const privateCosmereSourceCatalog: readonly BibliographicSourceEntry[] = [
  { sourceId: "src-mistborn-1", title: "El Imperio Final", availability: "declared" },
  { sourceId: "src-mistborn-2", title: "El Pozo de la Ascensión", availability: "declared" },
  { sourceId: "src-mistborn-3", title: "El Héroe de las Eras", availability: "declared" },
  { sourceId: "src-wax-wayne-1", title: "Aleación de ley", availability: "declared" },
  { sourceId: "src-wax-wayne-2", title: "Sombras de identidad", availability: "declared" },
  { sourceId: "src-wax-wayne-3", title: "Brazales de Duelo", availability: "declared" },
  { sourceId: "src-wax-wayne-4", title: "El metal perdido", availability: "declared" },
  { sourceId: "src-warbreaker", title: "El aliento de los dioses", availability: "declared" },
  { sourceId: "src-elantris", title: "Elantris", availability: "declared" },
  { sourceId: "src-white-sand-1", title: "Arena blanca vol. 1", availability: "declared" },
  { sourceId: "src-white-sand-2", title: "Arena blanca vol. 2", availability: "declared" },
  { sourceId: "src-white-sand-3", title: "Arena blanca vol. 3", availability: "declared" },
  { sourceId: "src-tress", title: "Trenza del mar Esmeralda", availability: "declared" },
  { sourceId: "src-yumi", title: "Yumi y el pintor de pesadillas", availability: "declared" },
  { sourceId: "src-sunlit", title: "El Hombre Iluminado", availability: "declared" },
  { sourceId: "src-sunlit-archipelago", title: "Islas de la ascuaoscura", availability: "declared" },
  { sourceId: "src-arcanum", title: "Arcanum ilimitado", availability: "declared" },
] as const;

/** Returns only structural manifest errors; it never upgrades a source to verified. */
export function validateBibliographicSourceManifest(
  sources: readonly BibliographicSourceEntry[],
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const titles = new Set<string>();

  for (const source of sources) {
    if (!source.sourceId.trim()) errors.push("Empty source id");
    if (!source.title.trim()) errors.push(`Empty source title for ${source.sourceId || "<empty>"}`);
    if (ids.has(source.sourceId)) errors.push(`Duplicate source id: ${source.sourceId}`);
    if (titles.has(source.title)) errors.push(`Duplicate source title: ${source.title}`);
    ids.add(source.sourceId);
    titles.add(source.title);
  }
  return errors;
}
