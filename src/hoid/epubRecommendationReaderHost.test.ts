import { describe, expect, it, vi } from "vitest";
import { createHoidEditionBoundRecommendationPresentation } from "./editionBoundRecommendationPresentation";
import type {
  HoidEpubIngestionService,
  HoidEpubPackageInspectionCandidate,
  HoidEpubReadableChapter,
} from "./epubIngestion";
import { createHoidLocalEpubRecommendationReaderPort } from "./epubRecommendationReaderHost";
import {
  validateHoidCursorProgressSnapshot,
} from "./cursorProgressLedger";
import { fingerprintHoidCursorProgressSnapshot } from "./knowledgeGraph";
import { createHoidReadingCursor, validateHoidReadingCursor } from "./readingManifest";
import type { HoidRecommendationReaderOpenRequest } from "./recommendationReaderPort";

const UPDATED_AT = "2026-11-23T10:00:00.000Z";

function snapshotFor(bookId = "twok", chapterNumber = 21, revision = 1) {
  const created = createHoidReadingCursor(bookId, chapterNumber);
  if (created.status !== "ready") throw new Error("Cursor fixture unavailable");
  return {
    schemaVersion: 2 as const,
    revision,
    positions: [{ bookId, cursor: created.cursor }],
    updatedAt: UPDATED_AT,
  };
}

function requestFor(progress: unknown): Readonly<{
  request: HoidRecommendationReaderOpenRequest;
  workId: string;
  editionId: string;
  navigationHref: string;
}> {
  const presentation = createHoidEditionBoundRecommendationPresentation(progress, 1);
  if (presentation.status !== "ready" || presentation.items.length !== 1) {
    throw new Error("Recommendation fixture unavailable");
  }
  const target = presentation.items[0].target;
  if (target.kind !== "edition-cursor" || target.locatorStatus !== "verified" || !target.locatorId) {
    throw new Error("Verified chapter locator fixture unavailable");
  }
  const cursor = validateHoidReadingCursor(target.cursor);
  if (cursor.status !== "valid") throw new Error("Cursor fixture invalid");
  const validation = validateHoidCursorProgressSnapshot(progress);
  if (validation.status !== "valid") throw new Error("Progress fixture invalid");
  const identity = fingerprintHoidCursorProgressSnapshot(validation.snapshot);
  if (identity.status !== "ready") throw new Error("Progress identity unavailable");
  const prefix = "nav:" + target.editionId + ":" + target.navigationSha256 + ":";
  if (!target.locatorId.startsWith(prefix)) throw new Error("Locator prefix unavailable");

  return {
    request: Object.freeze({
      target: Object.freeze({
        cursor: cursor.cursor,
        manifestId: cursor.manifest.manifestId,
        editionId: target.editionId,
        navigationSha256: target.navigationSha256,
        locatorStatus: "verified",
        locatorId: target.locatorId,
      }),
      progressRevision: identity.revision,
      progressFingerprint: identity.sha256,
    }),
    workId: target.cursor.bookId,
    editionId: target.editionId,
    navigationHref: target.locatorId.slice(prefix.length),
  };
}

function readerContent(workId: string, editionId: string, navigationHref: string): HoidEpubReadableChapter {
  return Object.freeze({
    status: "reader-content",
    workId,
    editionId,
    navigationHref,
    documentSha256: "a".repeat(64),
    blocks: Object.freeze([Object.freeze({ kind: "paragraph" as const, text: "Synthetic reader fixture." })]),
    characterCount: 25,
  });
}

function packageCandidate(): HoidEpubPackageInspectionCandidate {
  return Object.freeze({ status: "candidate-only" }) as unknown as HoidEpubPackageInspectionCandidate;
}

function dependenciesFor(
  progress: unknown,
  navigationHref: string,
  overrides: Partial<{
    readChapterContent: HoidEpubIngestionService["readChapterContent"];
    refreshCurrentProgress: () => Promise<unknown>;
    isCurrent: () => boolean;
    getProgressChangeEpoch: () => number;
    onChapterOpened: (chapter: HoidEpubReadableChapter, chapterNumber: number) => void;
    workId: string;
  }> = {},
) {
  const candidate = packageCandidate();
  const readChapterContent = Object.prototype.hasOwnProperty.call(overrides, "readChapterContent")
    ? overrides.readChapterContent
    : vi.fn(async () => ({
        status: "candidate" as const,
        candidate: readerContent("twok", "roshar-omnibus-v1", navigationHref),
      }));
  const refreshCurrentProgress = overrides.refreshCurrentProgress ?? vi.fn(async () => progress);
  const isCurrent = overrides.isCurrent ?? vi.fn(() => true);
  const getProgressChangeEpoch = overrides.getProgressChangeEpoch ?? vi.fn(() => 0);
  const onChapterOpened = overrides.onChapterOpened ?? vi.fn();

  const port = createHoidLocalEpubRecommendationReaderPort({
    workId: overrides.workId ?? "twok",
    editionId: "roshar-omnibus-v1",
    packageCandidate: candidate,
    ingestion: { readChapterContent },
    refreshCurrentProgress,
    isCurrent,
    getProgressChangeEpoch,
    onChapterOpened,
  });
  return { port, candidate, readChapterContent, refreshCurrentProgress, onChapterOpened };
}

describe("local EPUB recommendation reader host", () => {
  it("opens only the exact verified chapter after two durable progress checks", async () => {
    const progress = snapshotFor();
    const request = requestFor(progress);
    const dependencies = dependenciesFor(progress, request.navigationHref);

    const result = await dependencies.port.openVerifiedChapter(request.request);

    expect(result).toEqual({
      status: "opened",
      bookId: request.workId,
      chapterNumber: request.request.target.cursor.chapterNumber,
      editionId: request.editionId,
      locatorId: request.request.target.locatorId,
    });
    expect(dependencies.refreshCurrentProgress).toHaveBeenCalledTimes(2);
    expect(dependencies.readChapterContent).toHaveBeenCalledWith(
      dependencies.candidate,
      request.navigationHref,
    );
    expect(dependencies.onChapterOpened).toHaveBeenCalledWith(
      expect.objectContaining({ status: "reader-content", workId: request.workId }),
      request.request.target.cursor.chapterNumber,
    );
  });

  it("rejects stale progress before reading any chapter bytes", async () => {
    const previous = snapshotFor("twok", 21, 1);
    const current = snapshotFor("twok", 22, 2);
    const request = requestFor(previous);
    const dependencies = dependenciesFor(previous, request.navigationHref, {
      refreshCurrentProgress: async () => current,
    });

    await expect(dependencies.port.openVerifiedChapter(request.request)).resolves.toEqual({
      status: "unavailable",
      reason: "stale-progress",
    });
    expect(dependencies.readChapterContent).not.toHaveBeenCalled();
    expect(dependencies.onChapterOpened).not.toHaveBeenCalled();
  });

  it("discards content if progress changes during the local chapter read", async () => {
    const previous = snapshotFor("twok", 21, 1);
    const current = snapshotFor("twok", 22, 2);
    const request = requestFor(previous);
    let refreshCount = 0;
    const dependencies = dependenciesFor(previous, request.navigationHref, {
      refreshCurrentProgress: async () => {
        refreshCount += 1;
        return refreshCount === 1 ? previous : current;
      },
    });

    await expect(dependencies.port.openVerifiedChapter(request.request)).resolves.toEqual({
      status: "unavailable",
      reason: "stale-progress",
    });
    expect(dependencies.readChapterContent).toHaveBeenCalledTimes(1);
    expect(dependencies.onChapterOpened).not.toHaveBeenCalled();
  });

  it("discards content when a progress-change notification races the final presentation", async () => {
    const progress = snapshotFor();
    const request = requestFor(progress);
    let epoch = 0;
    const dependencies = dependenciesFor(progress, request.navigationHref, {
      getProgressChangeEpoch: () => {
        epoch += 1;
        return epoch === 1 ? 0 : 1;
      },
    });

    await expect(dependencies.port.openVerifiedChapter(request.request)).resolves.toEqual({
      status: "unavailable",
      reason: "stale-progress",
    });
    expect(dependencies.onChapterOpened).not.toHaveBeenCalled();
  });

  it("honors caller cancellation while the chapter bytes are being read", async () => {
    const progress = snapshotFor();
    const request = requestFor(progress);
    const controller = new AbortController();
    let resolveRead: (value: unknown) => void = () => {};
    const pendingRead = new Promise<unknown>(resolve => { resolveRead = resolve; });
    const dependencies = dependenciesFor(progress, request.navigationHref, {
      readChapterContent: vi.fn(() => pendingRead) as HoidEpubIngestionService["readChapterContent"],
    });
    const operation = dependencies.port.openVerifiedChapter({
      ...request.request,
      signal: controller.signal,
    });

    controller.abort();
    resolveRead({
      status: "candidate",
      candidate: readerContent(request.workId, request.editionId, request.navigationHref),
    });

    await expect(operation).resolves.toEqual({ status: "unavailable", reason: "cancelled" });
    expect(dependencies.onChapterOpened).not.toHaveBeenCalled();
  });

  it("refuses a host whose source lease is no longer current", async () => {
    const progress = snapshotFor();
    const request = requestFor(progress);
    const dependencies = dependenciesFor(progress, request.navigationHref, {
      isCurrent: () => false,
    });

    await expect(dependencies.port.openVerifiedChapter(request.request)).resolves.toEqual({
      status: "unavailable",
      reason: "reader-unavailable",
    });
    expect(dependencies.readChapterContent).not.toHaveBeenCalled();
  });

  it("rejects a target belonging to another selected work", async () => {
    const progress = snapshotFor();
    const request = requestFor(progress);
    const dependencies = dependenciesFor(progress, request.navigationHref, {
      workId: "elantris",
    });

    await expect(dependencies.port.openVerifiedChapter(request.request)).resolves.toEqual({
      status: "unavailable",
      reason: "edition-unavailable",
    });
    expect(dependencies.readChapterContent).not.toHaveBeenCalled();
  });

  it("fails closed when the ingestion adapter has no readable-content capability", async () => {
    const progress = snapshotFor();
    const request = requestFor(progress);
    const dependencies = dependenciesFor(progress, request.navigationHref, {
      readChapterContent: undefined,
    });

    await expect(dependencies.port.openVerifiedChapter(request.request)).resolves.toEqual({
      status: "unavailable",
      reason: "reader-unavailable",
    });
    expect(dependencies.onChapterOpened).not.toHaveBeenCalled();
  });
});
