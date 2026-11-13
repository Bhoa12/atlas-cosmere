export type SourceKind = "verified-index" | "declared-private";

export interface SourceRecord {
  id: string;
  label: string;
  kind: SourceKind;
}

export interface WorldRecord {
  id: string;
  label: string;
}

export interface WorkRecord {
  id: string;
  title: string;
  sourceId: string;
  worldId?: string;
}

export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
  label: string;
}

export interface ReadingProgress {
  workId: string;
  completedUnitIds: string[];
}

export interface SpoilerGate {
  workId: string;
  requiredUnitIds: string[];
}

const unique = (values: string[]) => new Set(values).size === values.length;

export function validateExpansion(input: {
  sources: SourceRecord[];
  worlds: WorldRecord[];
  works: WorkRecord[];
  units: ReadingUnit[];
}): string[] {
  const errors: string[] = [];
  const validId = (id: string) => /^[a-z0-9-]+$/.test(id);
  for (const group of [input.sources, input.worlds, input.works, input.units]) {
    const ids = group.map((item) => item.id);
    if (!unique(ids)) errors.push("duplicate-id");
    if (ids.some((id) => !validId(id))) errors.push("invalid-id");
  }
  const sourceIds = new Set(input.sources.map((source) => source.id));
  const worldIds = new Set(input.worlds.map((world) => world.id));
  const workIds = new Set(input.works.map((work) => work.id));
  for (const work of input.works) {
    if (!work.title.trim()) errors.push("empty-work-title");
    if (!sourceIds.has(work.sourceId)) errors.push("unknown-source");
    if (work.worldId && !worldIds.has(work.worldId)) errors.push("unknown-world");
  }
  const positions = new Set<string>();
  for (const unit of input.units) {
    if (!workIds.has(unit.workId)) errors.push("unknown-work");
    if (!Number.isInteger(unit.position) || unit.position < 1) errors.push("invalid-position");
    const key = `${unit.workId}:${unit.position}`;
    if (positions.has(key)) errors.push("duplicate-position");
    positions.add(key);
  }
  return [...new Set(errors)];
}

export function canReveal(
  gate: SpoilerGate,
  progress: ReadingProgress,
  units: ReadingUnit[],
): boolean {
  if (gate.workId !== progress.workId) return false;
  if (gate.requiredUnitIds.length === 0 || !unique(gate.requiredUnitIds)) return false;
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const completed = new Set(progress.completedUnitIds);
  return gate.requiredUnitIds.every((id) => {
    const unit = byId.get(id);
    return Boolean(unit && unit.workId === gate.workId && completed.has(id));
  });
}
