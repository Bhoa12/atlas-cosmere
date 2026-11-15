/**
 * Conservative cross-domain audit for Atlas del Cosmere.
 *
 * This module deliberately validates references only. It does not infer
 * editorial structure, narrative facts, world assignments, or summaries.
 */

export type SourceKind = "verified-index" | "declared-private" | "editorial-accessible";

export interface SourceRecord {
  id: string;
  kind: SourceKind;
  accessible: boolean;
}

export interface WorldRecord { id: string; sourceId: string; }
export interface WorkRecord { id: string; sourceId: string; }
export interface WorkWorldLink { workId: string; worldId: string; sourceId: string; }
export interface ReadingUnit { id: string; workId: string; position: number; sourceId: string; }
export interface SpoilerGate { id: string; workId: string; requiredUnitIds: string[]; }

export interface ExpansionManifest {
  sources: SourceRecord[];
  worlds: WorldRecord[];
  works: WorkRecord[];
  links: WorkWorldLink[];
  units: ReadingUnit[];
  gates: SpoilerGate[];
}

export interface ManifestAudit {
  validWorldIds: string[];
  validWorkIds: string[];
  validLinkIndexes: number[];
  validUnitIds: string[];
  validGateIds: string[];
  errors: string[];
}

const unique = (values: string[]) => new Set(values).size === values.length;

export function auditExpansionManifest(manifest: ExpansionManifest): ManifestAudit {
  const errors: string[] = [];
  const sources = new Map(manifest.sources.map(source => [source.id, source]));
  const validSource = (id: string) => sources.has(id);

  const worldIds = manifest.worlds.map(world => world.id);
  const validWorldIds = unique(worldIds)
    ? manifest.worlds.filter(world => validSource(world.sourceId)).map(world => world.id)
    : [];

  if (!unique(worldIds)) errors.push("duplicate-world-id");

  const workIds = manifest.works.map(work => work.id);
  const validWorkIds = unique(workIds)
    ? manifest.works.filter(work => validSource(work.sourceId)).map(work => work.id)
    : [];

  if (!unique(workIds)) errors.push("duplicate-work-id");

  const worldSet = new Set(validWorldIds);
  const workSet = new Set(validWorkIds);

  const validLinkIndexes: number[] = [];
  manifest.links.forEach((link, index) => {
    if (workSet.has(link.workId) && worldSet.has(link.worldId) && validSource(link.sourceId)) {
      validLinkIndexes.push(index);
    } else {
      errors.push(`invalid-link:${index}`);
    }
  });

  const seenUnits = new Set<string>();
  const positionsByWork = new Set<string>();
  const validUnitIds: string[] = [];

  for (const unit of manifest.units) {
    const source = sources.get(unit.sourceId);
    const positionKey = `${unit.workId}:${unit.position}`;
    const backed = source?.kind === "editorial-accessible" && source.accessible;

    if (!workSet.has(unit.workId) || !backed || seenUnits.has(unit.id) || positionsByWork.has(positionKey)) {
      errors.push(`invalid-unit:${unit.id}`);
      continue;
    }

    seenUnits.add(unit.id);
    positionsByWork.add(positionKey);
    validUnitIds.push(unit.id);
  }

  const unitSet = new Set(validUnitIds);
  const validGateIds: string[] = [];

  for (const gate of manifest.gates) {
    const requirementsAreUsable =
      gate.requiredUnitIds.length > 0 &&
      unique(gate.requiredUnitIds) &&
      gate.requiredUnitIds.every(id => unitSet.has(id));

    if (!workSet.has(gate.workId) || !requirementsAreUsable) {
      errors.push(`invalid-gate:${gate.id}`);
      continue;
    }

    validGateIds.push(gate.id);
  }

  return { validWorldIds, validWorkIds, validLinkIndexes, validUnitIds, validGateIds, errors };
}

export function reconcileManifestProgress(
  workId: string,
  completedUnitIds: string[],
  manifest: ExpansionManifest,
): string[] {
  const audit = auditExpansionManifest(manifest);
  const valid = new Set(audit.validUnitIds);
  const completed = new Set(completedUnitIds);
  return manifest.units
    .filter(unit => unit.workId === workId && valid.has(unit.id))
    .sort((a, b) => a.position - b.position)
    .map(unit => unit.id)
    .filter(id => completed.has(id));
}

export function isGateUnlocked(
  gateId: string,
  completedUnitIds: string[],
  manifest: ExpansionManifest,
): boolean {
  const audit = auditExpansionManifest(manifest);
  if (!audit.validGateIds.includes(gateId)) return false;
  const gate = manifest.gates.find(candidate => candidate.id === gateId);
  if (!gate) return false;
  const completed = new Set(reconcileManifestProgress(gate.workId, completedUnitIds, manifest));
  return gate.requiredUnitIds.every(id => completed.has(id));
}
