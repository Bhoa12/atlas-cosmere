export type SourceAccess = "catalog-metadata" | "private-uninspected" | "editorial-accessible";

export interface CatalogSource {
  id: string;
  access: SourceAccess;
}

export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
  sourceId: string;
}

export interface ProgressSnapshot {
  workId: string;
  completedUnitIds: string[];
}

export interface SpoilerGate {
  workId: string;
  requiredUnitIds: string[];
}

export interface VisibilityDecision {
  visible: boolean;
  pendingUnitIds: string[];
  reasons: string[];
}

export function validateReadingUnits(units: ReadingUnit[], sources: CatalogSource[]): string[] {
  const errors: string[] = [];
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const seen = new Set<string>();
  const positions = new Set<string>();

  for (const unit of units) {
    if (!unit.id || seen.has(unit.id)) errors.push(`invalid-or-duplicate-unit:${unit.id}`);
    seen.add(unit.id);
    const source = sourceById.get(unit.sourceId);
    if (!source) errors.push(`unknown-source:${unit.sourceId}`);
    else if (source.access !== "editorial-accessible") errors.push(`unverified-reading-structure:${unit.id}`);
    if (!Number.isFinite(unit.position) || unit.position < 0) errors.push(`invalid-position:${unit.id}`);
    const key = `${unit.workId}:${unit.position}`;
    if (positions.has(key)) errors.push(`ambiguous-position:${key}`);
    positions.add(key);
  }
  return errors;
}

export function reconcileProgress(workId: string, units: ReadingUnit[], snapshots: ProgressSnapshot[]): string[] {
  const valid = new Set(units.filter((unit) => unit.workId === workId).map((unit) => unit.id));
  const completed = new Set<string>();
  for (const snapshot of snapshots) {
    if (snapshot.workId !== workId) continue;
    for (const id of snapshot.completedUnitIds) if (valid.has(id)) completed.add(id);
  }
  return units.filter((unit) => unit.workId === workId && completed.has(unit.id))
    .sort((a, b) => a.position - b.position).map((unit) => unit.id);
}

export function evaluateSpoilerGate(
  gate: SpoilerGate,
  units: ReadingUnit[],
  snapshots: ProgressSnapshot[],
  sources: CatalogSource[],
): VisibilityDecision {
  const reasons = validateReadingUnits(units.filter((unit) => unit.workId === gate.workId), sources);
  if (gate.requiredUnitIds.length === 0) reasons.push("empty-requirements");
  if (new Set(gate.requiredUnitIds).size !== gate.requiredUnitIds.length) reasons.push("duplicate-requirements");
  const known = new Set(units.filter((unit) => unit.workId === gate.workId).map((unit) => unit.id));
  for (const id of gate.requiredUnitIds) if (!known.has(id)) reasons.push(`unknown-required-unit:${id}`);
  const completed = new Set(reconcileProgress(gate.workId, units, snapshots));
  const pendingUnitIds = gate.requiredUnitIds.filter((id) => !completed.has(id));
  return { visible: reasons.length === 0 && pendingUnitIds.length === 0, pendingUnitIds, reasons };
}
