import {
  validateHoidCursorProgressSnapshot,
  type HoidCursorProgressPosition,
} from "./cursorProgressLedger";
import type {
  HoidEvidenceAnswer,
  HoidEvidenceRecommendationResult,
  HoidEvidenceRuntime,
  HoidClaimIntent,
} from "./evidenceRuntime";
import { projectHoidCursorPositionToBoundary } from "./readingBoundary";
import type { ReadingPosition } from "./types";

export type HoidCursorProgressProjection =
  | Readonly<{
      status: "ready";
      revision: number;
      reading: readonly ReadingPosition[];
      /** Works already started, including chapter one before any chapter is complete. */
      startedBookIds: readonly string[];
    }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-snapshot" | "cursor-unavailable";
    }>;

const ANSWER_REQUEST_KEYS = new Set(["question", "progress", "intent"]);
const MAX_RECOMMENDATION_LIMIT = 20;

function canonicalDataRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function toReadingPosition(
  position: HoidCursorProgressPosition,
): ReadingPosition | null | undefined {
  const projection = projectHoidCursorPositionToBoundary(position);
  if (projection === null) return undefined;
  return projection.safeReadingPosition;
}

/**
 * Convert a fully validated v2 cursor snapshot into the compatibility reading
 * shape consumed by HoidEvidenceRuntime. A partial cursor identifies the
 * chapter currently open in Atlas, so only currentChapter - 1 is considered
 * completed and eligible for spoiler authorization. Chapter one therefore
 * contributes no completed ReadingPosition. Explicit completion alone unlocks
 * the entire work. Every cursor is revalidated against its edition manifest.
 */
export function projectHoidCursorProgressSnapshot(
  value: unknown,
): HoidCursorProgressProjection {
  const validation = validateHoidCursorProgressSnapshot(value);
  if (validation.status !== "valid") {
    return Object.freeze({ status: "unavailable", reason: "invalid-snapshot" });
  }

  const reading: ReadingPosition[] = [];
  const startedBookIds: string[] = [];
  for (const position of validation.snapshot.positions) {
    const projected = toReadingPosition(position);
    if (projected === undefined) {
      return Object.freeze({ status: "unavailable", reason: "cursor-unavailable" });
    }
    startedBookIds.push(position.bookId);
    // A cursor on chapter one is valid, but no chapter has been completed yet.
    // Do not manufacture chapter zero or authorize any chapter-level evidence.
    if (projected !== null) reading.push(projected);
  }

  return Object.freeze({
    status: "ready",
    revision: validation.snapshot.revision,
    reading: Object.freeze(reading),
    startedBookIds: Object.freeze(startedBookIds),
  });
}

function blockedAnswer(text: string): HoidEvidenceAnswer {
  return Object.freeze({
    status: "blocked",
    reason: "invalid-input",
    text,
    claimIds: Object.freeze([]),
    evidenceIds: Object.freeze([]),
    sources: Object.freeze([]),
  });
}

function invalidRecommendation(): HoidEvidenceRecommendationResult {
  return Object.freeze({
    status: "abstain",
    reason: "invalid-progress",
    items: Object.freeze([]) as readonly [],
  });
}

/**
 * Cursor-native façade over the strict evidence runtime.
 *
 * This is a compatibility bridge, not a persistence cutover: callers must
 * supply a validated v2 snapshot. The façade projects it to the legacy
 * ReadingPosition contract only after the edition-bound cursor checks pass.
 * Provider selection and final editorial rendering remain inside
 * HoidEvidenceRuntime.
 */
export class HoidCursorEvidenceRuntime {
  constructor(private readonly runtime: HoidEvidenceRuntime) {}

  async answer(input: unknown): Promise<HoidEvidenceAnswer> {
    const request = canonicalDataRecord(input, ANSWER_REQUEST_KEYS);
    if (
      request === null ||
      !Object.prototype.hasOwnProperty.call(request, "question") ||
      !Object.prototype.hasOwnProperty.call(request, "progress") ||
      typeof request.question !== "string"
    ) {
      return blockedAnswer("La solicitud o el snapshot de lectura no tienen un formato válido. Hoid no ampliará el contexto.");
    }

    const intent = request.intent === undefined ? "explain" : request.intent;
    if (intent !== "explain" && intent !== "recommend" && intent !== "context") {
      return blockedAnswer("La intención de la consulta no es válida. Hoid no enviará datos ambiguos al selector.");
    }

    const projection = projectHoidCursorProgressSnapshot(request.progress);
    if (projection.status !== "ready") {
      return blockedAnswer("El progreso por cursores no puede validarse contra la edición. Hoid no consultará al selector.");
    }

    return this.runtime.answer({
      question: request.question,
      intent: intent as HoidClaimIntent,
      reading: [...projection.reading],
    });
  }

  recommend(
    progress: unknown,
    limit = 3,
  ): HoidEvidenceRecommendationResult {
    if (
      typeof limit !== "number" ||
      !Number.isSafeInteger(limit) ||
      limit < 0 ||
      limit > MAX_RECOMMENDATION_LIMIT
    ) {
      return invalidRecommendation();
    }

    const projection = projectHoidCursorProgressSnapshot(progress);
    if (projection.status !== "ready") return invalidRecommendation();

    // Ask the metadata-only recommender for a bounded candidate set, then
    // remove every work already present in the v2 snapshot. Chapter-one
    // readers have no completed chapter yet, but their work is still started.
    const candidates = this.runtime.recommend([...projection.reading], MAX_RECOMMENDATION_LIMIT);
    if (candidates.status !== "ready") return candidates;
    const started = new Set(projection.startedBookIds);
    return Object.freeze({
      status: "ready",
      items: Object.freeze(candidates.items.filter(item => !started.has(item.sourceId)).slice(0, limit)),
    });
  }
}

/** Convenience factory for dependency-injection composition roots. */
export function createHoidCursorEvidenceRuntime(
  runtime: HoidEvidenceRuntime,
): HoidCursorEvidenceRuntime {
  return new HoidCursorEvidenceRuntime(runtime);
}
