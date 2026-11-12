/**
 * Verified source catalogue boundary.
 * Stores only bibliography supplied to Atlas; no narrative text or inferred world mapping.
 */
export type SourceId = "cosmere-epub" | "roshar-private-epubs";

export interface SourceWork {
  readonly id: string;
  readonly title: string;
  readonly sourceId: SourceId;
}

export interface SourceCatalogue {
  readonly works: readonly SourceWork[];
}

const cosmereTitles = [
  "El Imperio Final","El Pozo de la Ascensión","El Héroe de las Eras",
  "Aleación de ley","Sombras de identidad","Brazales de Duelo","El metal perdido",
  "El aliento de los dioses","Elantris","Arena blanca vol. 1","Arena blanca vol. 2",
  "Arena blanca vol. 3","Trenza del mar Esmeralda","Yumi y el pintor de pesadillas",
  "El Hombre Iluminado","Islas de la ascuaoscura","Arcanum ilimitado"
] as const;

const rosharTitles = [
  "El Camino de los Reyes","Palabras Radiantes","Juramentada","El Ritmo de la Guerra",
  "Viento y Verdad","Danzante del Filo","Esquirla del amanecer"
] as const;

function slug(title: string): string {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const verifiedSourceCatalogue: SourceCatalogue = {
  works: [
    ...cosmereTitles.map((title) => ({ id: `work-${slug(title)}`, title, sourceId: "cosmere-epub" as const })),
    ...rosharTitles.map((title) => ({ id: `work-${slug(title)}`, title, sourceId: "roshar-private-epubs" as const })),
  ],
};

export type CatalogueValidation =
  | { ok: true }
  | { ok: false; reason: "duplicate-work-id" | "empty-title" | "unknown-source" };

export function validateSourceCatalogue(catalogue: SourceCatalogue): CatalogueValidation {
  const ids = new Set<string>();
  for (const work of catalogue.works) {
    if (!work.title.trim()) return { ok: false, reason: "empty-title" };
    if (work.sourceId !== "cosmere-epub" && work.sourceId !== "roshar-private-epubs")
      return { ok: false, reason: "unknown-source" };
    if (ids.has(work.id)) return { ok: false, reason: "duplicate-work-id" };
    ids.add(work.id);
  }
  return { ok: true };
}
