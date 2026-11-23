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
  onChapterOpened: (chapter: HoidEpubReadableChapter, chapterNumber: number) => void;
}>;

function isAborted(signal: AbortSignal | undefined): boolean {
  try {
    return signal?.aborted === true;
  } catch {
    return true;
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
  return Object.freeze({
    async openVerifiedChapter(request: HoidRecommendationReaderOpenRequest): Promise<unknown> {
      const signal = request.signal;
      let progressEpoch: number;
      try {
        if (isAborted(signal)) return { status: "unavailable", reason: "cancelled" };
        if (!dependencies.isCurrent()) return { status: "unavailable", reason: "reader-unavailable" };
        progressEpoch = dependencies.getProgressChangeEpoch();

        if (
          request.target.cursor.bookId !== dependencies.workId ||
          request.target.editionId !== dependencies.editionId ||
          request.target.locatorStatus !== "verified" ||
          typeof request.target.locatorId !== "string" ||
          request.target.locatorId.length === 0 ||
          !Number.isSafeInteger(request.progressRevision) ||
          request.progressRevision < 0 ||
          !/^[a-f0-9]{64}$/.test(request.progressFingerprint)
        ) return { status: "unavailable", reason: "edition-unavailable" };

        const cursor = validateHoidReadingCursor(request.target.cursor);
        if (cursor.status !== "valid") return { status: "unavailable", reason: "locator-unavailable" };
        const manifest = cursor.manifest;
        if (
          request.target.manifestId !== manifest.manifestId ||
          request.target.editionId !== manifest.editionId ||
          request.target.navigationSha256 !== manifest.navigationSha256
        ) return { status: "unavailable", reason: "edition-unavailable" };

        const unit = manifest.units.find(candidate =>
          candidate.id === cursor.cursor.unitId &&
          candidate.ordinal === cursor.cursor.ordinal &&
          candidate.chapterNumber === cursor.cursor.chapterNumber
        );
        if (!unit?.locatorId || unit.locatorId !== request.target.locatorId) {
          return { status: "unavailable", reason: "locator-unavailable" };
        }

        const prefix = "nav:" + manifest.editionId + ":" + manifest.navigationSha256 + ":";
        if (!request.target.locatorId.startsWith(prefix)) {
          return { status: "unavailable", reason: "locator-unavailable" };
        }
        const navigationHref = request.target.locatorId.slice(prefix.length);
        if (navigationHref.length === 0 || navigationHref.length > 4096) {
          return { status: "unavailable", reason: "locator-unavailable" };
        }

        const before = await dependencies.refreshCurrentProgress();
        if (isAborted(signal)) return { status: "unavailable", reason: "cancelled" };
        if (!progressMatches(before, request.progressRevision, request.progressFingerprint)) {
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
        if (!progressMatches(after, request.progressRevision, request.progressFingerprint)) {
          return { status: "unavailable", reason: "stale-progress" };
        }
        if (dependencies.getProgressChangeEpoch() !== progressEpoch) {
          return { status: "unavailable", reason: "stale-progress" };
        }
        if (!dependencies.isCurrent()) {
          return { status: "unavailable", reason: "reader-unavailable" };
        }
        if (isAborted(signal)) return { status: "unavailable", reason: "cancelled" };

        dependencies.onChapterOpened(read.candidate, cursor.cursor.chapterNumber);
        return Object.freeze({
          status: "opened",
          bookId: dependencies.workId,
          chapterNumber: cursor.cursor.chapterNumber,
          editionId: dependencies.editionId,
          locatorId: request.target.locatorId,
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
