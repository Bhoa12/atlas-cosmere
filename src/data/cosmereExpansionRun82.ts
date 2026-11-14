/**
 * Run 82: verified bibliography manifest and provenance-aware catalog views.
 * Contains metadata only; no protected editorial text or inferred world assignments.
 */

export interface Source { id: string; kind: "verified-index" | "declared-private" | "editorial-accessible"; accessible: boolean; }
export interface World { id: string; name: string; }
export interface Work { id: string; title: string; sourceId: string; }
export interface CatalogIssue { code: string; id: string; }

export const PRIORITY_WORLDS: readonly World[] = [
  { id: "scadrial", name: "Scadrial" },
  { id: "sel", name: "Sel" },
  { id: "nalthis", name: "Nalthis" },
  { id: "taldain", name: "Taldain" },
  { id: "roshar", name: "Roshar" },
];

/** Titles supplied by the verified index of the user's private cosmere.epub. */
export const VERIFIED_INDEX_WORKS: readonly Work[] = [
  ["imperio-final", "El Imperio Final"],
  ["pozo-ascension", "El Pozo de la Ascensión"],
  ["heroe-eras", "El Héroe de las Eras"],
  ["aleacion-ley", "Aleación de ley"],
  ["sombras-identidad", "Sombras de identidad"],
  ["brazales-duelo", "Brazales de Duelo"],
  ["metal-perdido", "El metal perdido"],
  ["aliento-dioses", "El aliento de los dioses"],
  ["elantris", "Elantris"],
  ["arena-blanca-1", "Arena blanca vol. 1"],
  ["arena-blanca-2", "Arena blanca vol. 2"],
  ["arena-blanca-3", "Arena blanca vol. 3"],
  ["trenza-mar-esmeralda", "Trenza del mar Esmeralda"],
  ["yumi-pintor-pesadillas", "Yumi y el pintor de pesadillas"],
  ["hombre-iluminado", "El Hombre Iluminado"],
  ["islas-ascuaoscura", "Islas de la ascuaoscura"],
  ["arcanum-ilimitado", "Arcanum ilimitado"],
].map(([id, title]) => ({ id, title, sourceId: "cosmere-index" }));

export function validateBibliography(sources: readonly Source[], works: readonly Work[]): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const sourceIds = new Set(sources.map((source) => source.id));
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  for (const work of works) {
    if (!work.id || seenIds.has(work.id)) issues.push({ code: "duplicate-or-empty-work-id", id: work.id });
    if (!work.title || seenTitles.has(work.title)) issues.push({ code: "duplicate-or-empty-title", id: work.id });
    if (!sourceIds.has(work.sourceId)) issues.push({ code: "unknown-work-source", id: work.id });
    seenIds.add(work.id);
    seenTitles.add(work.title);
  }
  return issues;
}

/**
 * Returns catalog metadata only. This deliberately does not infer world, chronology,
 * reading units, or narrative facts from a title.
 */
export function worksFromSource(sourceId: string, works: readonly Work[]): Work[] {
  return works.filter((work) => work.sourceId === sourceId);
}

export interface ContentDescriptor {
  id: string;
  workId: string;
  sourceId: string;
  kind: "metadata" | "original-summary";
}

/** Editorial descriptors require an actually accessible editorial source. */
export function canPublishDescriptor(
  descriptor: ContentDescriptor,
  sources: readonly Source[],
  works: readonly Work[],
): boolean {
  const source = sources.find((candidate) => candidate.id === descriptor.sourceId);
  const workExists = works.some((work) => work.id === descriptor.workId);
  if (!source || !workExists) return false;
  if (descriptor.kind === "metadata") return true;
  return source.kind === "editorial-accessible" && source.accessible;
}
