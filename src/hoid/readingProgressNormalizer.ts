import { HoidSourceCatalog } from "./sourceCatalog";

/**
 * A reader-reported location. This is deliberately structural metadata:
 * it contains no narrative content and never grants access to a passage.
 */
export interface ReadingProgressInput {
  workId: string;
  chapter: number;
}

export interface NormalizedReadingProgress {
  readonly positions: ReadonlyMap<string, number>;
}

export type ProgressNormalizationResult =
  | { ok: true; value: NormalizedReadingProgress }
  | { ok: false; reason: "unknown_work" | "invalid_chapter" | "conflicting_position" };

function isValidWorkId(value: string): boolean {
  return value.trim().length > 0 && value.length <= 160;
}

/**
 * Normalizes progress against the canonical source catalog and fails closed.
 * Duplicate reports are allowed only when they agree exactly; this prevents a
 * later, contradictory UI update from silently widening a spoiler boundary.
 */
export function normalizeReadingProgress(
  catalog: HoidSourceCatalog,
  input: readonly ReadingProgressInput[],
): ProgressNormalizationResult {
  const known = new Set<string>();
  for (const source of catalog.sources) {
    for (const work of source.works) known.add(work.id);
  }

  const positions = new Map<string, number>();
  for (const item of input) {
    if (!isValidWorkId(item.workId) || !known.has(item.workId)) {
      return { ok: false, reason: "unknown_work" };
    }
    if (!Number.isInteger(item.chapter) || item.chapter < 0) {
      return { ok: false, reason: "invalid_chapter" };
    }
    const existing = positions.get(item.workId);
    if (existing !== undefined && existing !== item.chapter) {
      return { ok: false, reason: "conflicting_position" };
    }
    positions.set(item.workId, item.chapter);
  }

  return { ok: true, value: { positions: new Map(positions) } };
}

/**
 * Produces an immutable snapshot for one request. Later caller mutations must
 * not be able to expand the knowledge boundary of an in-flight request.
 */
export function snapshotReadingProgress(
  progress: NormalizedReadingProgress,
): NormalizedReadingProgress {
  return { positions: new Map(progress.positions) };
}
