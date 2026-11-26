import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  projectHoidCursorProgressSnapshot,
} from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./cursorProgressFingerprint";
import { validateHoidCursorProgressSnapshot } from "./cursorProgressLedger";
import { getHoidReadingManifest } from "./readingManifest";

export type HoidRereadRequestResult =
  | Readonly<{ status: "not-request" }>
  | Readonly<{
      status: "needs-clarification";
      reason: "work-not-mentioned" | "multiple-works-mentioned";
    }>
  | Readonly<{
      status: "ready";
      sourceId: string;
      title: string;
      startChapter: 1;
      selection: "manual-reader-selection-required";
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "not-completed";
      reason: "not-started" | "in-progress";
      sourceId: string;
      title: string;
      currentChapter?: number;
      completedThroughChapter?: number | null;
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "blocked";
      reason: "invalid-question" | "invalid-progress" | "segmentation-unverified";
    }>;

const MAX_QUESTION_LENGTH = 4_000;
const REREAD_CUES = Object.freeze([
  "quiero releer",
  "me gustaria releer",
  "me apetece releer",
  "volver a leer",
  "leer de nuevo",
  "releer",
]);

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\\p{M}\\p{Cf}]/gu, "")
    .toLowerCase()
    .replace(/[^\\p{L}\\p{N}]+/gu, " ")
    .trim();
}

function hasCue(question: string): boolean {
  const padded = ` ${question} `;
  return REREAD_CUES.some(cue => padded.includes(` ${cue} `));
}

function matchingWorks(question: string) {
  const padded = ` ${question} `;
  return HOID_SOURCE_BIBLIOGRAPHY.filter(work => {
    const title = normalize(work.title);
    return title.length > 0 && padded.includes(` ${title} `);
  });
}

/**
 * Resolve an explicit re-reading request using only the metadata bibliography
 * and the authoritative cursor-progress snapshot.
 *
 * A re-read is never inferred from a completed work: the reader must ask for
 * it and name exactly one catalogued title. The result is a manual-selection
 * hint only; it contains no EPUB locator, chapter content or navigation token,
 * and it never changes the progress ledger.
 */
export function resolveHoidRereadRequest(
  questionInput: unknown,
  progressInput: unknown,
): HoidRereadRequestResult {
  if (
    typeof questionInput !== "string" ||
    questionInput.length < 1 ||
    questionInput.length > MAX_QUESTION_LENGTH ||
    questionInput !== questionInput.trim() ||
    /[\\u0000-\\u001f\\u007f\\p{Cf}]/u.test(questionInput)
  ) {
    return Object.freeze({ status: "blocked", reason: "invalid-question" });
  }

  let question: string;
  try {
    question = normalize(questionInput);
  } catch {
    return Object.freeze({ status: "blocked", reason: "invalid-question" });
  }
  if (!question) return Object.freeze({ status: "blocked", reason: "invalid-question" });
  if (!hasCue(question)) return Object.freeze({ status: "not-request" });

  const matches = matchingWorks(question);
  if (matches.length === 0) {
    return Object.freeze({ status: "needs-clarification", reason: "work-not-mentioned" });
  }
  if (matches.length !== 1) {
    return Object.freeze({ status: "needs-clarification", reason: "multiple-works-mentioned" });
  }

  const validation = validateHoidCursorProgressSnapshot(progressInput);
  if (validation.status !== "valid") {
    return Object.freeze({ status: "blocked", reason: "invalid-progress" });
  }
  const projection = projectHoidCursorProgressSnapshot(validation.snapshot);
  if (projection.status !== "ready") {
    return Object.freeze({ status: "blocked", reason: "invalid-progress" });
  }

  const progressRevision = projection.revision;
  const progressFingerprint = fingerprintHoidCursorProgressProjection(projection);
  const work = matches[0];
  const position = validation.snapshot.positions.find(candidate => candidate.bookId === work.id);

  if (!position) {
    return Object.freeze({
      status: "not-completed",
      reason: "not-started",
      sourceId: work.id,
      title: work.title,
      progressRevision,
      progressFingerprint,
    });
  }

  if ("cursor" in position) {
    const manifestResult = getHoidReadingManifest(work.id);
    if (manifestResult.status !== "ready") {
      return Object.freeze({ status: "blocked", reason: "segmentation-unverified" });
    }
    const currentIndex = manifestResult.manifest.units.findIndex(unit =>
      unit.id === position.cursor.unitId &&
      unit.ordinal === position.cursor.ordinal &&
      unit.chapterNumber === position.cursor.chapterNumber
    );
    if (currentIndex < 0) {
      return Object.freeze({ status: "blocked", reason: "segmentation-unverified" });
    }
    const completedThroughChapter = currentIndex === 0
      ? null
      : manifestResult.manifest.units[currentIndex - 1]?.chapterNumber ?? null;
    return Object.freeze({
      status: "not-completed",
      reason: "in-progress",
      sourceId: work.id,
      title: work.title,
      currentChapter: position.cursor.chapterNumber,
      completedThroughChapter,
      progressRevision,
      progressFingerprint,
    });
  }

  const manifestResult = getHoidReadingManifest(work.id);
  if (
    manifestResult.status !== "ready" ||
    manifestResult.manifest.units[0]?.chapterNumber !== 1 ||
    manifestResult.manifest.units[0]?.ordinal !== 1
  ) {
    return Object.freeze({ status: "blocked", reason: "segmentation-unverified" });
  }

  return Object.freeze({
    status: "ready",
    sourceId: work.id,
    title: work.title,
    startChapter: 1,
    selection: "manual-reader-selection-required",
    progressRevision,
    progressFingerprint,
  });
}
