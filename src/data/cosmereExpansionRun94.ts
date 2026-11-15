/**
 * Catalog-first expansion helpers.
 *
 * Records bibliographic metadata without inferring narrative facts, chapter
 * structure, chronology, or world assignments.
 */

export type CatalogSourceKind = "verified-index" | "declared-private";

export interface CatalogSource {
  id: string;
  kind: CatalogSourceKind;
}

export interface CatalogWork {
  id: string;
  title: string;
  sourceId: string;
}

export interface CatalogAudit {
  validWorkIds: string[];
  errors: string[];
}

const hasUnique = (values: string[]) => new Set(values).size === values.length;

export function auditCatalogWorks(
  sources: CatalogSource[],
  works: CatalogWork[],
): CatalogAudit {
  const errors: string[] = [];
  const sourceIds = new Set(sources.map(source => source.id));
  const workIds = works.map(work => work.id);

  if (!hasUnique(sources.map(source => source.id))) errors.push("duplicate-source-id");
  if (!hasUnique(workIds)) {
    errors.push("duplicate-work-id");
    return { validWorkIds: [], errors };
  }

  const validWorkIds = works
    .filter(work => {
      const valid = work.title.trim().length > 0 && sourceIds.has(work.sourceId);
      if (!valid) errors.push(`invalid-work:${work.id}`);
      return valid;
    })
    .map(work => work.id);

  return { validWorkIds, errors };
}

/**
 * Catalog seed derived only from the user's verified index. These are titles,
 * not assertions about internal structure or world membership.
 */
export const verifiedIndexCatalog: CatalogWork[] = [
  "El Imperio Final",
  "El Pozo de la Ascensión",
  "El Héroe de las Eras",
  "Aleación de ley",
  "Sombras de identidad",
  "Brazales de Duelo",
  "El metal perdido",
  "El aliento de los dioses",
  "Elantris",
  "Arena blanca vol. 1",
  "Arena blanca vol. 2",
  "Arena blanca vol. 3",
  "Trenza del mar Esmeralda",
  "Yumi y el pintor de pesadillas",
  "El Hombre Iluminado",
  "Islas de la ascuaoscura",
  "Arcanum ilimitado",
].map((title, index) => ({
  id: `verified-index-${index + 1}`,
  title,
  sourceId: "cosmere-verified-index",
}));

export const declaredRosharCatalogSource: CatalogSource = {
  id: "roshar-private-epubs",
  kind: "declared-private",
};
