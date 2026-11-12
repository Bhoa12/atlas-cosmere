export type SourceStatus = "verified-index" | "declared-private";

export interface SourceRecord {
  id: string;
  label: string;
  status: SourceStatus;
}

export interface CataloguedWork {
  id: string;
  title: string;
  sourceId: string;
}

export interface WorldRecord {
  id: string;
  label: string;
}

export interface WorkWorldRelation {
  workId: string;
  worldId: string;
  sourceId: string;
}

/**
 * Structural catalogue boundary for the Cosmere atlas.
 * It stores only explicit metadata and never infers editorial facts.
 */
export function validateCatalogue(
  sources: SourceRecord[],
  worlds: WorldRecord[],
  works: CataloguedWork[],
  relations: WorkWorldRelation[],
): string[] {
  const errors: string[] = [];
  const ids = (items: { id: string }[]) => new Set(items.map((item) => item.id));
  if (ids(sources).size !== sources.length) errors.push("duplicate-source-id");
  if (ids(worlds).size !== worlds.length) errors.push("duplicate-world-id");
  if (ids(works).size !== works.length) errors.push("duplicate-work-id");

  const sourceIds = ids(sources);
  const worldIds = ids(worlds);
  const workIds = ids(works);
  const relationKeys = new Set<string>();

  for (const work of works) {
    if (!work.title.trim()) errors.push(`empty-title:${work.id}`);
    if (!sourceIds.has(work.sourceId)) errors.push(`unknown-source:${work.id}`);
  }

  for (const relation of relations) {
    const key = `${relation.workId}:${relation.worldId}`;
    if (relationKeys.has(key)) errors.push(`duplicate-relation:${key}`);
    relationKeys.add(key);
    if (!workIds.has(relation.workId)) errors.push(`unknown-work:${relation.workId}`);
    if (!worldIds.has(relation.worldId)) errors.push(`unknown-world:${relation.worldId}`);
    if (!sourceIds.has(relation.sourceId)) errors.push(`unknown-relation-source:${key}`);
  }
  return errors;
}

export function resolveWorldForWork(
  workId: string,
  relations: WorkWorldRelation[],
): string | null {
  const matches = relations.filter((relation) => relation.workId === workId);
  return matches.length === 1 ? matches[0].worldId : null;
}
