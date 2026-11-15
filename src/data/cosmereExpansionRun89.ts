import type { ReadingUnit, Source, SourceKind, SpoilerGate, Work } from "./cosmereExpansionRun88";

export type DescriptorKind = "metadata" | "original-summary";

export interface ContentDescriptor {
  id: string;
  workId: string;
  kind: DescriptorKind;
  sourceId: string;
  spoilerGateId?: string;
}

/**
 * Returns whether a source can back a descriptor without promoting a catalog
 * entry or an inaccessible private file into editorial evidence.
 */
export function sourceCanBackDescriptor(source: Source | undefined, kind: DescriptorKind): boolean {
  if (!source) return false;
  if (kind === "metadata") return source.kind === "verified-index" || source.accessible;
  return source.kind === "editorial-accessible" && source.accessible;
}

export function validateDescriptors(
  descriptors: ContentDescriptor[],
  works: Work[],
  sources: Source[],
  units: ReadingUnit[],
  gates: SpoilerGate[],
): { valid: boolean; errors: string[] } {
  const workIds = new Set(works.map((work) => work.id));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const gateById = new Map(gates.map((gate) => [gate.id, gate]));
  const errors: string[] = [];

  for (const descriptor of descriptors) {
    if (!workIds.has(descriptor.workId)) errors.push(`unknown-work:descriptor:${descriptor.id}`);
    if (!sourceCanBackDescriptor(sourceById.get(descriptor.sourceId), descriptor.kind)) {
      errors.push(`untrusted-descriptor:${descriptor.id}`);
    }

    if (descriptor.spoilerGateId) {
      const gate = gateById.get(descriptor.spoilerGateId);
      if (!gate || gate.workId !== descriptor.workId) {
        errors.push(`invalid-gate:descriptor:${descriptor.id}`);
      } else {
        const gateUnits = new Set(gate.requiredUnitIds);
        const knownForWork = units.some(
          (unit) => unit.workId === descriptor.workId && gateUnits.has(unit.id),
        );
        if (!knownForWork) errors.push(`unbacked-gate:descriptor:${descriptor.id}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function visibleDescriptors(
  descriptors: ContentDescriptor[],
  completedUnitIds: string[],
  gates: SpoilerGate[],
  units: ReadingUnit[],
): ContentDescriptor[] {
  const completed = new Set(completedUnitIds);
  const gateById = new Map(gates.map((gate) => [gate.id, gate]));

  return descriptors.filter((descriptor) => {
    if (!descriptor.spoilerGateId) return true;
    const gate = gateById.get(descriptor.spoilerGateId);
    if (!gate || gate.workId !== descriptor.workId || gate.requiredUnitIds.length === 0) return false;
    const unique = new Set(gate.requiredUnitIds);
    if (unique.size !== gate.requiredUnitIds.length) return false;
    return gate.requiredUnitIds.every((unitId) =>
      completed.has(unitId) && units.some((unit) => unit.id === unitId && unit.workId === gate.workId),
    );
  });
}
