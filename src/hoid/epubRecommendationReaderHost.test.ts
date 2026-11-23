import { describe, expect, it, vi } from "vitest";
import { createHoidEditionBoundRecommendationPresentation } from "./editionBoundRecommendationPresentation";
import type {
  HoidEpubIngestionService,
  HoidEpubPackageInspectionCandidate,
  HoidEpubReadableChapter,
} from "./epubIngestion";
import {
  createHoidLocalEpubRecommendationReaderPort,
  type HoidReaderProgressBinding,
} from "./epubRecommendationReaderHost";
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
    sessionSignal: AbortSignal;
    onChapterOpened: (
      chapter: HoidEpubReadableChapter,
      chapterNumber: number,
      progressBinding: HoidReaderProgressBinding,
    ) => void;
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
    ...(overrides.sessionSignal ? { sessionSignal: overrides.sessionSignal } : {}),
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
      expect.any(AbortSignal),
    );
    expect(dependencies.onChapterOpened).toHaveBeenCalledWith(
      expect.objectContaining({ status: "reader-content", workId: request.workId }),
      request.request.target.cursor.chapterNumber,
      {
        revision: request.request.progressRevision,
        fingerprint: request.request.progressFingerprint,
      },
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
    let markReadStarted: () => void = () => {};
    const readStarted = new Promise<void>(resolve => { markReadStarted = resolve; });
    const pendingRead = new Promise<unknown>(resolve => { resolveRead = resolve; });
    let receivedSignal: AbortSignal | undefined;
    const dependencies = dependenciesFor(progress, request.navigationHref, {
      readChapterContent: vi.fn((
        _candidate: HoidEpubPackageInspectionCandidate,
        _href: string,
        signal?: AbortSignal,
      ) => {
        receivedSignal = signal;
        markReadStarted();
        return pendingRead;
      }) as HoidEpubIngestionService["readChapterContent"],
    });
    const operation = dependencies.port.openVerifiedChapter({
      ...request.request,
      signal: controller.signal,
    });

    await readStarted;
    controller.abort();
    resolveRead({
      status: "candidate",
      candidate: readerContent(request.workId, request.editionId, request.navigationHref),
    });

    await expect(operation).resolves.toEqual({ status: "unavailable", reason: "cancelled" });
    expect(dependencies.readChapterContent).toHaveBeenCalledTimes(1);
    expect(dependencies.readChapterContent).toHaveBeenCalledWith(
      dependencies.candidate,
      request.navigationHref,
      expect.any(AbortSignal),
    );
    expect(receivedSignal).not.toBe(controller.signal);
    expect(receivedSignal?.aborted).toBe(true);
    expect(dependencies.onChapterOpened).not.toHaveBeenCalled();
  });

  it("aborts an in-flight chapter read when its source session is invalidated", async () => {
    const progress = snapshotFor();
    const request = requestFor(progress);
    const session = new AbortController();
    const caller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    let resolveRead: (value: unknown) => void = () => {};
    let markStarted: () => void = () => {};
    const started = new Promise<void>(resolve => { markStarted = resolve; });
    const pendingRead = new Promise<unknown>(resolve => { resolveRead = resolve; });
    const dependencies = dependenciesFor(progress, request.navigationHref, {
      sessionSignal: session.signal,
      readChapterContent: vi.fn((
        _candidate: HoidEpubPackageInspectionCandidate,
        _href: string,
        signal?: AbortSignal,
      ) => {
        receivedSignal = signal;
        markStarted();
        return pendingRead;
      }) as HoidEpubIngestionService["readChapterContent"],
    });
    const operation = dependencies.port.openVerifiedChapter({
      ...request.request,
      signal: caller.signal,
    });

    await started;
    expect(receivedSignal).toBeDefined();
    expect(receivedSignal).not.toBe(caller.signal);
    expect(receivedSignal).not.toBe(session.signal);
    session.abort();
    expect(receivedSignal?.aborted).toBe(true);
    resolveRead({
      status: "candidate",
      candidate: readerContent(request.workId, request.editionId, request.navigationHref),
    });

    await expect(operation).resolves.toEqual({ status: "unavailable", reason: "cancelled" });
    expect(dependencies.onChapterOpened).not.toHaveBeenCalled();
  });

  it("rejects accessor and Proxy requests without invoking getters", async () => {
    const progress = snapshotFor();
    const request = requestFor(progress);
    const dependencies = dependenciesFor(progress, request.navigationHref);
    let getterCalls = 0;
    const accessor = {
      progressRevision: request.request.progressRevision,
      progressFingerprint: request.request.progressFingerprint,
    };
    Object.defineProperty(accessor, "target", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return request.request.target;
      },
    });
    await expect(dependencies.port.openVerifiedChapter(accessor as unknown as HoidRecommendationReaderOpenRequest))
      .resolves.toEqual({ status: "unavailable", reason: "edition-unavailable" });
    expect(getterCalls).toBe(0);

    const hostile = new Proxy({}, { ownKeys() { throw new Error("proxy trap"); } });
    await expect(dependencies.port.openVerifiedChapter(hostile as HoidRecommendationReaderOpenRequest))
      .resolves.toEqual({ status: "unavailable", reason: "edition-unavailable" });
    expect(dependencies.readChapterContent).not.toHaveBeenCalled();
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

  it("aborts an older in-flight chapter read when a newer open starts", async () => {
    const progress = snapshotFor();
    const request = requestFor(progress);
    let firstSignal: AbortSignal | undefined;
    let markFirstReadStarted: () => void = () => {};
    const firstReadStarted = new Promise<void>(resolve => {
      markFirstReadStarted = resolve;
    });
    let readCount = 0;
    const readChapterContent = vi.fn((
      _candidate: HoidEpubPackageInspectionCandidate,
      _href: string,
      signal?: AbortSignal,
    ) => {
      readCount += 1;
      if (readCount === 1) {
        firstSignal = signal;
        markFirstReadStarted();
        return new Promise(resolve => {
          const finish = () => resolve({ status: "rejected" as const, reason: "cancelled" as const });
          if (signal?.aborted) finish();
          else signal?.addEventListener("abort", finish, { once: true });
        });
      }
      return Promise.resolve({
        status: "candidate" as const,
        candidate: readerContent(request.workId, request.editionId, request.navigationHref),
      });
    }) as HoidEpubIngestionService["readChapterContent"];
    const dependencies = dependenciesFor(progress, request.navigationHref, {
      readChapterContent,
    });

    const olderOperation = dependencies.port.openVerifiedChapter(request.request);
    await firstReadStarted;
    expect(firstSignal?.aborted).toBe(false);

    const newerOperation = dependencies.port.openVerifiedChapter(request.request);
    expect(firstSignal?.aborted).toBe(true);
    const newerResult = await newerOperation;
    expect(newerResult).toEqual({
      status: "opened",
      bookId: request.workId,
      chapterNumber: request.request.target.cursor.chapterNumber,
      editionId: request.editionId,
      locatorId: request.request.target.locatorId,
    });
    await expect(olderOperation).resolves.toEqual({
      status: "unavailable",
      reason: "superseded",
    });
    expect(readCount).toBe(2);
    expect(dependencies.onChapterOpened).toHaveBeenCalledTimes(1);
  });

  it("does not let a malformed request supersede a valid open", async () => {
    const progress = snapshotFor();
    const request = requestFor(progress);
    let firstSignal: AbortSignal | undefined;
    let resolveFirstRead: (value: unknown) => void = () => {};
    let markFirstReadStarted: () => void = () => {};
    const firstReadStarted = new Promise<void>(resolve => {
      markFirstReadStarted = resolve;
    });
    const firstRead = new Promise<unknown>(resolve => {
      resolveFirstRead = resolve;
    });
    const readChapterContent = vi.fn((
      _candidate: HoidEpubPackageInspectionCandidate,
      _href: string,
      signal?: AbortSignal,
    ) => {
      firstSignal = signal;
      markFirstReadStarted();
      return firstRead;
    }) as HoidEpubIngestionService["readChapterContent"];
    const dependencies = dependenciesFor(progress, request.navigationHref, {
      readChapterContent,
    });

    const validOperation = dependencies.port.openVerifiedChapter(request.request);
    await firstReadStarted;
    const malformed = new Proxy({}, {
      ownKeys() { throw new Error("synthetic request trap"); },
    });
    await expect(dependencies.port.openVerifiedChapter(
      malformed as unknown as HoidRecommendationReaderOpenRequest,
    )).resolves.toEqual({
      status: "unavailable",
      reason: "edition-unavailable",
    });
    expect(firstSignal?.aborted).toBe(false);

    resolveFirstRead({
      status: "candidate",
      candidate: readerContent(request.workId, request.editionId, request.navigationHref),
    });
    await expect(validOperation).resolves.toEqual({
      status: "opened",
      bookId: request.workId,
      chapterNumber: request.request.target.cursor.chapterNumber,
      editionId: request.editionId,
      locatorId: request.request.target.locatorId,
    });
    expect(dependencies.onChapterOpened).toHaveBeenCalledTimes(1);
  });

  it("settles an older durable progress read promptly when a newer open supersedes it", async () => {
    const progress = snapshotFor();
    const request = requestFor(progress);
    let resolveFirstRefresh: (value: unknown) => void = () => {};
    let markFirstRefreshStarted: () => void = () => {};
    const firstRefreshStarted = new Promise<void>(resolve => {
      markFirstRefreshStarted = resolve;
    });
    const firstRefresh = new Promise<unknown>(resolve => {
      resolveFirstRefresh = resolve;
    });
    let refreshCount = 0;
    const refreshCurrentProgress = vi.fn(() => {
      refreshCount += 1;
      if (refreshCount === 1) {
        markFirstRefreshStarted();
        return firstRefresh;
      }
      return Promise.resolve(progress);
    });
    const dependencies = dependenciesFor(progress, request.navigationHref, {
      refreshCurrentProgress,
    });

    const olderOperation = dependencies.port.openVerifiedChapter(request.request);
    await firstRefreshStarted;
    const newerResult = await dependencies.port.openVerifiedChapter(request.request);

    expect(newerResult).toEqual({
      status: "opened",
      bookId: request.workId,
      chapterNumber: request.request.target.cursor.chapterNumber,
      editionId: request.editionId,
      locatorId: request.request.target.locatorId,
    });
    await expect(olderOperation).resolves.toEqual({
      status: "unavailable",
      reason: "superseded",
    });
    expect(dependencies.readChapterContent).toHaveBeenCalledTimes(1);
    expect(dependencies.onChapterOpened).toHaveBeenCalledTimes(1);

    // The underlying durable read may finish later, but its value is discarded.
    resolveFirstRefresh(progress);
    await Promise.resolve();
  });

  it("removes caller and source-session abort listeners after a successful open", async () => {
    const progress = snapshotFor();
    const request = requestFor(progress);
    const callerController = new AbortController();
    const sessionController = new AbortController();
    const callerAdded: EventListenerOrEventListenerObject[] = [];
    const callerRemoved: EventListenerOrEventListenerObject[] = [];
    const sessionAdded: EventListenerOrEventListenerObject[] = [];
    const sessionRemoved: EventListenerOrEventListenerObject[] = [];

    const trackedSignal = (
      controller: AbortController,
      added: EventListenerOrEventListenerObject[],
      removed: EventListenerOrEventListenerObject[],
    ): AbortSignal => ({
      get aborted() { return controller.signal.aborted; },
      addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
      ) {
        if (type === "abort" && listener !== null) added.push(listener);
        controller.signal.addEventListener(type, listener, options);
      },
      removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | EventListenerOptions,
      ) {
        if (type === "abort" && listener !== null) removed.push(listener);
        controller.signal.removeEventListener(type, listener, options);
      },
    } as unknown as AbortSignal);

    const callerSignal = trackedSignal(callerController, callerAdded, callerRemoved);
    const sessionSignal = trackedSignal(sessionController, sessionAdded, sessionRemoved);
    const dependencies = dependenciesFor(progress, request.navigationHref, { sessionSignal });

    await expect(dependencies.port.openVerifiedChapter({
      ...request.request,
      signal: callerSignal,
    })).resolves.toMatchObject({ status: "opened" });

    expect(callerAdded).toHaveLength(1);
    expect(sessionAdded).toHaveLength(1);
    expect(callerRemoved).toEqual(callerAdded);
    expect(sessionRemoved).toEqual(sessionAdded);
  });

});
