import type {
  HoidEpubIngestionService,
  HoidEpubPackageInspectionCandidate,
  HoidEpubReadableChapter,
} from "./epubIngestion";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { validateHoidReadingCursor } from "./readingManifest";
import type {
  HoidRecommendationReaderOpenRequest,
  HoidRecommendationReaderPort,
} from "./recommendationReaderPort";

export type HoidReaderProgressBinding = Readonly<{
  revision: number;
  fingerprint: string;
}>;

export type HoidLocalEpubRecommendationReaderHostDependencies = Readonly<{
  workId: string;
  editionId: string;
  packageCandidate: HoidEpubPackageInspectionCandidate;
  ingestion: Pick<HoidEpubIngestionService, "readChapterContent">;
  /** Must read the authoritative SQLite-backed snapshot, not a cached React value. */
  refreshCurrentProgress: () => Promise<unknown>;
  /** False after source release, screen unmount or a newer import operation. */
  isCurrent: () => boolean;
  /** Monotonic in-memory epoch incremented by progress-change notifications. */
  getProgressChangeEpoch: () => number;
  onChapterOpened: (
    chapter: HoidEpubReadableChapter,
    chapterNumber: number,
    progressBinding: HoidReaderProgressBinding,
  ) => void;
}>;

function isAborted(signal: AbortSignal | undefined): boolean {
  try {
    return signal?.aborted === true;
  } catch {
    return true;
  }
}

function canonicalDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length < requiredKeys.length ||
      keys.length > allowedKeys.length ||
      keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))
    ) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        descriptor === undefined ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    if (!requiredKeys.every(key => Object.prototype.hasOwnProperty.call(result, key))) return null;
    return result;
  } catch {
    return null;
  }
}

function progressMatches(
  value: unknown,
  expectedRevision: number,
  expectedFingerprint: string,
): boolean {
  const projection = value === null || value === undefined
    ? null
    : projectHoidCursorProgressSnapshot(value);
  return projection?.status === "ready" &&
    projection.revision === expectedRevision &&
    fingerprintHoidCursorProgressProjection(projection) === expectedFingerprint;
}

/**
 * Build a local EPUB host for the provider-neutral recommendation reader port.
 *
 * The host resolves the opaque locator only against the exact validated
 * manifest, reads one XHTML chapter through the local ingestion service, and
 * displays nothing until a second durable progress read and the change-event
 * epoch both confirm that the recommendation is still current.
 */
export function createHoidLocalEpubRecommendationReaderPort(
  dependencies: HoidLocalEpubRecommendationReaderHostDependencies,
): HoidRecommendationReaderPort {
  // Latest-open-wins: two callers may share one host even when the UI normally
  // disables duplicate taps. An older asynchronous read must never replace a
  // chapter opened by a newer request.
  let latestOpenAttempt = 0;
  return Object.freeze({
    async openVerifiedChapter(request: HoidRecommendationReaderOpenRequest): Promise<unknown> {
      const openAttempt = ++latestOpenAttempt;
      const isLatestOpenAttempt = () => openAttempt === latestOpenAttempt;
      let signal: AbortSignal | undefined;
      let progressEpoch: number;
      try {
        const requestRecord = canonicalDataRecord(
          request,
          ["target", "progressRevision", "progressFingerprint", "signal"],
          ["target", "progressRevision", "progressFingerprint"],
        );
        if (!requestRecord) return { status: "unavailable", reason: "edition-unavailable" };
        const targetRecord = canonicalDataRecord(
          requestRecord.target,
          ["cursor", "manifestId", "editionId", "navigationSha256", "locatorStatus", "locatorId"],
          ["cursor", "manifestId", "editionId", "navigationSha256", "locatorStatus", "locatorId"],
        );
        if (!targetRecord) return { status: "unavailable", reason: "edition-unavailable" };
        signal = requestRecord.signal as AbortSignal | undefined;
        const progressRevision = requestRecord.progressRevision;
        const progressFingerprint = requestRecord.progressFingerprint;
        if (isAborted(signal)) return { status: "unavailable", reason: "cancelled" };
        if (!dependencies.isCurrent()) return { status: "unavailable", reason: "reader-unavailable" };
        progressEpoch = dependencies.getProgressChangeEpoch();

        if (
          typeof targetRecord.editionId !== "string" ||
          targetRecord.editionId !== dependencies.editionId ||
          targetRecord.locatorStatus !== "verified" ||
          typeof targetRecord.locatorId !== "string" ||
          targetRecord.locatorId.length === 0 ||
          !Number.isSafeInteger(progressRevision) ||
          (progressRevision as number) < 0 ||
          typeof progressFingerprint !== "string" ||
          !/^[a-f0-9]{64}$/.test(progressFingerprint)
        ) return { status: "unavailable", reason: "edition-unavailable" };

        const cursor = validateHoidReadingCursor(targetRecord.cursor);
        if (cursor.status !== "valid" || cursor.cursor.bookId !== dependencies.workId) {
          return { status: "unavailable", reason: "edition-unavailable" };
        }
        const manifest = cursor.manifest;
        if (
          targetRecord.manifestId !== manifest.manifestId ||
          targetRecord.editionId !== manifest.editionId ||
          targetRecord.navigationSha256 !== manifest.navigationSha256
        ) return { status: "unavailable", reason: "edition-unavailable" };

        const unit = manifest.units.find(candidate =>
          candidate.id === cursor.cursor.unitId &&
          candidate.ordinal === cursor.cursor.ordinal &&
          candidate.chapterNumber === cursor.cursor.chapterNumber
        );
        if (!unit?.locatorId || unit.locatorId !== targetRecord.locatorId) {
          return { status: "unavailable", reason: "locator-unavailable" };
        }

        const prefix = "nav:" + manifest.editionId + ":" + manifest.navigationSha256 + ":";
        if (!(targetRecord.locatorId as string).startsWith(prefix)) {
          return { status: "unavailable", reason: "locator-unavailable" };
        }
        const navigationHref = (targetRecord.locatorId as string).slice(prefix.length);
        if (navigationHref.length === 0 || navigationHref.length > 4096) {
          return { status: "unavailable", reason: "locator-unavailable" };
        }

        const before = await dependencies.refreshCurrentProgress();
        if (isAborted(signal)) return { status: "unavailable", reason: "cancelled" };
        if (!isLatestOpenAttempt()) return { status: "unavailable", reason: "superseded" };
        if (!progressMatches(before, progressRevision as number, progressFingerprint as string)) {
          return { status: "unavailable", reason: "stale-progress" };
        }

        const readChapterContent = dependencies.ingestion.readChapterContent;
        if (typeof readChapterContent !== "function") {
          return { status: "unavailable", reason: "reader-unavailable" };
        }
        const read = await readChapterContent.call(
          dependencies.ingestion,
          dependencies.packageCandidate,
          navigationHref,
        );
        if (isAborted(signal)) return { status: "unavailable", reason: "cancelled" };
        if (!isLatestOpenAttempt()) return { status: "unavailable", reason: "superseded" };
        if (read.status !== "candidate") {
          return { status: "unavailable", reason: "locator-unavailable" };
        }
        if (
          read.candidate.status !== "reader-content" ||
          read.candidate.workId !== dependencies.workId ||
          read.candidate.editionId !== dependencies.editionId ||
          read.candidate.navigationHref !== navigationHref ||
          !/^[a-f0-9]{64}$/.test(read.candidate.documentSha256) ||
          read.candidate.blocks.length === 0 ||
          read.candidate.characterCount <= 0
        ) return { status: "unavailable", reason: "locator-unavailable" };

        const after = await dependencies.refreshCurrentProgress();
        if (isAborted(signal)) return { status: "unavailable", reason: "cancelled" };
        if (!isLatestOpenAttempt()) return { status: "unavailable", reason: "superseded" };
        if (!progressMatches(after, progressRevision as number, progressFingerprint as string)) {
          return { status: "unavailable", reason: "stale-progress" };
        }
        if (dependencies.getProgressChangeEpoch() !== progressEpoch) {
          return { status: "unavailable", reason: "stale-progress" };
        }
        if (!dependencies.isCurrent()) {
          return { status: "unavailable", reason: "reader-unavailable" };
        }
        if (isAborted(signal)) return { status: "unavailable", reason: "cancelled" };
        if (!isLatestOpenAttempt()) return { status: "unavailable", reason: "superseded" };

        dependencies.onChapterOpened(
          read.candidate,
          cursor.cursor.chapterNumber,
          Object.freeze({
            revision: progressRevision as number,
            fingerprint: progressFingerprint as string,
          }),
        );
        return Object.freeze({
          status: "opened",
          bookId: dependencies.workId,
          chapterNumber: cursor.cursor.chapterNumber,
          editionId: dependencies.editionId,
          locatorId: targetRecord.locatorId as string,
        });
      } catch {
        return {
          status: "unavailable",
          reason: isAborted(signal) ? "cancelled" : "failed",
        };
      }
    },
  });
}
