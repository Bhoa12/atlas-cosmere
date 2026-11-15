export type SourceKind = "verified-index" | "declared-private" | "editorial-accessible";

export interface SourceRecord { id: string; kind: SourceKind; accessible: boolean }
export interface WorldRecord { id: string; name: string }
export interface CatalogWork { id: string; title: string; sourceId: string }
export interface WorkWorldLink { workId: string; worldId: string; sourceId: string }
export interface ReadingUnit { id: string; workId: string; position: number; sourceId: string }
export interface ProgressSnapshot { workId: string; completedUnitIds: string[] }
export interface SpoilerGate { id: string; workId: string; requiredUnitIds: string[] }
export interface ContentDescriptor {
  id: string;
  workId: string;
  kind: "metadata" | "original-summary";
  sourceId: string;
  spoilerGateId?: string;
}

export interface ExpansionManifest {
  sources: SourceRecord[];
  worlds: WorldRecord[];
  works: CatalogWork[];
  worldLinks: WorkWorldLink[];
  units: ReadingUnit[];
  gates: SpoilerGate[];
  descriptors: ContentDescriptor[];
}

export type ManifestIssueCode =
  | "unknown-source"
  | "duplicate-world"
  | "duplicate-work"
  | "invalid-world-link"
  | "invalid-reading-source"
  | "duplicate-unit"
  | "duplicate-position"
  | "invalid-gate-work"
  | "invalid-gate-requirements"
  | "invalid-descriptor-work"
  | "invalid-descriptor-source"
  | "invalid-descriptor-gate";

export interface ManifestIssue { code: ManifestIssueCode; entityId: string }

const unique = (values: string[]) => new Set(values).size === values.length;
const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((item) => [item.id, item]));

export function auditExpansionManifest(manifest: ExpansionManifest): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  const sources = byId(manifest.sources);
  const worlds = new Set<string>();
  const works = new Set<string>();
  const unitsByWork = new Map<string, ReadingUnit[]>();
  const gates = byId(manifest.gates);

  for (const world of manifest.worlds) {
    if (worlds.has(world.id)) issues.push({ code: "duplicate-world", entityId: world.id });
    worlds.add(world.id);
  }
  for (const work of manifest.works) {
    if (works.has(work.id)) issues.push({ code: "duplicate-work", entityId: work.id });
    works.add(work.id);
    if (!sources.has(work.sourceId)) issues.push({ code: "unknown-source", entityId: work.id });
  }
  for (const link of manifest.worldLinks) {
    if (!works.has(link.workId) || !worlds.has(link.worldId) || !sources.has(link.sourceId)) {
      issues.push({ code: "invalid-world-link", entityId: link.workId });
    }
  }

  const seenUnits = new Set<string>();
  for (const unit of manifest.units) {
    const source = sources.get(unit.sourceId);
    if (!source || source.kind !== "editorial-accessible" || !source.accessible) {
      issues.push({ code: "invalid-reading-source", entityId: unit.id });
    }
    if (seenUnits.has(unit.id)) issues.push({ code: "duplicate-unit", entityId: unit.id });
    seenUnits.add(unit.id);
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

  for (const descriptor of manifest.descriptors) {
    if (!works.has(descriptor.workId)) issues.push({ code: "invalid-descriptor-work", entityId: descriptor.id });
    const source = sources.get(descriptor.sourceId);
    const allowed = descriptor.kind === "metadata"
      ? Boolean(source && source.accessible)
      : Boolean(source && source.kind === "editorial-accessible" && source.accessible);
    if (!allowed) issues.push({ code: "invalid-descriptor-source", entityId: descriptor.id });
    if (descriptor.spoilerGateId) {
      const gate = gates.get(descriptor.spoilerGateId);
      if (!gate || gate.workId !== descriptor.workId) issues.push({ code: "invalid-descriptor-gate", entityId: descriptor.id });
    }
  }
  return issues;
}

export function reconciledProgress(units: ReadingUnit[], snapshot: ProgressSnapshot): string[] {
  const completed = new Set(snapshot.completedUnitIds);
  return units.filter((unit) => unit.workId === snapshot.workId)
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

export function visibleDescriptors(manifest: ExpansionManifest, progress: ProgressSnapshot): ContentDescriptor[] {
  const issues = auditExpansionManifest(manifest);
  const invalid = new Set(issues.map((issue) => issue.entityId));
  const gates = byId(manifest.gates);
  return manifest.descriptors.filter((descriptor) => {
    if (invalid.has(descriptor.id) || descriptor.workId !== progress.workId) return false;
    if (!descriptor.spoilerGateId) return true;
    const gate = gates.get(descriptor.spoilerGateId);
    return Boolean(gate && isGateUnlocked(gate, manifest.units, progress));
  });
}
