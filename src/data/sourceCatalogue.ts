export type SourcePackageId = "cosmere-epub" | "roshar-private-epubs";

export interface SourceWork {
  id: string;
  title: string;
  sourcePackage: SourcePackageId;
}

/**
 * Bibliographic metadata explicitly verified by the project owner.
 * This is not a statement about world membership, chronology, reading order,
 * internal chapter structure, or narrative content.
 */
export const SOURCE_CATALOGUE: readonly SourceWork[] = [
  { id: "el-imperio-final", title: "El Imperio Final", sourcePackage: "cosmere-epub" },
  { id: "el-pozo-de-la-ascension", title: "El Pozo de la Ascensión", sourcePackage: "cosmere-epub" },
  { id: "el-heroe-de-las-eras", title: "El Héroe de las Eras", sourcePackage: "cosmere-epub" },
  { id: "aleacion-de-ley", title: "Aleación de ley", sourcePackage: "cosmere-epub" },
  { id: "sombras-de-identidad", title: "Sombras de identidad", sourcePackage: "cosmere-epub" },
  { id: "brazales-de-duelo", title: "Brazales de Duelo", sourcePackage: "cosmere-epub" },
  { id: "el-metal-perdido", title: "El metal perdido", sourcePackage: "cosmere-epub" },
  { id: "el-aliento-de-los-dioses", title: "El aliento de los dioses", sourcePackage: "cosmere-epub" },
  { id: "elantris", title: "Elantris", sourcePackage: "cosmere-epub" },
  { id: "arena-blanca-vol-1", title: "Arena blanca vol. 1", sourcePackage: "cosmere-epub" },
  { id: "arena-blanca-vol-2", title: "Arena blanca vol. 2", sourcePackage: "cosmere-epub" },
  { id: "arena-blanca-vol-3", title: "Arena blanca vol. 3", sourcePackage: "cosmere-epub" },
  { id: "trenza-del-mar-esmeralda", title: "Trenza del mar Esmeralda", sourcePackage: "cosmere-epub" },
  { id: "yumi-y-el-pintor-de-pesadillas", title: "Yumi y el pintor de pesadillas", sourcePackage: "cosmere-epub" },
  { id: "el-hombre-iluminado", title: "El Hombre Iluminado", sourcePackage: "cosmere-epub" },
  { id: "islas-de-la-ascuaoscura", title: "Islas de la ascuaoscura", sourcePackage: "cosmere-epub" },
  { id: "arcanum-ilimitado", title: "Arcanum ilimitado", sourcePackage: "cosmere-epub" },
  { id: "danzante-del-filo", title: "Danzante del Filo", sourcePackage: "roshar-private-epubs" },
  { id: "esquirla-del-amanecer", title: "Esquirla del amanecer", sourcePackage: "roshar-private-epubs" },
] as const;

export interface CatalogueValidation {
  valid: boolean;
  errors: string[];
}

export function validateSourceCatalogue(entries: readonly SourceWork[]): CatalogueValidation {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) errors.push(`invalid id: ${entry.id}`);
    if (ids.has(entry.id)) errors.push(`duplicate id: ${entry.id}`);
    ids.add(entry.id);
    if (!entry.title.trim()) errors.push(`empty title: ${entry.id}`);
    if (entry.sourcePackage !== "cosmere-epub" && entry.sourcePackage !== "roshar-private-epubs") {
      errors.push(`unknown source package: ${entry.id}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
