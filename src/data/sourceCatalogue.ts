/**
 * Verified source catalogue boundary for Cosmere expansion.
 *
 * This file intentionally stores only bibliographic metadata supplied as verified.
 * It does not infer worlds, chronology, chapters, summaries, or narrative facts.
 */

export type SourcePackageId = "cosmere-epub" | "roshar-private-epubs";
export type CatalogueWorkId = string;

export interface CatalogueWork {
  id: CatalogueWorkId;
  title: string;
  sourcePackageId: SourcePackageId;
}

export interface SourcePackage {
  id: SourcePackageId;
  availability: "verified-index" | "declared-private";
  note: string;
}

export const SOURCE_PACKAGES: readonly SourcePackage[] = [
  {
    id: "cosmere-epub",
    availability: "verified-index",
    note: "Titles are taken from the user-provided verified index.",
  },
  {
    id: "roshar-private-epubs",
    availability: "declared-private",
    note: "Private EPUBs are declared available; this registry does not claim their internal text was inspected.",
  },
] as const;

/**
 * Works whose titles were explicitly provided from the verified cosmere.epub index.
 * No world relationship is encoded here: that requires separate verified metadata.
 */
export const VERIFIED_CATALOGUE_WORKS: readonly CatalogueWork[] = [
  { id: "el-imperio-final", title: "El Imperio Final", sourcePackageId: "cosmere-epub" },
  { id: "el-pozo-de-la-ascension", title: "El Pozo de la Ascensión", sourcePackageId: "cosmere-epub" },
  { id: "el-heroe-de-las-eras", title: "El Héroe de las Eras", sourcePackageId: "cosmere-epub" },
  { id: "aleacion-de-ley", title: "Aleación de ley", sourcePackageId: "cosmere-epub" },
  { id: "sombras-de-identidad", title: "Sombras de identidad", sourcePackageId: "cosmere-epub" },
  { id: "brazales-de-duelo", title: "Brazales de Duelo", sourcePackageId: "cosmere-epub" },
  { id: "el-metal-perdido", title: "El metal perdido", sourcePackageId: "cosmere-epub" },
  { id: "el-aliento-de-los-dioses", title: "El aliento de los dioses", sourcePackageId: "cosmere-epub" },
  { id: "elantris", title: "Elantris", sourcePackageId: "cosmere-epub" },
  { id: "arena-blanca-vol-1", title: "Arena blanca vol. 1", sourcePackageId: "cosmere-epub" },
  { id: "arena-blanca-vol-2", title: "Arena blanca vol. 2", sourcePackageId: "cosmere-epub" },
  { id: "arena-blanca-vol-3", title: "Arena blanca vol. 3", sourcePackageId: "cosmere-epub" },
  { id: "trenza-del-mar-esmeralda", title: "Trenza del mar Esmeralda", sourcePackageId: "cosmere-epub" },
  { id: "yumi-y-el-pintor-de-pesadillas", title: "Yumi y el pintor de pesadillas", sourcePackageId: "cosmere-epub" },
  { id: "el-hombre-iluminado", title: "El Hombre Iluminado", sourcePackageId: "cosmere-epub" },
  { id: "islas-de-la-ascuaoscura", title: "Islas de la ascuaoscura", sourcePackageId: "cosmere-epub" },
  { id: "arcanum-ilimitado", title: "Arcanum ilimitado", sourcePackageId: "cosmere-epub" },
  { id: "danzante-del-filo", title: "Danzante del Filo", sourcePackageId: "roshar-private-epubs" },
  { id: "esquirla-del-amanecer", title: "Esquirla del amanecer", sourcePackageId: "roshar-private-epubs" },
] as const;

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateCatalogue(
  packages: readonly SourcePackage[],
  works: readonly CatalogueWork[],
): string[] {
  const errors: string[] = [];
  const packageIds = new Set<string>();

  for (const source of packages) {
    if (!ID.test(source.id)) errors.push(`Invalid source package id: ${source.id}`);
    if (packageIds.has(source.id)) errors.push(`Duplicate source package id: ${source.id}`);
    packageIds.add(source.id);
  }

  const workIds = new Set<string>();
  for (const work of works) {
    if (!ID.test(work.id)) errors.push(`Invalid work id: ${work.id}`);
    if (!work.title.trim()) errors.push(`Empty title for work: ${work.id}`);
    if (workIds.has(work.id)) errors.push(`Duplicate work id: ${work.id}`);
    if (!packageIds.has(work.sourcePackageId)) {
      errors.push(`Unknown source package for work: ${work.id}`);
    }
    workIds.add(work.id);
  }

  return errors;
}

export function catalogueIsValid(): boolean {
  return validateCatalogue(SOURCE_PACKAGES, VERIFIED_CATALOGUE_WORKS).length === 0;
}
