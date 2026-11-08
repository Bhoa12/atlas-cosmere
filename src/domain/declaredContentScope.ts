export type DeclaredContentScopeEntry = {
  contentId: string;
  workId: string;
  worldId: string;
};

export type DeclaredContentScopeResult = {
  status: "valid" | "blocked";
  entries: DeclaredContentScopeEntry[];
  duplicateContentIds: string[];
  unknownWorkIds: string[];
  unknownWorldIds: string[];
};

export function resolveDeclaredContentScope(
  entries: DeclaredContentScopeEntry[],
  declaredWorkIds: string[],
  declaredWorldIds: string[],
): DeclaredContentScopeResult {
  const workSet = new Set(declaredWorkIds);
  const worldSet = new Set(declaredWorldIds);
  const duplicateContentIds = entries
    .map((entry) => entry.contentId)
    .filter((id, index, all) => all.indexOf(id) !== index)
    .filter((id, index, all) => all.indexOf(id) === index);
  const unknownWorkIds = [...new Set(entries.filter((entry) => !workSet.has(entry.workId)).map((entry) => entry.workId))];
  const unknownWorldIds = [...new Set(entries.filter((entry) => !worldSet.has(entry.worldId)).map((entry) => entry.worldId))];
  const malformed = entries.some((entry) => !entry.contentId || !entry.workId || !entry.worldId);
  const duplicateDeclarations =
    new Set(declaredWorkIds).size !== declaredWorkIds.length ||
    new Set(declaredWorldIds).size !== declaredWorldIds.length ||
    declaredWorkIds.length === 0 ||
    declaredWorldIds.length === 0;

  const blocked = malformed || duplicateDeclarations || duplicateContentIds.length > 0 || unknownWorkIds.length > 0 || unknownWorldIds.length > 0;

  return {
    status: blocked ? "blocked" : "valid",
    entries: blocked ? [] : [...entries],
    duplicateContentIds,
    unknownWorkIds,
    unknownWorldIds,
  };
}
