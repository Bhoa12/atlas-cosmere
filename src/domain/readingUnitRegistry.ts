export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
  label?: string;
}

export interface ReadingUnitRegistry {
  status: "valid" | "blocked";
  units: readonly ReadingUnit[];
}

/**
 * Validates an editorial-neutral reading-unit registry. Units are only
 * structural identifiers: this module never assumes that a position means a
 * chapter, part, scene, or any other editorial subdivision.
 */
export function resolveReadingUnitRegistry(
  declaredWorkIds: readonly string[],
  units: readonly ReadingUnit[],
): ReadingUnitRegistry {
  const works = declaredWorkIds.map((id) => typeof id === "string" ? id.trim() : "");
  if (works.length === 0 || works.some((id) => !id) || new Set(works).size !== works.length) {
    return { status: "blocked", units: [] };
  }
  const declared = new Set(works);
  const ids = new Set<string>();
  const positions = new Set<string>();
  const normalized: ReadingUnit[] = [];
  for (const unit of units) {
    const id = typeof unit.id === "string" ? unit.id.trim() : "";
    const workId = typeof unit.workId === "string" ? unit.workId.trim() : "";
    const position = unit.position;
    if (!id || !workId || !declared.has(workId) || !Number.isInteger(position) || position < 0) return { status: "blocked", units: [] };
    const positionKey = workId + ":" + position;
    if (ids.has(id) || positions.has(positionKey)) return { status: "blocked", units: [] };
    ids.add(id); positions.add(positionKey);
    normalized.push({ id, workId, position, ...(typeof unit.label === "string" && unit.label.trim() ? { label: unit.label.trim() } : {}) });
  }
  return { status: "valid", units: normalized.sort((a,b) => a.workId.localeCompare(b.workId) || a.position - b.position || a.id.localeCompare(b.id)) };
}

export function hasReadingUnit(
  declaredWorkIds: readonly string[], units: readonly ReadingUnit[], unitId: string,
): boolean {
  if (typeof unitId !== "string" || !unitId.trim()) return false;
  const registry = resolveReadingUnitRegistry(declaredWorkIds, units);
  return registry.status === "valid" && registry.units.some((unit) => unit.id === unitId.trim());
}
