export type CatalogueSourceStatus = "verified-index" | "declared-private";

export interface CatalogueSource { id: string; status: CatalogueSourceStatus; }
export interface CatalogueWork { id: string; title: string; sourceId: string; }
export interface CatalogueIntegrityResult { valid: boolean; errors: string[]; }

const validId = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

/** Validates metadata only; it never treats a private source as inspected text. */
export function validateCatalogueIntegrity(
  sources: CatalogueSource[],
  works: CatalogueWork[],
): CatalogueIntegrityResult {
  const errors: string[] = [];
  const sourceIds = new Set<string>();
  for (const source of sources) {
    if (!validId(source.id) || sourceIds.has(source.id)) errors.push(`invalid source: ${source.id}`);
    sourceIds.add(source.id);
  }
  const workIds = new Set<string>();
  for (const work of works) {
    if (!validId(work.id) || workIds.has(work.id)) errors.push(`invalid work: ${work.id}`);
    if (!work.title.trim()) errors.push(`empty title: ${work.id}`);
    if (!sourceIds.has(work.sourceId)) errors.push(`unknown source: ${work.sourceId}`);
    workIds.add(work.id);
  }
  return { valid: errors.length === 0, errors };
}
