/**
 * Reusable catalog model for every Cosmere world.
 *
 * This layer deliberately stores structure and reading coordinates separately
 * from editorial descriptions. Published lore should be attached later through
 * spoiler gates with a verifiable source reference.
 */
export type WorldId = string;
export type WorkId = string;
export type ReadingUnitId = string;

export interface ReadingUnit {
  id: ReadingUnitId;
  workId: WorkId;
  order: number;
  kind: 'prologue' | 'chapter' | 'interlude' | 'epilogue' | 'part' | 'other';
  label: string;
}

export interface WorkCatalogEntry {
  id: WorkId;
  worldId: WorldId;
  title: string;
  series?: string;
  sequence: number;
  format: 'novel' | 'novella' | 'graphic_novel' | 'short_story' | 'other';
  units: readonly ReadingUnit[];
}

export interface WorldCatalogEntry {
  id: WorldId;
  name: string;
  systemName?: string;
  works: readonly WorkCatalogEntry[];
}

export interface ReaderProgress {
  workId: WorkId;
  completedUnitOrder: number;
}

/**
 * A spoiler gate is satisfied only when the reader has reached the exact work
 * and reading-unit coordinate required by the content item.
 */
export interface SpoilerGate {
  workId: WorkId;
  minimumUnitOrder: number;
}

export interface CatalogContent<T> {
  id: string;
  worldId: WorldId;
  gate: SpoilerGate;
  payload: T;
  source: {
    kind: 'epub' | 'official' | 'editorial';
    locator: string;
  };
}

export function hasReachedGate(
  progress: readonly ReaderProgress[],
  gate: SpoilerGate,
): boolean {
  return (progress.find((item) => item.workId === gate.workId)
    ?.completedUnitOrder ?? -1) >= gate.minimumUnitOrder;
}

export function visibleContent<T>(
  content: readonly CatalogContent<T>[],
  progress: readonly ReaderProgress[],
): CatalogContent<T>[] {
  return content.filter((item) => hasReachedGate(progress, item.gate));
}

export function validateCatalog(
  worlds: readonly WorldCatalogEntry[],
): string[] {
  const errors: string[] = [];
  const worldIds = new Set<string>();
  const workIds = new Set<string>();

  for (const world of worlds) {
    if (worldIds.has(world.id)) errors.push(`Duplicate world id: ${world.id}`);
    worldIds.add(world.id);

    for (const work of world.works) {
      if (work.worldId !== world.id) {
        errors.push(`Work ${work.id} belongs to ${work.worldId}, expected ${world.id}`);
      }
      if (workIds.has(work.id)) errors.push(`Duplicate work id: ${work.id}`);
      workIds.add(work.id);

      const unitIds = new Set<string>();
      let previous = -1;
      for (const unit of work.units) {
        if (unitIds.has(unit.id)) {
          errors.push(`Duplicate unit id: ${unit.id}`);
        }
        unitIds.add(unit.id);
        if (!Number.isInteger(unit.order) || unit.order < 0) {
          errors.push(`Invalid unit order for ${unit.id}`);
        }
        if (unit.workId !== work.id) {
          errors.push(`Unit ${unit.id} has incorrect work id`);
        }
        if (unit.order <= previous) {
          errors.push(`Units for ${work.id} are not strictly ordered`);
        }
        previous = unit.order;
      }
    }
  }

  return errors;
}
