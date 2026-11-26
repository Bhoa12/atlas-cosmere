import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./cursorProgressFingerprint";
import {
  validateHoidCursorProgressSnapshot,
  type HoidCursorProgressPosition,
} from "./cursorProgressLedger";
import { projectHoidCursorPositionToBoundary } from "./readingBoundary";
import { getHoidReadingManifest } from "./readingManifest";

export type HoidReadingFocusChoice = Readonly<{
  bookId: string;
  title: string;
  status: "in-progress" | "completed";
  currentChapter: number | null;
  completedThroughChapter: number | null;
  completedThroughEntireWork: boolean;
  chapterTracking: "verified" | "unavailable";
}>;

/**
 * A provider-neutral projection of one explicitly selected active work.
 *
 * It contains reader-owned progress metadata only. It deliberately excludes
 * cursors, EPUB locators, chapter bodies, summaries, claims and evidence IDs.
 * It is not an authorization token and cannot unlock narrative evidence.
 */
export type HoidReadingFocus = Readonly<{
  schemaVersion: 1;
  kind: "reader-focus";
  bookId: string;
  title: string;
  editionId: string;
  manifestId: string;
  manifestCoverage: "verified-numeric-chapters" | "partial-before-ambiguous-chapter";
  numberedChapterCount: number;
  status: "in-progress" | "completed";
  currentChapter: number | null;
  completedThroughChapter: number | null;
  completedThroughEntireWork: boolean;
  progressRevision: number;
  progressFingerprint: string;
  authorizationEffect: "none";
}>;

export type HoidReadingFocusResolution =
  | Readonly<{ status: "ready"; focus: HoidReadingFocus }>
  | Readonly<{
      status: "selection-required";
      reason: "multiple-active-works";
      choices: readonly HoidReadingFocusChoice[];
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-request"
        | "invalid-progress"
        | "no-active-work"
        | "selected-work-not-active"
        | "chapter-structure-unavailable";
    }>;

export type HoidReadingFocusValidation =
  | Readonly<{ status: "valid"; focus: HoidReadingFocus }>
  | Readonly<{
      status: "stale";
      reason: "progress-changed" | "work-no-longer-active" | "edition-changed";
    }>
  | Readonly<{ status: "invalid"; reason: "invalid-focus" | "invalid-progress" }>;

const BOOKS = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title] as const));
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const REQUEST_KEYS = ["progress", "selectedBookId"] as const;
const FOCUS_KEYS = [
  "schemaVersion",
  "kind",
  "bookId",
  "title",
  "editionId",
  "manifestId",
  "manifestCoverage",
  "numberedChapterCount",
  "status",
  "currentChapter",
  "completedThroughChapter",
  "completedThroughEntireWork",
  "progressRevision",
  "progressFingerprint",
  "authorizationEffect",
] as const;

function exactDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor ||
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    for (const key of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalRequest(value: unknown): Readonly<{
  progress: unknown;
  selectedBookId?: string;
}> | null {
  const record = exactDataRecord(value, REQUEST_KEYS, ["progress"]);
  if (!record) return null;

  if (Object.prototype.hasOwnProperty.call(record, "selectedBookId")) {
    const selectedBookId = record.selectedBookId;
    if (typeof selectedBookId !== "string" ||
        selectedBookId.length === 0 ||
        selectedBookId !== selectedBookId.trim() ||
        !BOOKS.has(selectedBookId)) return null;
    return Object.freeze({ progress: record.progress, selectedBookId });
  }

  return Object.freeze({ progress: record.progress });
}

function choiceForPosition(
  position: HoidCursorProgressPosition,
): HoidReadingFocusChoice | null {
  const title = BOOKS.get(position.bookId);
  const projected = projectHoidCursorPositionToBoundary(position);
  if (!title || !projected) return null;

  const chapterTracking = getHoidReadingManifest(position.bookId).status === "ready"
    ? "verified"
    : "unavailable";

  if (projected.boundary.kind === "completed") {
    return Object.freeze({
      bookId: position.bookId,
      title,
      status: "completed",
      currentChapter: null,
      completedThroughChapter: null,
      completedThroughEntireWork: true,
      chapterTracking,
    });
  }

  return Object.freeze({
    bookId: position.bookId,
    title,
    status: "in-progress",
    currentChapter: projected.boundary.currentChapter,
    completedThroughChapter: projected.boundary.completedThroughChapter,
    completedThroughEntireWork: false,
    chapterTracking,
  });
}

function safeNumberedChapterCount(
  manifest: Extract<ReturnType<typeof getHoidReadingManifest>, { status: "ready" }>["manifest"],
): number {
  if (manifest.coverage === "verified-numeric-chapters") return manifest.units.length;
  if (manifest.ambiguousChapterNumbers.length === 0) return 0;
  return Math.max(0, Math.min(...manifest.ambiguousChapterNumbers) - 1);
}

function focusForPosition(
  position: HoidCursorProgressPosition,
  progress: unknown,
): HoidReadingFocus | null {
  const title = BOOKS.get(position.bookId);
  const projected = projectHoidCursorPositionToBoundary(position);
  const manifestResult = getHoidReadingManifest(position.bookId);
  const progressProjection = projectHoidCursorProgressSnapshot(progress);

  if (!title || !projected || manifestResult.status !== "ready" ||
      progressProjection.status !== "ready") return null;

  const numberedChapterCount = safeNumberedChapterCount(manifestResult.manifest);
  if (numberedChapterCount < 1) return null;

  const completed = projected.boundary.kind === "completed";
  const currentChapter = completed ? null : projected.boundary.currentChapter;
  const completedThroughChapter = completed ? null : projected.boundary.completedThroughChapter;

  return Object.freeze({
    schemaVersion: 1,
    kind: "reader-focus",
    bookId: position.bookId,
    title,
    editionId: manifestResult.manifest.editionId,
    manifestId: manifestResult.manifest.manifestId,
    manifestCoverage: manifestResult.manifest.coverage,
    numberedChapterCount,
    status: completed ? "completed" : "in-progress",
    currentChapter,
    completedThroughChapter,
    completedThroughEntireWork: completed,
    progressRevision: progressProjection.revision,
    progressFingerprint: fingerprintHoidCursorProgressProjection(progressProjection),
    authorizationEffect: "none",
  });
}

function canonicalFocus(value: unknown): HoidReadingFocus | null {
  const record = exactDataRecord(value, FOCUS_KEYS, FOCUS_KEYS);
  if (!record ||
      record.schemaVersion !== 1 ||
      record.kind !== "reader-focus" ||
      typeof record.bookId !== "string" ||
      !BOOKS.has(record.bookId) ||
      typeof record.title !== "string" ||
      typeof record.editionId !== "string" ||
      record.editionId.length === 0 ||
      typeof record.manifestId !== "string" ||
      record.manifestId.length === 0 ||
      (record.manifestCoverage !== "verified-numeric-chapters" &&
       record.manifestCoverage !== "partial-before-ambiguous-chapter") ||
      typeof record.numberedChapterCount !== "number" ||
      !Number.isSafeInteger(record.numberedChapterCount) ||
      record.numberedChapterCount < 1 ||
      (record.status !== "in-progress" && record.status !== "completed") ||
      (record.currentChapter !== null &&
       (typeof record.currentChapter !== "number" ||
        !Number.isSafeInteger(record.currentChapter) ||
        record.currentChapter < 1)) ||
      (record.completedThroughChapter !== null &&
       (typeof record.completedThroughChapter !== "number" ||
        !Number.isSafeInteger(record.completedThroughChapter) ||
        record.completedThroughChapter < 1)) ||
      typeof record.completedThroughEntireWork !== "boolean" ||
      typeof record.progressRevision !== "number" ||
      !Number.isSafeInteger(record.progressRevision) ||
      record.progressRevision < 0 ||
      typeof record.progressFingerprint !== "string" ||
      !SHA256_PATTERN.test(record.progressFingerprint) ||
      record.authorizationEffect !== "none") return null;

  if (record.status === "completed") {
    if (record.currentChapter !== null ||
        record.completedThroughChapter !== null ||
        record.completedThroughEntireWork !== true) return null;
  } else {
    if (record.currentChapter === null ||
        record.completedThroughEntireWork !== false ||
        record.completedThroughChapter !== (record.currentChapter > 1 ? record.currentChapter - 1 : null)) {
      return null;
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    kind: "reader-focus",
    bookId: record.bookId,
    title: record.title,
    editionId: record.editionId,
    manifestId: record.manifestId,
    manifestCoverage: record.manifestCoverage,
    numberedChapterCount: record.numberedChapterCount,
    status: record.status,
    currentChapter: record.currentChapter,
    completedThroughChapter: record.completedThroughChapter,
    completedThroughEntireWork: record.completedThroughEntireWork,
    progressRevision: record.progressRevision,
    progressFingerprint: record.progressFingerprint,
    authorizationEffect: "none",
  });
}

function sameFocus(left: HoidReadingFocus, right: HoidReadingFocus): boolean {
  return FOCUS_KEYS.every(key => left[key] === right[key]);
}

/**
 * Resolve a single reading focus only when progress identifies exactly one
 * active work, or the caller explicitly selects one of several active works.
 * A focus is descriptive metadata, never a permission to disclose evidence.
 */
export function resolveHoidReadingFocus(input: unknown): HoidReadingFocusResolution {
  const request = canonicalRequest(input);
  if (!request) return Object.freeze({ status: "unavailable", reason: "invalid-request" });

  const validation = validateHoidCursorProgressSnapshot(request.progress);
  if (validation.status !== "valid") {
    return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  }
  const positions = validation.snapshot.positions;
  if (positions.length === 0) {
    return Object.freeze({ status: "unavailable", reason: "no-active-work" });
  }

  if (request.selectedBookId !== undefined) {
    const selected = positions.find(position => position.bookId === request.selectedBookId);
    if (!selected) {
      return Object.freeze({ status: "unavailable", reason: "selected-work-not-active" });
    }
    const focus = focusForPosition(selected, validation.snapshot);
    return focus
      ? Object.freeze({ status: "ready", focus })
      : Object.freeze({ status: "unavailable", reason: "chapter-structure-unavailable" });
  }

  if (positions.length > 1) {
    const choices = positions.map(choiceForPosition);
    if (choices.some(choice => choice === null)) {
      return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
    }
    return Object.freeze({
      status: "selection-required",
      reason: "multiple-active-works",
      choices: Object.freeze(choices as HoidReadingFocusChoice[]),
    });
  }

  const focus = focusForPosition(positions[0], validation.snapshot);
  return focus
    ? Object.freeze({ status: "ready", focus })
    : Object.freeze({ status: "unavailable", reason: "chapter-structure-unavailable" });
}

/** Revalidate a displayed focus against the current progress and edition manifest. */
export function validateHoidReadingFocus(
  focusInput: unknown,
  progress: unknown,
): HoidReadingFocusValidation {
  const focus = canonicalFocus(focusInput);
  if (!focus) return Object.freeze({ status: "invalid", reason: "invalid-focus" });

  if (validateHoidCursorProgressSnapshot(progress).status !== "valid") {
    return Object.freeze({ status: "invalid", reason: "invalid-progress" });
  }

  const resolved = resolveHoidReadingFocus({ progress, selectedBookId: focus.bookId });
  if (resolved.status !== "ready") {
    return Object.freeze({
      status: "stale",
      reason: resolved.reason === "selected-work-not-active" || resolved.reason === "no-active-work"
        ? "work-no-longer-active"
        : "edition-changed",
    });
  }

  return sameFocus(focus, resolved.focus)
    ? Object.freeze({ status: "valid", focus })
    : Object.freeze({ status: "stale", reason: "progress-changed" });
}
