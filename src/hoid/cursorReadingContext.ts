import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { validateHoidCursorProgressSnapshot } from "./cursorProgressLedger";
import { projectHoidCursorPositionToBoundary } from "./readingBoundary";

export type HoidCursorReadingContextPosition =
  | Readonly<{
      bookId: string;
      title: string;
      status: "in-progress";
      currentChapter: number;
      completedThroughChapter: number | null;
      order?: number;
    }>
  | Readonly<{
      bookId: string;
      title: string;
      status: "completed";
      completedThrough: "entire-work";
      order?: number;
    }>;

export type HoidCursorReadingContext = Readonly<{
  revision: number;
  updatedAt: string | null;
  positions: readonly HoidCursorReadingContextPosition[];
  startedCount: number;
  unstartedCount: number;
  catalogSize: number;
  unitScope: "verified-numbered-chapters-only";
}>;

export type HoidCursorReadingContextResult =
  | Readonly<{ status: "ready"; context: HoidCursorReadingContext }>
  | Readonly<{ status: "unavailable"; reason: "invalid-progress" }>;

const TITLES = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title]));

/**
 * Projects only the reader's own, validated v2 positions into user-facing
 * metadata. It is not a narrative recap and never invents a final chapter.
 * For an open chapter N, the projection reports N as current and N-1 as the
 * last completed chapter; chapter one therefore has no completed chapter.
 */
export function buildHoidCursorReadingContext(
  value: unknown,
): HoidCursorReadingContextResult {
  const validation = validateHoidCursorProgressSnapshot(value);
  if (validation.status !== "valid") {
    return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  }

  const positions: HoidCursorReadingContextPosition[] = [];
  for (const position of validation.snapshot.positions) {
    const title = TITLES.get(position.bookId);
    const projection = projectHoidCursorPositionToBoundary(position);
    if (!title || !projection) {
      return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
    }

    const boundary = projection.boundary;
    if (boundary.kind === "completed") {
      positions.push(Object.freeze({
        bookId: boundary.bookId,
        title,
        status: "completed" as const,
        completedThrough: "entire-work" as const,
        ...(boundary.order === undefined ? {} : { order: boundary.order }),
      }));
    } else {
      positions.push(Object.freeze({
        bookId: boundary.bookId,
        title,
        status: "in-progress" as const,
        currentChapter: boundary.currentChapter,
        completedThroughChapter: boundary.completedThroughChapter,
        ...(boundary.order === undefined ? {} : { order: boundary.order }),
      }));
    }
  }

  positions.sort((left, right) => {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.bookId.localeCompare(right.bookId);
  });

  const frozenPositions = Object.freeze(positions);
  return Object.freeze({
    status: "ready",
    context: Object.freeze({
      revision: validation.snapshot.revision,
      updatedAt: validation.snapshot.updatedAt,
      positions: frozenPositions,
      startedCount: frozenPositions.length,
      unstartedCount: HOID_SOURCE_BIBLIOGRAPHY.length - frozenPositions.length,
      catalogSize: HOID_SOURCE_BIBLIOGRAPHY.length,
      unitScope: "verified-numbered-chapters-only",
    }),
  });
}
