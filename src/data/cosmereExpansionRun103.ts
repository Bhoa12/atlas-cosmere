/**
 * Reusable catalog integrity helpers for Atlas del Cosmere.
 * This module deliberately operates on metadata only.
 */

export type SourceKind = "declared-private" | "verified-index" | "editorial-accessible";

export interface CatalogSource {
  id: string;
  kind: SourceKind;
  accessible: boolean;
}

export interface CatalogWork {
  id: string;
  title: string;
  sourceId: string;
}

export interface CatalogWorld {
  id: string;
  name: string;
}

export interface WorkWorldLink {
  workId: string;
  worldId: string;
  sourceId: string;
}

export interface CatalogIntegrityReport {
  valid: boolean;
  errors: string[];
  orphanWorkIds: string[];
}

const duplicateIds = (ids: string[]) =>
  ids.filter((id, index) => ids.indexOf(id) !== index);

export function auditCatalogIntegrity(input: {
  sources: CatalogSource[];
  works: CatalogWork[];
  worlds: CatalogWorld[];
  links: WorkWorldLink[];
}): CatalogIntegrityReport {
  const errors: string[] = [];
  const sourceIds = new Set(input.sources.map(source => source.id));
  const workIds = new Set(input.works.map(work => work.id));
  const worldIds = new Set(input.worlds.map(world => world.id));

  for (const id of duplicateIds(input.sources.map(source => source.id))) {
    errors.push(`duplicate-source:${id}`);
  }
  for (const id of duplicateIds(input.works.map(work => work.id))) {
    errors.push(`duplicate-work:${id}`);
  }
  for (const id of duplicateIds(input.worlds.map(world => world.id))) {
    errors.push(`duplicate-world:${id}`);
  }

  input.works.forEach(work => {
    if (!work.title.trim()) errors.push(`empty-title:${work.id}`);
    if (!sourceIds.has(work.sourceId)) errors.push(`unknown-work-source:${work.id}`);
  });

  const seenLinks = new Set<string>();
  input.links.forEach(link => {
    const key = `${link.workId}:${link.worldId}`;
    if (seenLinks.has(key)) errors.push(`duplicate-link:${key}`);
    seenLinks.add(key);
    if (!workIds.has(link.workId)) errors.push(`unknown-link-work:${link.workId}`);
    if (!worldIds.has(link.worldId)) errors.push(`unknown-link-world:${link.worldId}`);
    if (!sourceIds.has(link.sourceId)) errors.push(`unknown-link-source:${key}`);
  });

  const linkedWorks = new Set(input.links.map(link => link.workId));
  const orphanWorkIds = input.works
    .filter(work => !linkedWorks.has(work.id))
    .map(work => work.id);

  return { valid: errors.length === 0, errors, orphanWorkIds };
}

export function isSourceAllowedForClaim(
  source: CatalogSource,
  claim: "metadata" | "reading-structure" | "original-summary"
): boolean {
  if (claim === "metadata") return source.kind !== "declared-private" || !!source.id;
  return source.kind === "editorial-accessible" && source.accessible;
}
