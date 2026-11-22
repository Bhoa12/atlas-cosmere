import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  validateHoidCursorProgressSnapshot,
  type HoidCursorProgressPosition,
} from "./cursorProgressLedger";
import {
  createHoidReadingCursor,
  getHoidReadingManifest,
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

export type HoidEditionBoundRecommendation =
  | Readonly<{
      sourceId: string;
      title: string;
      reason: "resume-current-work";
      currentChapter: number;
      completedThroughChapter: number | null;
      target: HoidRecommendationNavigationTarget;
    }>
  | Readonly<{
      sourceId: string;
      title: string;
      reason: "unread-source";
      target: HoidRecommendationNavigationTarget;
    }>;

export type HoidResumeSelectionChoice = Readonly<{
  sourceId: string;
  title: string;
  currentChapter: number;
  completedThroughChapter: number | null;
}>;

export type HoidEditionBoundRecommendationResult =
  | Readonly<{
      status: "ready";
      items: readonly HoidEditionBoundRecommendation[];
      progressRevision: number;
    }>
  | Readonly<{
      status: "selection-required";
      choices: readonly HoidResumeSelectionChoice[];
      progressRevision: number;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-progress" | "invalid-limit" | "invalid-active-work";
    }>;

const MAX_LIMIT = HOID_SOURCE_BIBLIOGRAPHY.length;
const TITLES = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title]));
type PartialPosition = Extract<HoidCursorProgressPosition, { cursor: HoidReadingCursor }>;

function targetForChapter(
  sourceId: string,
  chapterNumber: number,
): HoidRecommendationNavigationTarget {
  const manifestResult = getHoidReadingManifest(sourceId);
  if (manifestResult.status !== "ready") {
    return Object.freeze({
      kind: "catalog-only",
      reason: manifestResult.reason === "segmentation-unverified"
        ? "segmentation-unverified"
        : "unit-not-found",
    });
  }

  const manifest = manifestResult.manifest;
  const unit = manifest.units.find(candidate => candidate.chapterNumber === chapterNumber);
  if (!unit) {
    return Object.freeze({ kind: "catalog-only", reason: "unit-not-found" });
  }

  const cursorResult = createHoidReadingCursor(sourceId, chapterNumber);
  if (
    cursorResult.status !== "ready" ||
    cursorResult.cursor.manifestId !== manifest.manifestId ||
    cursorResult.cursor.unitId !== unit.id ||
    cursorResult.cursor.ordinal !== unit.ordinal ||
    cursorResult.cursor.chapterNumber !== unit.chapterNumber
  ) {
    return Object.freeze({ kind: "catalog-only", reason: "unit-not-found" });
  }

  return Object.freeze({
    kind: "edition-cursor",
    cursor: cursorResult.cursor,
    editionId: manifest.editionId,
    navigationSha256: manifest.navigationSha256,
    locatorStatus: unit.locatorId ? "verified" : "cursor-only",
    ...(unit.locatorId ? { locatorId: unit.locatorId } : {}),
  });
}

/**
 * Convert a validated cursor-native v2 snapshot into exact edition-bound
 * recommendation targets. A cursor identifies the chapter currently open;
 * the completed-through watermark is therefore chapterNumber - 1.
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
  const positions = validation.snapshot.positions;
  const startedIds = new Set(positions.map(position => position.bookId));
  const inProgress = positions.filter(
    (position): position is PartialPosition => "cursor" in position,
  );

  let activePosition: PartialPosition | undefined;
  if (typeof activeBookId === "string") {
    activePosition = inProgress.find(position => position.bookId === activeBookId);
    if (!activePosition) {
      return Object.freeze({ status: "unavailable", reason: "invalid-active-work" });
    }
  } else if (inProgress.length === 1) {
    activePosition = inProgress[0];
  } else if (inProgress.length > 1) {
    const choices: HoidResumeSelectionChoice[] = HOID_SOURCE_BIBLIOGRAPHY.flatMap(work => {
      const position = inProgress.find(candidate => candidate.bookId === work.id);
      if (!position) return [];
      const currentChapter = position.cursor.chapterNumber;
      return [Object.freeze({
        sourceId: work.id,
        title: work.title,
        currentChapter,
        completedThroughChapter: currentChapter > 1 ? currentChapter - 1 : null,
      })];
    });

    return Object.freeze({
      status: "selection-required",
      choices: Object.freeze(choices),
      progressRevision: validation.snapshot.revision,
    });
  }

  const items: HoidEditionBoundRecommendation[] = [];
  if (safeLimit > 0 && activePosition) {
    const currentChapter = activePosition.cursor.chapterNumber;
    // Capture the narrowed identifier before the callback; TypeScript cannot
    // preserve narrowing of a mutable optional variable inside closures.
    const activeSourceId = activePosition.bookId;
    const source = HOID_SOURCE_BIBLIOGRAPHY.find(work => work.id === activeSourceId);
    if (!source) {
      return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
    }
    items.push(Object.freeze({
      sourceId: source.id,
      title: source.title,
      reason: "resume-current-work",
      currentChapter,
      completedThroughChapter: currentChapter > 1 ? currentChapter - 1 : null,
      target: targetForChapter(source.id, currentChapter),
    }));
  }

  for (const source of HOID_SOURCE_BIBLIOGRAPHY) {
    if (items.length >= safeLimit) break;
    if (startedIds.has(source.id)) continue;
    items.push(Object.freeze({
      sourceId: source.id,
      title: source.title,
      reason: "unread-source",
      target: targetForChapter(source.id, 1),
    }));
  }

  return Object.freeze({
    status: "ready",
    items: Object.freeze(items),
    progressRevision: validation.snapshot.revision,
  });
}
