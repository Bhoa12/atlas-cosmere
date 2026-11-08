import { CatalogWorldLink, hasValidWorldCatalogIndex } from "./worldCatalogIndex";

export interface WorldWorkScope {
  status: "valid" | "blocked";
  outOfScopeLinks: CatalogWorldLink[];
}

/**
 * Validates that explicit work → world links stay inside the declared catalog
 * scope. This is structural only and never infers a world or work from names.
 */
export function resolveWorldWorkScope(
  declaredWorldIds: string[],
  declaredWorkIds: string[],
  links: CatalogWorldLink[],
): WorldWorkScope {
  if (
    declaredWorldIds.length === 0 ||
    declaredWorkIds.length === 0 ||
    new Set(declaredWorldIds).size !== declaredWorldIds.length ||
    new Set(declaredWorkIds).size !== declaredWorkIds.length ||
    declaredWorldIds.some((id) => typeof id !== "string" || !id.trim()) ||
    declaredWorkIds.some((id) => typeof id !== "string" || !id.trim()) ||
    !hasValidWorldCatalogIndex(links)
  ) {
    return { status: "blocked", outOfScopeLinks: [] };
  }

  const worlds = new Set(declaredWorldIds);
  const works = new Set(declaredWorkIds);
  const outOfScopeLinks = links.filter(
    (link) => !worlds.has(link.worldId) || !works.has(link.workId),
  );

  return {
    status: outOfScopeLinks.length === 0 ? "valid" : "blocked",
    outOfScopeLinks,
  };
}