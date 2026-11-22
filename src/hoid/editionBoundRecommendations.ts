import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { validEditionBoundReadingPositions } from "./editionProgressValidation";
import {
  createHoidReadingCursor,
  getHoidReadingManifest,
  type HoidReadingCursor,
} from "./readingManifest";
import { recommendReadingNextSteps } from "./recommendations";

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
      completedThroughChapter: number;
      target: HoidRecommendationNavigationTarget;
    }>
  | Readonly<{
      sourceId: string;
      title: string;
      reason: "unread-source";
      target: HoidRecommendationNavigationTarget;
    }>;

export type HoidEditionBoundRecommendationResult =
  | Readonly<{
      status: "ready";
      items: readonly HoidEditionBoundRecommendation[];
    }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-progress" | "invalid-limit" | "invalid-active-work";
    }>;

const MAX_LIMIT = HOID_SOURCE_BIBLIOGRAPHY.length;
const TITLES = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title]));

function targetForChapter(
  sourceId: string,
  chapterNumber: number,
): HoidRecommendationNavigationTarget {
  const manifestResult = getHoidReadingManifest(sourceId);
  if (manifestResult.status !== "ready") {
    return Object.freeze({
      kind: "catalog-only",
      reason: "segmentation-unverified",
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
 * Convert metadata-only reading recommendations into exact edition-bound
 * navigation targets. This function never chooses a Cosmere reading order,
 * infers narrative dependencies, or unlocks evidence.
 *
 * A work with unresolved segmentation remains a catalog-only recommendation.
 * A numbered target is emitted only when the current manifest contains the
 * requested unit and its cursor validates against that exact manifest.
 */
export function recommendEditionBoundReadingNextSteps(
  readingInput: unknown,
  limit = 3,
  activeBookId?: unknown,
): HoidEditionBoundRecommendationResult {
  if (!Number.isFinite(limit)) {
    return Object.freeze({ status: "unavailable", reason: "invalid-limit" });
  }

  if (
    activeBookId !== undefined &&
    (typeof activeBookId !== "string" || !TITLES.has(activeBookId))
  ) {
    return Object.freeze({ status: "unavailable", reason: "invalid-active-work" });
  }

  const reading = validEditionBoundReadingPositions(readingInput);
  if (!reading) {
    return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  }

  const safeLimit = Math.min(MAX_LIMIT, Math.max(0, Math.floor(limit)));
  const recommendations = recommendReadingNextSteps(reading, safeLimit, activeBookId);
  const items: HoidEditionBoundRecommendation[] = [];

  for (const recommendation of recommendations) {
    const title = TITLES.get(recommendation.sourceId);
    if (!title || title !== recommendation.title) {
      return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
    }

    if (recommendation.reason === "resume-current-work") {
      items.push(Object.freeze({
        sourceId: recommendation.sourceId,
        title,
        reason: "resume-current-work",
        currentChapter: recommendation.currentChapter,
        completedThroughChapter: recommendation.completedThroughChapter ?? 0,
        target: targetForChapter(recommendation.sourceId, recommendation.currentChapter),
      }));
    } else {
      items.push(Object.freeze({
        sourceId: recommendation.sourceId,
        title,
        reason: "unread-source",
        target: targetForChapter(recommendation.sourceId, 1),
      }));
    }
  }

  return Object.freeze({
    status: "ready",
    items: Object.freeze(items),
  });
}
