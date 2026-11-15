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

export interface WorldRecord {
  id: string;
  name: string;
}

export interface WorldWorkLink {
  workId: string;
  worldId: string;
  sourceId: string;
}

export interface ReadingUnit {
  id: string;
  workId: string;
  position: number;
  sourceId: string;
}

export interface Progress {
  workId: string;
  completedUnitIds: readonly string[];
}

export interface SpoilerCard {
  id: string;
  workId: string;
  sourceId: string;
  requiresUnitIds: readonly string[];
  summary: string;
}

export interface ExpansionManifest {
  sources: readonly SourceRecord[];
  works: readonly CatalogWork[];
  worlds: readonly WorldRecord[];
  links: readonly WorldWorkLink[];
  units: readonly ReadingUnit[];
  cards: readonly SpoilerCard[];
}

const unique = (values: readonly string[]) => new Set(values).size === values.length;

export function auditManifest(manifest: ExpansionManifest): string[] {
  const errors: string[] = [];
  if (!unique(manifest.sources.map(x => x.id))) errors.push("duplicate-source");
  if (!unique(manifest.works.map(x => x.id))) errors.push("duplicate-work");
  if (!unique(manifest.worlds.map(x => x.id))) errors.push("duplicate-world");
  if (!unique(manifest.units.map(x => x.id))) errors.push("duplicate-unit");
  if (!unique(manifest.cards.map(x => x.id))) errors.push("duplicate-card");

  const sourceById = new Map(manifest.sources.map(x => [x.id, x]));
  const workIds = new Set(manifest.works.map(x => x.id));
  const worldIds = new Set(manifest.worlds.map(x => x.id));
  const unitById = new Map(manifest.units.map(x => [x.id, x]));

  for (const work of manifest.works) {
    if (!work.title.trim()) errors.push(`empty-title:${work.id}`);
    if (!sourceById.has(work.sourceId)) errors.push(`unknown-work-source:${work.id}`);
  }
  for (const link of manifest.links) {
    if (!workIds.has(link.workId)) errors.push(`unknown-link-work:${link.workId}`);
    if (!worldIds.has(link.worldId)) errors.push(`unknown-link-world:${link.worldId}`);
    if (!sourceById.has(link.sourceId)) errors.push(`unknown-link-source:${link.sourceId}`);
  }
  for (const unit of manifest.units) {
    const source = sourceById.get(unit.sourceId);
    if (!workIds.has(unit.workId)) errors.push(`unknown-unit-work:${unit.id}`);
    if (!Number.isInteger(unit.position) || unit.position < 1) errors.push(`invalid-unit-position:${unit.id}`);
    if (!source || source.kind !== "editorial-accessible" || !source.accessible) errors.push(`unbacked-unit:${unit.id}`);
  }
  for (const card of manifest.cards) {
    const source = sourceById.get(card.sourceId);
    if (!workIds.has(card.workId)) errors.push(`unknown-card-work:${card.id}`);
    if (!card.summary.trim()) errors.push(`empty-card-summary:${card.id}`);
    if (!card.requiresUnitIds.length || !unique(card.requiresUnitIds)) errors.push(`invalid-card-requirements:${card.id}`);
    if (!source || source.kind !== "editorial-accessible" || !source.accessible) errors.push(`unbacked-card:${card.id}`);
    for (const unitId of card.requiresUnitIds) {
      const unit = unitById.get(unitId);
      if (!unit || unit.workId !== card.workId) errors.push(`invalid-card-unit:${card.id}:${unitId}`);
    }
  }
  return errors;
}

export function visibleCards(manifest: ExpansionManifest, progress: Progress): SpoilerCard[] {
  if (auditManifest(manifest).length) return [];
  const done = new Set(progress.completedUnitIds);
  return manifest.cards.filter(card =>
    card.workId === progress.workId &&
    card.requiresUnitIds.every(id => done.has(id))
  );
}
