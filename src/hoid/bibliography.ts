/**
 * Metadata-only bibliography for Hoid IA.
 *
 * This list identifies private source works supplied by the user. It must never
 * contain EPUB text, extracted passages, or unverified claims about a work.
 * Knowledge entries may cite sourceId + chapter only after editorial verification.
 */
export type HoidSourceWork = {
  id: string;
  title: string;
  sourceGroup: "cosmere.epub" | "roshar-epubs";
};

const RAW_HOID_SOURCE_BIBLIOGRAPHY: readonly HoidSourceWork[] = [
  { id: "tfe", title: "El Imperio Final", sourceGroup: "cosmere.epub" },
  { id: "woa", title: "El Pozo de la Ascensión", sourceGroup: "cosmere.epub" },
  { id: "hoa", title: "El Héroe de las Eras", sourceGroup: "cosmere.epub" },
  { id: "aol", title: "Aleación de ley", sourceGroup: "cosmere.epub" },
  { id: "sos", title: "Sombras de identidad", sourceGroup: "cosmere.epub" },
  { id: "bom", title: "Brazales de Duelo", sourceGroup: "cosmere.epub" },
  { id: "tlm", title: "El metal perdido", sourceGroup: "cosmere.epub" },
  { id: "warbreaker", title: "El aliento de los dioses", sourceGroup: "cosmere.epub" },
  { id: "elantris", title: "Elantris", sourceGroup: "cosmere.epub" },
  { id: "white-sand-1", title: "Arena blanca vol. 1", sourceGroup: "cosmere.epub" },
  { id: "white-sand-2", title: "Arena blanca vol. 2", sourceGroup: "cosmere.epub" },
  { id: "white-sand-3", title: "Arena blanca vol. 3", sourceGroup: "cosmere.epub" },
  { id: "tress", title: "Trenza del mar Esmeralda", sourceGroup: "cosmere.epub" },
  { id: "yumi", title: "Yumi y el pintor de pesadillas", sourceGroup: "cosmere.epub" },
  { id: "sunlit", title: "El Hombre Iluminado", sourceGroup: "cosmere.epub" },
  { id: "isles", title: "Islas de la ascuaoscura", sourceGroup: "cosmere.epub" },
  { id: "arcanum", title: "Arcanum ilimitado", sourceGroup: "cosmere.epub" },
  { id: "twok", title: "El Camino de los Reyes", sourceGroup: "roshar-epubs" },
  { id: "wor", title: "Palabras radiantes", sourceGroup: "roshar-epubs" },
  { id: "ob", title: "Juramentada", sourceGroup: "roshar-epubs" },
  { id: "row", title: "El Ritmo de la Guerra", sourceGroup: "roshar-epubs" },
  { id: "sawt", title: "Viento y Verdad", sourceGroup: "roshar-epubs" },
  { id: "edgedancer", title: "Danzante del Filo", sourceGroup: "roshar-epubs" },
  { id: "dawnshard", title: "Esquirla del amanecer", sourceGroup: "roshar-epubs" },
];

const HOID_SOURCE_GROUPS = new Set<HoidSourceWork["sourceGroup"]>([
  "cosmere.epub",
  "roshar-epubs",
]);

/**
 * Validate the metadata identity boundary before it is used for reading
 * progress or provenance. Invalid bibliography metadata must fail closed
 * instead of silently creating a second identity namespace.
 */
export function validateHoidSourceBibliography(
  entries: readonly HoidSourceWork[],
): readonly HoidSourceWork[] {
  const ids = new Set<string>();
  const validated: HoidSourceWork[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || typeof entry.title !== "string") {
      throw new Error("Invalid Hoid bibliography entry");
    }

    const id = entry.id.trim();
    const title = entry.title.trim();
    if (id.length === 0 || title.length === 0 || !HOID_SOURCE_GROUPS.has(entry.sourceGroup)) {
      throw new Error("Incomplete or unknown Hoid bibliography metadata");
    }
    if (ids.has(id)) {
      throw new Error(`Duplicate Hoid bibliography identifier: ${id}`);
    }

    ids.add(id);
    validated.push(Object.freeze({ id, title, sourceGroup: entry.sourceGroup }));
  }

  return Object.freeze(validated);
}

/** Canonical, validated, metadata-only registry for all supplied sources. */
export const HOID_SOURCE_BIBLIOGRAPHY = validateHoidSourceBibliography(
  RAW_HOID_SOURCE_BIBLIOGRAPHY,
);

const HOID_SOURCE_IDS = new Set(HOID_SOURCE_BIBLIOGRAPHY.map(source => source.id));

export function isKnownHoidSource(sourceId: string): boolean {
  return typeof sourceId === "string" && HOID_SOURCE_IDS.has(sourceId.trim());
}
