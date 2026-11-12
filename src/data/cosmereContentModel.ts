export type CanonicalId = string;

export type WorldRecord = {
  id: CanonicalId;
  name: string;
};

export type WorkRecord = {
  id: CanonicalId;
  title: string;
  sourceId: CanonicalId;
  worldId?: CanonicalId;
};

export type ReadingUnitRecord = {
  id: CanonicalId;
  workId: CanonicalId;
  position: number;
};

export type ReadingProgress = {
  workId: CanonicalId;
  completedUnitIds: CanonicalId[];
};

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isCanonicalId(value: string): boolean {
  return ID.test(value);
}

export function validateContentModel(
  worlds: WorldRecord[],
  works: WorkRecord[],
  units: ReadingUnitRecord[],
): void {
  const ids = new Set<string>();
  for (const world of worlds) {
    if (!isCanonicalId(world.id) || !world.name.trim() || ids.has(world.id)) {
      throw new Error("Invalid world registry");
    }
    ids.add(world.id);
  }
  const workIds = new Set<string>();
  for (const work of works) {
    if (!isCanonicalId(work.id) || !isCanonicalId(work.sourceId) || !work.title.trim() || workIds.has(work.id)) {
      throw new Error("Invalid work registry");
    }
    if (work.worldId && !ids.has(work.worldId)) {
      throw new Error("Unknown world reference");
    }
    workIds.add(work.id);
  }
  const unitIds = new Set<string>();
  const positions = new Set<string>();
  for (const unit of units) {
    if (!isCanonicalId(unit.id) || !workIds.has(unit.workId) || !Number.isInteger(unit.position) || unit.position < 1 || unitIds.has(unit.id)) {
      throw new Error("Invalid reading unit registry");
    }
    const positionKey = unit.workId + ":" + unit.position;
    if (positions.has(positionKey)) throw new Error("Duplicate reading unit position");
    unitIds.add(unit.id);
    positions.add(positionKey);
  }
}

export function resolveVisibility(
  requiredUnitIds: CanonicalId[],
  progress: ReadingProgress,
): "visible" | "locked" {
  if (!isCanonicalId(progress.workId)) return "locked";
  if (new Set(progress.completedUnitIds).size !== progress.completedUnitIds.length) return "locked";
  if (requiredUnitIds.some((id) => !isCanonicalId(id))) return "locked";
  return requiredUnitIds.every((id) => progress.completedUnitIds.includes(id)) ? "visible" : "locked";
}
