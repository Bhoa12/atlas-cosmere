/**
 * Safe spoiler-aware reading descriptors.
 *
 * This layer only projects caller-provided metadata. It never creates narrative
 * facts, chapter boundaries, or unlock requirements from private sources.
 */

import { ReadingProgress, ReadingRoadmapUnit, roadmapProgress } from "./cosmereExpansionRun99";

export interface SpoilerDescriptor {
  id: string;
  workId: string;
  sourceId: string;
  /** Reading units that must be completed before this descriptor is visible. */
  requiredUnitIds: readonly string[];
  text: string;
  supportedByAccessibleSource: boolean;
}

export interface DescriptorAudit {
  accepted: SpoilerDescriptor[];
  rejectedIds: string[];
}

export function auditSpoilerDescriptors(
  workId: string,
  units: readonly ReadingRoadmapUnit[],
  descriptors: readonly SpoilerDescriptor[],
): DescriptorAudit {
  const knownUnits = new Set(
    units.filter(unit => unit.workId === workId && unit.accessible).map(unit => unit.id),
  );
  const seen = new Set<string>();
  const accepted: SpoilerDescriptor[] = [];
  const rejectedIds: string[] = [];

  for (const descriptor of descriptors) {
    const requirements = descriptor.requiredUnitIds;
    const valid =
      descriptor.workId === workId &&
      descriptor.id.trim().length > 0 &&
      descriptor.sourceId.trim().length > 0 &&
      descriptor.text.trim().length > 0 &&
      descriptor.supportedByAccessibleSource &&
      requirements.length > 0 &&
      new Set(requirements).size === requirements.length &&
      requirements.every(id => knownUnits.has(id)) &&
      !seen.has(descriptor.id);

    if (!valid) {
      rejectedIds.push(descriptor.id);
      continue;
    }

    seen.add(descriptor.id);
    accepted.push(descriptor);
  }

  return { accepted, rejectedIds };
}

/**
 * Fail-closed visibility: invalid descriptors and incomplete requirements stay hidden.
 */
export function visibleSpoilerDescriptors(
  workId: string,
  units: readonly ReadingRoadmapUnit[],
  progress: ReadingProgress,
  descriptors: readonly SpoilerDescriptor[],
): SpoilerDescriptor[] {
  if (progress.workId !== workId) return [];

  const { accepted } = auditSpoilerDescriptors(workId, units, descriptors);
  const completed = new Set(
    roadmapProgress(workId, units, progress).map(unit => unit.id),
  );

  return accepted.filter(descriptor =>
    descriptor.requiredUnitIds.every(id => completed.has(id)),
  );
}
