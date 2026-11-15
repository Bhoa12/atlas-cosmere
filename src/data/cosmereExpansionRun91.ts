export type SourceKind = "verified-index" | "declared-private" | "editorial-accessible";

export interface SourceRecord { id: string; kind: SourceKind; accessible: boolean }
export interface CatalogWork { id: string; title: string; sourceId: string }
export interface ReadingUnit { id: string; workId: string; position: number; sourceId: string }
export interface ProgressSnapshot { workId: string; completedUnitIds: string[] }
export interface SpoilerGate { id: string; workId: string; requiredUnitIds: string[] }

export interface ExpansionManifest {
  sources: SourceRecord[];
  works: CatalogWork[];
  units: ReadingUnit[];
  gates: SpoilerGate[];
}

export interface ManifestIssue {
  code:
    | "unknown-source"
    | "duplicate-work"
    | "invalid-reading-source"
    | "duplicate-unit"
    | "duplicate-position"
    | "invalid-gate-work"
    | "invalid-gate-requirements";
  entityId: string;
}

const sourceMap = (sources: SourceRecord[]) => new Map(sources.map((source) => [source.id, source]));
const unique = (values: string[]) => new Set(values).size === values.length;

export function auditExpansionManifest(manifest: ExpansionManifest): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  const sources = sourceMap(manifest.sources);
  const works = new Set<string>();

  for (const work of manifest.works) {
    if (works.has(work.id)) issues.push({ code: "duplicate-work", entityId: work.id });
    works.add(work.id);
    if (!sources.has(work.sourceId)) issues.push({ code: "unknown-source", entityId: work.id });
  }

  const unitsByWork = new Map<string, ReadingUnit[]>();
  const seenUnitIds = new Set<string>();
  for (const unit of manifest.units) {
    const source = sources.get(unit.sourceId);
    if (!source || source.kind !== "editorial-accessible" || !source.accessible) {
      issues.push({ code: "invalid-reading-source", entityId: unit.id });
    }
    if (seenUnitIds.has(unit.id)) issues.push({ code: "duplicate-unit", entityId: unit.id });
    seenUnitIds.add(unit.id);
    const group = unitsByWork.get(unit.workId) ?? [];
    if (group.some((existing) => existing.position === unit.position)) {
      issues.push({ code: "duplicate-position", entityId: unit.workId });
    }
    group.push(unit);
    unitsByWork.set(unit.workId, group);
  }

  for (const gate of manifest.gates) {
    if (!works.has(gate.workId)) issues.push({ code: "invalid-gate-work", entityId: gate.id });
    const known = new Set((unitsByWork.get(gate.workId) ?? []).map((unit) => unit.id));
    if (gate.requiredUnitIds.length === 0 || !unique(gate.requiredUnitIds) || gate.requiredUnitIds.some((id) => !known.has(id))) {
      issues.push({ code: "invalid-gate-requirements", entityId: gate.id });
    }
  }

  return issues;
}

export function reconciledProgress(units: ReadingUnit[], snapshot: ProgressSnapshot): string[] {
  const completed = new Set(snapshot.completedUnitIds);
  return units
    .filter((unit) => unit.workId === snapshot.workId)
    .sort((a, b) => a.position - b.position)
    .filter((unit) => completed.has(unit.id))
    .map((unit) => unit.id);
}

export function isGateUnlocked(gate: SpoilerGate, units: ReadingUnit[], progress: ProgressSnapshot): boolean {
  if (progress.workId !== gate.workId || gate.requiredUnitIds.length === 0 || !unique(gate.requiredUnitIds)) return false;
  const known = new Set(units.filter((unit) => unit.workId === gate.workId).map((unit) => unit.id));
  if (gate.requiredUnitIds.some((id) => !known.has(id))) return false;
  const completed = new Set(reconciledProgress(units, progress));
  return gate.requiredUnitIds.every((id) => completed.has(id));
}
