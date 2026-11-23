import {
  prepareHoidRecommendationNavigationHandoff,
  type HoidRecommendationNavigationHandoffResult,
  type HoidVerifiedRecommendationNavigationHandoff,
} from "./editionBoundRecommendationNavigation";

export type HoidVerifiedReaderChapterTarget = Readonly<{
  cursor: HoidVerifiedRecommendationNavigationHandoff["cursor"];
  manifestId: string;
  editionId: string;
  navigationSha256: string;
  locatorStatus: "verified";
  locatorId: string;
}>;

export type HoidRecommendationReaderOpenRequest = Readonly<{
  target: HoidVerifiedReaderChapterTarget;
  progressRevision: number;
  progressFingerprint: string;
  signal?: AbortSignal;
}>;

/**
 * Host-owned capability for opening one exact, verified EPUB chapter.
 *
 * Implementations must resolve locatorId only inside the matching edition,
 * recheck the supplied progress identity immediately before opening, honor
 * AbortSignal until the open commits, and never mutate the progress ledger.
 */
export interface HoidRecommendationReaderPort {
  openVerifiedChapter(request: HoidRecommendationReaderOpenRequest): Promise<unknown>;
}

type NavigationUnavailableReason = Extract<
  HoidRecommendationNavigationHandoffResult,
  { status: "unavailable" }
>["reason"];

export type HoidRecommendationReaderOpenResult =
  | Readonly<{
      status: "opened";
      target: HoidVerifiedReaderChapterTarget;
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | NavigationUnavailableReason
        | "reader-unavailable"
        | "locator-unverified"
        | "edition-unavailable"
        | "locator-unavailable"
        | "cancelled"
        | "superseded"
        | "reader-failed"
        | "invalid-reader-acknowledgement";
    }>;

export type HoidRecommendationReaderDependencies = Readonly<{
  reader: HoidRecommendationReaderPort | null;
  /** Must perform a durable read from the host's authoritative progress store. */
  refreshCurrentProgress: () => Promise<unknown>;
}>;

export type HoidRecommendationReaderInput = Readonly<{
  target: unknown;
  expectedProgressRevision: unknown;
  expectedProgressFingerprint: unknown;
  selectedActiveBookId?: unknown;
  signal?: AbortSignal;
}>;

type CanonicalReaderAcknowledgement =
  | Readonly<{ status: "opened" }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "reader-unavailable"
        | "edition-unavailable"
        | "locator-unavailable"
        | "cancelled"
        | "superseded"
        | "stale-progress"
        | "reader-failed";
    }>
  | Readonly<{ status: "invalid" }>;

function unavailable(
  reason: Extract<HoidRecommendationReaderOpenResult, { status: "unavailable" }>["reason"],
): HoidRecommendationReaderOpenResult {
  return Object.freeze({ status: "unavailable", reason });
}

function isAborted(signal: AbortSignal | undefined): boolean {
  try {
    return signal?.aborted === true;
  } catch {
    // A broken cancellation capability must never authorize a side effect.
    return true;
  }
}

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
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

function hasExactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return Object.keys(record).length === expected.length &&
    expected.every(key => Object.prototype.hasOwnProperty.call(record, key));
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}

function canonicalizeAcknowledgement(
  value: unknown,
  target: HoidVerifiedReaderChapterTarget,
): CanonicalReaderAcknowledgement {
  const record = canonicalRecord(value, [
    "status",
    "reason",
    "bookId",
    "chapterNumber",
    "editionId",
    "locatorId",
  ]);
  if (!record || typeof record.status !== "string") return { status: "invalid" };

  if (record.status === "unavailable") {
    if (!hasExactKeys(record, ["status", "reason"])) return { status: "invalid" };
    switch (record.reason) {
      case "reader-unavailable":
      case "edition-unavailable":
      case "locator-unavailable":
      case "cancelled":
      case "superseded":
      case "stale-progress":
        return Object.freeze({ status: "unavailable", reason: record.reason });
      case "failed":
        return Object.freeze({ status: "unavailable", reason: "reader-failed" });
      default:
        return { status: "invalid" };
    }
  }

  if (
    record.status !== "opened" ||
    !hasExactKeys(record, ["status", "bookId", "chapterNumber", "editionId", "locatorId"]) ||
    !nonEmptyString(record.bookId) ||
    !Number.isSafeInteger(record.chapterNumber) ||
    (record.chapterNumber as number) < 1 ||
    !nonEmptyString(record.editionId) ||
    !nonEmptyString(record.locatorId)
  ) return { status: "invalid" };

  if (
    record.bookId !== target.cursor.bookId ||
    record.chapterNumber !== target.cursor.chapterNumber ||
    record.editionId !== target.editionId ||
    record.locatorId !== target.locatorId
  ) return { status: "invalid" };

  return Object.freeze({ status: "opened" });
}

function toVerifiedReaderTarget(
  handoff: HoidVerifiedRecommendationNavigationHandoff,
): HoidVerifiedReaderChapterTarget | null {
  if (
    handoff.locatorStatus !== "verified" ||
    !nonEmptyString(handoff.locatorId)
  ) return null;

  return Object.freeze({
    cursor: handoff.cursor,
    manifestId: handoff.manifestId,
    editionId: handoff.editionId,
    navigationSha256: handoff.navigationSha256,
    locatorStatus: "verified",
    locatorId: handoff.locatorId,
  });
}

/**
 * Revalidate a recommendation against a fresh durable progress read, then
 * hand only a verified opaque locator to the host reader.
 *
 * This adapter does not resolve EPUB paths, open files, change progress, or
 * grant narrative evidence. Cursor-only and catalog-only targets are refused.
 */
export async function openHoidRecommendationChapter(
  dependencies: HoidRecommendationReaderDependencies,
  input: HoidRecommendationReaderInput,
): Promise<HoidRecommendationReaderOpenResult> {
  if (isAborted(input.signal)) return unavailable("cancelled");
  if (!dependencies.reader) return unavailable("reader-unavailable");

  let currentProgress: unknown;
  try {
    currentProgress = await dependencies.refreshCurrentProgress();
  } catch {
    return unavailable("invalid-progress");
  }

  if (isAborted(input.signal)) return unavailable("cancelled");

  const navigation = prepareHoidRecommendationNavigationHandoff(
    input.target,
    currentProgress,
    input.expectedProgressRevision,
    input.expectedProgressFingerprint,
    input.selectedActiveBookId,
  );
  if (navigation.status !== "ready") return unavailable(navigation.reason);

  const target = toVerifiedReaderTarget(navigation.handoff);
  if (!target) return unavailable("locator-unverified");

  const readerRequest: HoidRecommendationReaderOpenRequest = Object.freeze({
    target,
    progressRevision: navigation.progressRevision,
    progressFingerprint: navigation.progressFingerprint,
    ...(input.signal ? { signal: input.signal } : {}),
  });

  let acknowledgement: unknown;
  try {
    acknowledgement = await dependencies.reader.openVerifiedChapter(readerRequest);
  } catch {
    return unavailable(isAborted(input.signal) ? "cancelled" : "reader-failed");
  }

  if (isAborted(input.signal)) return unavailable("cancelled");

  const canonical = canonicalizeAcknowledgement(acknowledgement, target);
  if (canonical.status === "invalid") {
    return unavailable("invalid-reader-acknowledgement");
  }
  if (canonical.status === "unavailable") return unavailable(canonical.reason);

  return Object.freeze({
    status: "opened",
    target,
    progressRevision: navigation.progressRevision,
    progressFingerprint: navigation.progressFingerprint,
  });
}
