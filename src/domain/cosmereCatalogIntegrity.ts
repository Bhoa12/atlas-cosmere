import type { CosmereCatalogWork } from "./cosmereSourceCatalog";

export type CatalogIntegrityResult =
  | { status: "valid"; works: readonly CosmereCatalogWork[] }
  | { status: "blocked"; reasons: readonly string[] };

export function resolveCatalogIntegrity(works: readonly CosmereCatalogWork[]): CatalogIntegrityResult {
  const reasons: string[] = [];
  const ids = new Set<string>();
  for (const work of works) {
    if (!work || typeof work.id !== "string" || !work.id.trim() || work.id !== work.id.trim()) {
      reasons.push("invalid-work-id"); continue;
    }
    if (ids.has(work.id)) reasons.push("duplicate-work-id");
    ids.add(work.id);
    if (typeof work.title !== "string" || !work.title.trim() || work.title !== work.title.trim()) reasons.push("invalid-title");
    if (work.worldId !== null && (typeof work.worldId !== "string" || !work.worldId.trim() || work.worldId !== work.worldId.trim())) reasons.push("invalid-world-id");
    if (typeof work.sourceId !== "string" || !work.sourceId.trim()) reasons.push("invalid-source-id");
  }
  return reasons.length ? { status: "blocked", reasons: [...new Set(reasons)] } : { status: "valid", works };
}
