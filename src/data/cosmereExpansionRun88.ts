export type SourceKind = "verified-index" | "declared-private" | "editorial-accessible";

export interface Source {
  id: string;
  kind: SourceKind;
  accessible: boolean;
}

export interface World { id: string; name: string; }
export interface Work { id: string; title: string; sourceId: string; }
export interface WorldWorkLink { worldId: string; workId: string; sourceId: string; }
export interface ReadingUnit { id: string; workId: string; position: number; sourceId: string; }
export interface ProgressSnapshot { workId: string; completedUnitIds: string[]; }
export interface SpoilerGate { id: string; workId: string; requiredUnitIds: string[]; }

export const priorityWorlds: World[] = [
  { id: "scadrial", name: "Scadrial" },
  { id: "sel", name: "Sel" },
  { id: "nalthis", name: "Nalthis" },
  { id: "taldain", name: "Taldain" },
  { id: "roshar", name: "Roshar" },
];

/**
 * Validates cross-entity references without inferring editorial facts.
 * A catalog source can identify a work but cannot authorize reading structure.
 */
export function validateExpansion(
  sources: Source[],
  worlds: World[],
  works: Work[],
  links: WorldWorkLink[],
  units: ReadingUnit[],
  gates: SpoilerGate[],
) {
  const sourceIds = new Set(sources.map((s) => s.id));
  const worldIds = new Set(worlds.map((w) => w.id));
  const workIds = new Set(works.map((w) => w.id));
  const errors: string[] = [];

  for (const work of works) if (!sourceIds.has(work.sourceId)) errors.push(`unknown-source:work:${work.id}`);
  for (const link of links) {
    if (!worldIds.has(link.worldId)) errors.push(`unknown-world:link:${link.workId}`);
    if (!workIds.has(link.workId)) errors.push(`unknown-work:link:${link.workId}`);
    if (!sourceIds.has(link.sourceId)) errors.push(`unknown-source:link:${link.workId}`);
  }

  const accessibleEditorial = new Set(
    sources.filter((s) => s.kind === "editorial-accessible" && s.accessible).map((s) => s.id),
  );
  const positions = new Set<string>();
  const unitIds = new Set<string>();

  for (const unit of units) {
    if (!workIds.has(unit.workId)) errors.push(`unknown-work:unit:${unit.id}`);
    if (!accessibleEditorial.has(unit.sourceId)) errors.push(`untrusted-structure:unit:${unit.id}`);
    if (unitIds.has(unit.id)) errors.push(`duplicate-unit:${unit.id}`);
    unitIds.add(unit.id);
    const key = `${unit.workId}:${unit.position}`;
    if (positions.has(key)) errors.push(`duplicate-position:${key}`);
    positions.add(key);
  }

  for (const gate of gates) {
    if (!workIds.has(gate.workId)) errors.push(`unknown-work:gate:${gate.id}`);
    const seen = new Set<string>();
    if (gate.requiredUnitIds.length === 0) errors.push(`empty-gate:${gate.id}`);
    for (const id of gate.requiredUnitIds) {
      if (seen.has(id)) errors.push(`duplicate-requirement:${gate.id}:${id}`);
      seen.add(id);
      const unit = units.find((u) => u.id === id);
      if (!unit || unit.workId !== gate.workId) errors.push(`invalid-requirement:${gate.id}:${id}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function reconcileProgress(snapshot: ProgressSnapshot, units: ReadingUnit[]): string[] {
  const known = units.filter((u) => u.workId === snapshot.workId).sort((a, b) => a.position - b.position);
  const requested = new Set(snapshot.completedUnitIds);
  return known.filter((u) => requested.has(u.id)).map((u) => u.id);
}

export function evaluateSpoilerGate(
  gate: SpoilerGate,
  completedUnitIds: string[],
  units: ReadingUnit[],
): { visible: boolean; pending: string[] } {
  const validation = validateExpansion([], [], [{ id: gate.workId, title: "", sourceId: "" }], [], units, [gate]);
  if (!validation.valid) return { visible: false, pending: [...gate.requiredUnitIds] };
  const completed = new Set(completedUnitIds);
  const pending = gate.requiredUnitIds.filter((id) => !completed.has(id));
  return { visible: pending.length === 0, pending };
}