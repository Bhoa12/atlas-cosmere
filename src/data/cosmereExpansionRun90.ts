/**
 * Expansion run 90: provenance-aware catalog projection.
 *
 * This module deliberately stores no protected editorial text. It provides
 * deterministic rules for deciding which catalog metadata can be surfaced and
 * which narrative descriptors must remain unavailable.
 */

export type SourceKind = "verified-index" | "declared-private" | "editorial-accessible";

export interface SourceRecord {
  id: string;
  kind: SourceKind;
  accessible: boolean;
}

export interface CatalogWork {
  id: string;
  title: string;
  sourceId: string;
}

export type DescriptorKind = "metadata" | "original-summary";

export interface Descriptor {
  id: string;
  workId: string;
  kind: DescriptorKind;
  sourceId: string;
}

export interface CatalogAudit {
  validWorks: CatalogWork[];
  rejectedWorkIds: string[];
  visibleDescriptorIds: string[];
  hiddenDescriptorIds: string[];
}

function sourceMap(sources: readonly SourceRecord[]): Map<string, SourceRecord> {
  return new Map(sources.map((source) => [source.id, source]));
}

export function canPublishDescriptor(
  descriptor: Descriptor,
  source: SourceRecord | undefined,
): boolean {
  if (!source) return false;

  if (descriptor.kind === "metadata") {
    return source.kind === "verified-index" || source.kind === "editorial-accessible";
  }

  return source.kind === "editorial-accessible" && source.accessible;
}

/**
 * Produces a conservative projection suitable for UI layers. Invalid or
 * unbacked records are omitted rather than guessed or repaired.
 */
export function auditCatalog(
  sources: readonly SourceRecord[],
  works: readonly CatalogWork[],
  descriptors: readonly Descriptor[],
): CatalogAudit {
  const byId = sourceMap(sources);
  const workIds = new Set<string>();
  const validWorks: CatalogWork[] = [];
  const rejectedWorkIds: string[] = [];

  for (const work of works) {
    if (workIds.has(work.id) || !byId.has(work.sourceId)) {
      rejectedWorkIds.push(work.id);
      continue;
    }
    workIds.add(work.id);
    validWorks.push(work);
  }

  const visibleDescriptorIds: string[] = [];
  const hiddenDescriptorIds: string[] = [];
  const validWorkIds = new Set(validWorks.map((work) => work.id));

  for (const descriptor of descriptors) {
    const source = byId.get(descriptor.sourceId);
    if (
      validWorkIds.has(descriptor.workId) &&
      canPublishDescriptor(descriptor, source)
    ) {
      visibleDescriptorIds.push(descriptor.id);
    } else {
      hiddenDescriptorIds.push(descriptor.id);
    }
  }

  return { validWorks, rejectedWorkIds, visibleDescriptorIds, hiddenDescriptorIds };
}
