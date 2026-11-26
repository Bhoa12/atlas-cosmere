import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  validateHoidCursorProgressSnapshot,
  type HoidCursorProgressPosition,
} from "./cursorProgressLedger";
import {
  validateHoidReadingCursor,
  type HoidReadingCursor,
} from "./readingManifest";

export type HoidRecommendationNavigationTarget =
  | Readonly<{
      kind: "edition-cursor";
      cursor: HoidReadingCursor;
      editionId: string;
      navigationSha256: string;
      locatorStatus: "verified" | "cursor-only";
      locatorId?: string;
    }>
  | Readonly<{
      kind: "catalog-only";
      reason: "segmentation-unverified" | "unit-not-found";
    }>;

export type HoidEditionBoundRecommendation = Readonly<{
  sourceId: string;
  title: string;
  reason: "resume-current-work";
  currentChapter: number;
  completedThroughChapter: number | null;
  target: HoidRecommendationNavigationTarget;
}>;

export type HoidResumeSelectionChoice = Readonly<{
  sourceId: string;
  title: string;
  currentChapter: number;
  completedThroughChapter: number | null;
  /** Exact cursor identity keeps duplicate visible chapter labels distinct. */
  cursor: HoidReadingCursor;
}>;

export type HoidEditionBoundRecommendationResult =
  | Readonly<{ status: "ready"; items: readonly HoidEditionBoundRecommendation[]; progressRevision: number }>
  | Readonly<{ status: "selection-required"; choices: readonly HoidResumeSelectionChoice[]; progressRevision: number }>
  | Readonly<{ status: "no-safe-next-work"; reason: "no-active-work"; progressRevision: number }>
  | Readonly<{ status: "unavailable"; reason: "invalid-progress" | "invalid-limit" | "invalid-active-work" }>;

const MAX_LIMIT = 1;
const TITLES = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title]));
type PartialPosition = Extract<HoidCursorProgressPosition, { cursor: HoidReadingCursor }>;

function completedThroughForCursor(
  sourceId: string,
  cursor: HoidReadingCursor,
): number | null | undefined {
  const validation = validateHoidReadingCursor(cursor);
  if (validation.status !== "valid" || validation.cursor.bookId !== sourceId) return undefined;
  const index = validation.manifest.units.findIndex(unit =>
    unit.id === validation.cursor.unitId &&
    unit.ordinal === validation.cursor.ordinal &&
    unit.chapterNumber === validation.cursor.chapterNumber
  );
  if (index < 0) return undefined;
  return index === 0 ? null : validation.manifest.units[index - 1]?.chapterNumber ?? null;
}

function targetForCursor(
  sourceId: string,
  cursor: HoidReadingCursor,
): HoidRecommendationNavigationTarget {
  const validation = validateHoidReadingCursor(cursor);
  if (validation.status !== "valid" || validation.cursor.bookId !== sourceId) {
    return Object.freeze({ kind: "catalog-only", reason: "unit-not-found" });
  }
  const unit = validation.manifest.units.find(candidate =>
    candidate.id === validation.cursor.unitId &&
    candidate.ordinal === validation.cursor.ordinal &&
    candidate.chapterNumber === validation.cursor.chapterNumber
  );
  if (!unit) return Object.freeze({ kind: "catalog-only", reason: "unit-not-found" });
  return Object.freeze({
    kind: "edition-cursor",
    cursor: validation.cursor,
    editionId: validation.manifest.editionId,
    navigationSha256: validation.manifest.navigationSha256,
    locatorStatus: unit.locatorId ? "verified" : "cursor-only",
    ...(unit.locatorId ? { locatorId: unit.locatorId } : {}),
  });
}

/**
 * Convert a validated cursor-native v2 snapshot into exact edition-bound
 * recommendation targets. The exact cursor (unit ID and ordinal) is preserved;
 * the completed-through watermark comes from the previous manifest unit, not
 * arithmetic on the visible chapter number (which may be duplicated).
 *
 * If several works are in progress, this returns an explicit selection
 * requirement instead of silently replacing the reader's active work with
 * discovery recommendations. The caller must pass one of the returned
 * source IDs on the next invocation.
 *
 * This function never chooses a Cosmere reading order, infers narrative
 * dependencies, changes progress or unlocks evidence. Unsegmented works stay
 * catalog-only, and an absent locator is reported as cursor-only rather than
 * replaced with a guessed EPUB path.
 */
export function recommendEditionBoundReadingNextSteps(
  progressInput: unknown,
  limit = 3,
  activeBookId?: unknown,
): HoidEditionBoundRecommendationResult {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return Object.freeze({ status: "unavailable", reason: "invalid-limit" });
  }

  if (
    activeBookId !== undefined &&
    (typeof activeBookId !== "string" || !TITLES.has(activeBookId))
  ) {
    return Object.freeze({ status: "unavailable", reason: "invalid-active-work" });
  }

  const validation = validateHoidCursorProgressSnapshot(progressInput);
  if (validation.status !== "valid") {
    return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  }

  const safeLimit = Math.min(MAX_LIMIT, Math.max(0, Math.floor(limit)));
  const inProgress = validation.snapshot.positions.filter(
    (position): position is PartialPosition => "cursor" in position,
  );

  let activePosition: PartialPosition | undefined;
  if (typeof activeBookId === "string") {
    activePosition = inProgress.find(position => position.bookId === activeBookId);
    if (!activePosition) return Object.freeze({ status: "unavailable", reason: "invalid-active-work" });
  } else if (inProgress.length === 1) {
    activePosition = inProgress[0];
  } else if (inProgress.length > 1) {
    const choices: HoidResumeSelectionChoice[] = [];
    for (const work of HOID_SOURCE_BIBLIOGRAPHY) {
      const position = inProgress.find(candidate => candidate.bookId === work.id);
      if (!position) continue;
      const completedThroughChapter = completedThroughForCursor(work.id, position.cursor);
      if (completedThroughChapter === undefined) {
        return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
      }
      choices.push(Object.freeze({
        sourceId: work.id,
        title: work.title,
        currentChapter: position.cursor.chapterNumber,
        completedThroughChapter,
        cursor: position.cursor,
      }));
    }
    return Object.freeze({
      status: "selection-required",
      choices: Object.freeze(choices),
      progressRevision: validation.snapshot.revision,
    });
  } else {
    return Object.freeze({
      status: "no-safe-next-work",
      reason: "no-active-work",
      progressRevision: validation.snapshot.revision,
    });
  }

  const items: HoidEditionBoundRecommendation[] = [];
  if (safeLimit > 0 && activePosition) {
    const source = HOID_SOURCE_BIBLIOGRAPHY.find(work => work.id === activePosition.bookId);
    if (!source) return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
    const completedThroughChapter = completedThroughForCursor(source.id, activePosition.cursor);
    const target = targetForCursor(source.id, activePosition.cursor);
    if (completedThroughChapter === undefined || target.kind !== "edition-cursor") {
      return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
    }
    items.push(Object.freeze({
      sourceId: source.id,
      title: source.title,
      reason: "resume-current-work",
      currentChapter: activePosition.cursor.chapterNumber,
      completedThroughChapter,
      target,
    }));
  }

  return Object.freeze({
    status: "ready",
    items: Object.freeze(items),
    progressRevision: validation.snapshot.revision,
  });
}
