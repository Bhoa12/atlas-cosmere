import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import type {
  HoidEditorialSourceDocumentAccessPort,
  HoidEditorialSourceDocumentAccessRequest,
} from "./editorialClaimPromotionPreflight";
import { getHoidReadingManifest } from "./readingManifest";
import {
  getVerifiedChapterDocumentNumbers,
  getVerifiedChapterDocumentSha256,
} from "./verifiedChapterDocuments";
import { getVerifiedChapterLocatorId } from "./verifiedChapterLocators";

export type HoidEpubEditorialSourceCoverageAuditProgress = Readonly<{
  workId: string;
  checkedChapterCount: number;
  totalAllowlistedChapterCount: number;
  availableChapterCount: number;
  unavailableChapterCount: number;
}>;

export type HoidEpubEditorialSourceCoverageAuditResult =
  | Readonly<{
      status: "completed";
      workId: string;
      scope: "registered-digest-chapters-only";
      totalAllowlistedChapterCount: number;
      checkedChapterCount: number;
      availableChapterNumbers: readonly number[];
      unavailableChapterNumbers: readonly number[];
      sourceTextReturned: false;
      sourceTextPersisted: false;
      providerEgress: "none";
    }>
  | Readonly<{
      status: "unavailable";
      reason: "unknown-work" | "manifest-unavailable" | "no-verified-chapters" | "invalid-port";
    }>
  | Readonly<{
      status: "cancelled";
      workId: string;
      checkedChapterCount: number;
    }>;

type InspectChapter = HoidEditorialSourceDocumentAccessPort["inspectChapter"];

function getSafeInspectMethod(port: unknown): InspectChapter | null {
  try {
    if (port === null || typeof port !== "object" || Array.isArray(port)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(port, "inspectChapter");
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      typeof descriptor.value !== "function"
    ) return null;
    return descriptor.value.bind(port) as InspectChapter;
  } catch {
    return null;
  }
}

function exactAvailableDigest(value: unknown, expectedDigest: string): boolean {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 2 || !keys.includes("status") || !keys.includes("documentSha256")) return false;
    const status = Object.getOwnPropertyDescriptor(value, "status");
    const digest = Object.getOwnPropertyDescriptor(value, "documentSha256");
    return Boolean(
      status &&
      digest &&
      Object.prototype.hasOwnProperty.call(status, "value") &&
      Object.prototype.hasOwnProperty.call(digest, "value") &&
      status.enumerable === true &&
      digest.enumerable === true &&
      status.value === "available" &&
      digest.value === expectedDigest
    );
  } catch {
    return false;
  }
}

function isAborted(signal: AbortSignal): boolean {
  try {
    return signal.aborted === true;
  } catch {
    return true;
  }
}

function emitProgress(
  callback: ((progress: HoidEpubEditorialSourceCoverageAuditProgress) => void) | undefined,
  progress: HoidEpubEditorialSourceCoverageAuditProgress,
): void {
  if (typeof callback !== "function") return;
  try {
    callback(Object.freeze({ ...progress }));
  } catch {
    // UI observers cannot alter or interrupt the source audit.
  }
}

/**
 * Rechecks only chapter documents whose SHA-256 digest is already registered
 * in the reviewed sparse allowlist. It never expands that allowlist, creates
 * receipts, reads progress, or authorizes narrative answers.
 *
 * The local source port returns only an availability state and matching
 * digest. Every other shape, exception, stale source or digest mismatch is
 * counted as unavailable. Cancellation discards the partial projection.
 */
export async function auditHoidEpubEditorialSourceCoverage(
  portInput: unknown,
  workIdInput: unknown,
  signal: AbortSignal,
  onProgress?: (progress: HoidEpubEditorialSourceCoverageAuditProgress) => void,
): Promise<HoidEpubEditorialSourceCoverageAuditResult> {
  if (
    typeof workIdInput !== "string" ||
    !HOID_SOURCE_BIBLIOGRAPHY.some(work => work.id === workIdInput)
  ) return Object.freeze({ status: "unavailable", reason: "unknown-work" });

  const inspectChapter = getSafeInspectMethod(portInput);
  if (!inspectChapter) return Object.freeze({ status: "unavailable", reason: "invalid-port" });

  const manifestResult = getHoidReadingManifest(workIdInput);
  if (manifestResult.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: "manifest-unavailable" });
  }
  const manifest = manifestResult.manifest;

  let chapterNumbers: readonly number[];
  try {
    chapterNumbers = getVerifiedChapterDocumentNumbers(workIdInput);
  } catch {
    return Object.freeze({ status: "unavailable", reason: "manifest-unavailable" });
  }
  if (chapterNumbers.length === 0) {
    return Object.freeze({ status: "unavailable", reason: "no-verified-chapters" });
  }
  if (
    chapterNumbers.some(number => !Number.isSafeInteger(number) || number < 1) ||
    new Set(chapterNumbers).size !== chapterNumbers.length
  ) return Object.freeze({ status: "unavailable", reason: "manifest-unavailable" });

  const available: number[] = [];
  const unavailable: number[] = [];
  let checked = 0;

  const report = () => emitProgress(onProgress, {
    workId: workIdInput,
    checkedChapterCount: checked,
    totalAllowlistedChapterCount: chapterNumbers.length,
    availableChapterCount: available.length,
    unavailableChapterCount: unavailable.length,
  });

  if (isAborted(signal)) {
    return Object.freeze({ status: "cancelled", workId: workIdInput, checkedChapterCount: checked });
  }

  for (const chapterNumber of chapterNumbers) {
    if (isAborted(signal)) {
      return Object.freeze({ status: "cancelled", workId: workIdInput, checkedChapterCount: checked });
    }

    const expectedDigest = getVerifiedChapterDocumentSha256(
      workIdInput,
      manifest.editionId,
      manifest.navigationSha256,
      chapterNumber,
    );
    const locatorId = getVerifiedChapterLocatorId(
      workIdInput,
      manifest.editionId,
      manifest.navigationSha256,
      chapterNumber,
    );
    const matchingUnits = manifest.units.filter(unit =>
      unit.chapterNumber === chapterNumber && unit.locatorId === locatorId,
    );

    if (
      expectedDigest === null ||
      locatorId === null ||
      matchingUnits.length !== 1
    ) {
      unavailable.push(chapterNumber);
      checked += 1;
      report();
      continue;
    }

    const request: HoidEditorialSourceDocumentAccessRequest = Object.freeze({
      bookId: workIdInput,
      editionId: manifest.editionId,
      navigationSha256: manifest.navigationSha256,
      chapterNumber,
      locatorId,
      expectedDocumentSha256: expectedDigest,
    });

    let response: unknown;
    try {
      response = await inspectChapter(request, { signal });
    } catch {
      response = null;
    }

    if (isAborted(signal)) {
      return Object.freeze({ status: "cancelled", workId: workIdInput, checkedChapterCount: checked });
    }

    if (exactAvailableDigest(response, expectedDigest)) available.push(chapterNumber);
    else unavailable.push(chapterNumber);

    checked += 1;
    report();
  }

  return Object.freeze({
    status: "completed",
    workId: workIdInput,
    scope: "registered-digest-chapters-only",
    totalAllowlistedChapterCount: chapterNumbers.length,
    checkedChapterCount: checked,
    availableChapterNumbers: Object.freeze(available),
    unavailableChapterNumbers: Object.freeze(unavailable),
    sourceTextReturned: false,
    sourceTextPersisted: false,
    providerEgress: "none",
  });
}
