/**
 * Editorially neutral relationship registry.
 * A relation is accepted only when explicitly supplied with a verified source.
 */
export type RelationKind = "work-to-world";

export interface VerifiedRelation {
  id: string;
  kind: RelationKind;
  workId: string;
  worldId: string;
  sourceId: string;
}

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateVerifiedRelations(
  relations: readonly VerifiedRelation[],
  knownWorkIds: ReadonlySet<string>,
  knownWorldIds: ReadonlySet<string>,
  knownSourceIds: ReadonlySet<string>,
): void {
  const seen = new Set<string>();
  for (const relation of relations) {
    if (!idPattern.test(relation.id) || !idPattern.test(relation.workId) ||
        !idPattern.test(relation.worldId) || !idPattern.test(relation.sourceId)) {
      throw new Error("Invalid relation identifier");
    }
    if (seen.has(relation.id)) throw new Error("Duplicate relation identifier");
    if (!knownWorkIds.has(relation.workId)) throw new Error("Unknown work");
    if (!knownWorldIds.has(relation.worldId)) throw new Error("Unknown world");
    if (!knownSourceIds.has(relation.sourceId)) throw new Error("Unknown source");
    seen.add(relation.id);
  }
}

/**
 * Returns only explicitly registered relations. No inference from titles is performed.
 */
export function worldsForWork(
  workId: string,
  relations: readonly VerifiedRelation[],
): readonly string[] {
  if (!idPattern.test(workId)) return [];
  return relations
    .filter((relation) => relation.workId === workId)
    .map((relation) => relation.worldId);
}
