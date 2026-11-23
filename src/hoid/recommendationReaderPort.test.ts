import { describe, expect, it, vi } from "vitest";
import {
  createHoidEditionBoundRecommendationPresentation,
} from "./editionBoundRecommendationPresentation";
import {
  validateHoidCursorProgressSnapshot,
} from "./cursorProgressLedger";
import {
  fingerprintHoidCursorProgressSnapshot,
} from "./knowledgeGraph";
import {
  createHoidReadingCursor,
} from "./readingManifest";
import {
  openHoidRecommendationChapter,
  type HoidRecommendationReaderOpenRequest,
  type HoidRecommendationReaderPort,
} from "./recommendationReaderPort";

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

function emptySnapshot() {
  return {
    schemaVersion: 2 as const,
    revision: 0,
    positions: [],
    updatedAt: null,
  };
}

function identity(progress: unknown) {
  const validation = validateHoidCursorProgressSnapshot(progress);
  if (validation.status !== "valid") throw new Error("Progress fixture invalid");
  const result = fingerprintHoidCursorProgressSnapshot(validation.snapshot);
  if (result.status !== "ready") throw new Error("Progress identity unavailable");
  return { revision: result.revision, fingerprint: result.sha256 };
}

function targetFor(progress: unknown) {
  const presentation = createHoidEditionBoundRecommendationPresentation(progress, 1);
  if (presentation.status !== "ready" || presentation.items.length !== 1) {
    throw new Error("Recommendation fixture unavailable");
  }
  return presentation.items[0].target;
}

function readerFor(
  implementation: (request: HoidRecommendationReaderOpenRequest) => Promise<unknown>,
): HoidRecommendationReaderPort {
  return { openVerifiedChapter: implementation };
}

function inputFor(target: unknown, progress: unknown) {
  const progressIdentity = identity(progress);
  return {
    target,
    expectedProgressRevision: progressIdentity.revision,
    expectedProgressFingerprint: progressIdentity.fingerprint,
  };
}

describe("provider-neutral recommendation reader port", () => {
  it("opens only the exact verified edition locator and passes metadata, not paths", async () => {
    const progress = snapshotFor();
    const target = targetFor(progress);
    let received: HoidRecommendationReaderOpenRequest | null = null;
    const reader = readerFor(async request => {
      received = request;
      return {
        status: "opened",
        bookId: request.target.cursor.bookId,
        chapterNumber: request.target.cursor.chapterNumber,
        editionId: request.target.editionId,
        locatorId: request.target.locatorId,
      };
    });

    const result = await openHoidRecommendationChapter(
      { reader, refreshCurrentProgress: async () => progress },
      inputFor(target, progress),
    );

    expect(result.status).toBe("opened");
    expect(received).not.toBeNull();
    if (received) {
      expect(Object.keys(received).sort()).toEqual([
        "progressFingerprint",
        "progressRevision",
        "target",
      ]);
      expect(Object.keys(received.target).sort()).toEqual([
        "cursor",
        "editionId",
        "locatorId",
        "locatorStatus",
        "manifestId",
        "navigationSha256",
      ]);
      expect(received.target.locatorStatus).toBe("verified");
      expect(received.target.locatorId).toContain("nav:");
    }
  });

  it("does not call the reader when the durable progress is stale", async () => {
    const oldProgress = snapshotFor("twok", 21, 1);
    const currentProgress = snapshotFor("twok", 22, 2);
    const reader = readerFor(vi.fn(async () => ({ status: "opened" })));

    const result = await openHoidRecommendationChapter(
      { reader, refreshCurrentProgress: async () => currentProgress },
      inputFor(targetFor(oldProgress), oldProgress),
    );

    expect(result).toEqual({ status: "unavailable", reason: "stale-progress" });
    expect(reader.openVerifiedChapter).not.toHaveBeenCalled();
  });

  it("refuses a cursor-only downgrade when the manifest has a verified locator", async () => {
    const progress = snapshotFor();
    const target = targetFor(progress);
    if (target.kind !== "edition-cursor" || !target.locatorId) {
      throw new Error("Verified locator fixture unavailable");
    }
    const downgradedTarget = {
      kind: target.kind,
      cursor: target.cursor,
      editionId: target.editionId,
      navigationSha256: target.navigationSha256,
      locatorStatus: "cursor-only" as const,
    };
    const reader = readerFor(vi.fn(async () => ({ status: "opened" })));

    const result = await openHoidRecommendationChapter(
      { reader, refreshCurrentProgress: async () => progress },
      inputFor(downgradedTarget, progress),
    );

    expect(result).toEqual({ status: "unavailable", reason: "locator-mismatch" });
    expect(reader.openVerifiedChapter).not.toHaveBeenCalled();
  });

  it("refuses catalog-only targets before invoking the reader", async () => {
    const progress = emptySnapshot();
    const reader = readerFor(vi.fn(async () => ({ status: "opened" })));

    const result = await openHoidRecommendationChapter(
      { reader, refreshCurrentProgress: async () => progress },
      inputFor({ kind: "catalog-only", reason: "segmentation-unverified" }, progress),
    );

    expect(result).toEqual({ status: "unavailable", reason: "catalog-only" });
    expect(reader.openVerifiedChapter).not.toHaveBeenCalled();
  });

  it("requires explicit selection when more than one work is active", async () => {
    const first = createHoidReadingCursor("twok", 21);
    const second = createHoidReadingCursor("elantris", 3);
    if (first.status !== "ready" || second.status !== "ready") {
      throw new Error("Multi-work fixture unavailable");
    }
    const progress = {
      schemaVersion: 2 as const,
      revision: 1,
      positions: [
        { bookId: "twok", cursor: first.cursor },
        { bookId: "elantris", cursor: second.cursor },
      ],
      updatedAt: UPDATED_AT,
    };
    const target = targetFor(snapshotFor("twok", 21));
    const reader = readerFor(vi.fn(async () => ({ status: "opened" })));

    const result = await openHoidRecommendationChapter(
      { reader, refreshCurrentProgress: async () => progress },
      inputFor(target, progress),
    );

    expect(result).toEqual({ status: "unavailable", reason: "selection-required" });
    expect(reader.openVerifiedChapter).not.toHaveBeenCalled();
  });

  it("rejects an acknowledgement for a different book, chapter, edition or locator", async () => {
    const progress = snapshotFor();
    const target = targetFor(progress);
    const reader = readerFor(async () => ({
      status: "opened",
      bookId: "elantris",
      chapterNumber: 3,
      editionId: "another-edition",
      locatorId: "nav:forged",
    }));

    const result = await openHoidRecommendationChapter(
      { reader, refreshCurrentProgress: async () => progress },
      inputFor(target, progress),
    );

    expect(result).toEqual({
      status: "unavailable",
      reason: "invalid-reader-acknowledgement",
    });
  });

  it("rejects accessor-backed and proxy acknowledgements without executing getters", async () => {
    const progress = snapshotFor();
    const target = targetFor(progress);
    let getterCalls = 0;
    const accessor = {
      status: "opened",
      bookId: "twok",
      chapterNumber: 21,
      editionId: "roshar-omnibus-v1",
      locatorId: "nav:synthetic",
    };
    Object.defineProperty(accessor, "locatorId", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "nav:synthetic";
      },
    });

    const accessorResult = await openHoidRecommendationChapter(
      {
        reader: readerFor(async () => accessor),
        refreshCurrentProgress: async () => progress,
      },
      inputFor(target, progress),
    );
    expect(accessorResult).toEqual({
      status: "unavailable",
      reason: "invalid-reader-acknowledgement",
    });
    expect(getterCalls).toBe(0);

    const hostile = new Proxy({}, {
      ownKeys() {
        throw new Error("synthetic proxy trap");
      },
    });
    const proxyResult = await openHoidRecommendationChapter(
      {
        reader: readerFor(async () => hostile),
        refreshCurrentProgress: async () => progress,
      },
      inputFor(target, progress),
    );
    expect(proxyResult).toEqual({
      status: "unavailable",
      reason: "invalid-reader-acknowledgement",
    });
  });

  it("does not read progress or invoke the host when the reader is absent", async () => {
    const refresh = vi.fn(async () => snapshotFor());
    const result = await openHoidRecommendationChapter(
      { reader: null, refreshCurrentProgress: refresh },
      inputFor(targetFor(snapshotFor()), snapshotFor()),
    );

    expect(result).toEqual({ status: "unavailable", reason: "reader-unavailable" });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not refresh or invoke the host for an already-aborted request", async () => {
    const progress = snapshotFor();
    const controller = new AbortController();
    controller.abort();
    const refresh = vi.fn(async () => progress);
    const reader = readerFor(vi.fn(async () => ({ status: "opened" })));

    const result = await openHoidRecommendationChapter(
      { reader, refreshCurrentProgress: refresh },
      { ...inputFor(targetFor(progress), progress), signal: controller.signal },
    );

    expect(result).toEqual({ status: "unavailable", reason: "cancelled" });
    expect(refresh).not.toHaveBeenCalled();
    expect(reader.openVerifiedChapter).not.toHaveBeenCalled();
  });

  it("checks cancellation again after the durable progress read", async () => {
    const progress = snapshotFor();
    const controller = new AbortController();
    let resolveProgress: (value: unknown) => void = () => {};
    const pendingProgress = new Promise<unknown>(resolve => {
      resolveProgress = resolve;
    });
    const reader = readerFor(vi.fn(async () => ({ status: "opened" })));
    const operation = openHoidRecommendationChapter(
      { reader, refreshCurrentProgress: () => pendingProgress },
      { ...inputFor(targetFor(progress), progress), signal: controller.signal },
    );

    controller.abort();
    resolveProgress(progress);

    expect(await operation).toEqual({ status: "unavailable", reason: "cancelled" });
    expect(reader.openVerifiedChapter).not.toHaveBeenCalled();
  });

  it("maps a host failure to a bounded result without exposing an exception", async () => {
    const progress = snapshotFor();
    const reader = readerFor(async () => {
      throw new Error("synthetic host failure");
    });

    const result = await openHoidRecommendationChapter(
      { reader, refreshCurrentProgress: async () => progress },
      inputFor(targetFor(progress), progress),
    );

    expect(result).toEqual({ status: "unavailable", reason: "reader-failed" });
  });

  it("propagates a host stale-progress result without accepting the chapter", async () => {
    const progress = snapshotFor();
    const reader = readerFor(async () => ({
      status: "unavailable",
      reason: "stale-progress",
    }));

    const result = await openHoidRecommendationChapter(
      { reader, refreshCurrentProgress: async () => progress },
      inputFor(targetFor(progress), progress),
    );

    expect(result).toEqual({ status: "unavailable", reason: "stale-progress" });
  });

  it("accepts only a bounded host-unavailable reason", async () => {
    const progress = snapshotFor();
    const reader = readerFor(async () => ({
      status: "unavailable",
      reason: "edition-unavailable",
    }));

    const result = await openHoidRecommendationChapter(
      { reader, refreshCurrentProgress: async () => progress },
      inputFor(targetFor(progress), progress),
    );

    expect(result).toEqual({ status: "unavailable", reason: "edition-unavailable" });
  });

  it("discards a late host acknowledgement after caller cancellation", async () => {
    const progress = snapshotFor();
    const controller = new AbortController();
    let resolveAcknowledgement: (value: unknown) => void = () => {};
    const pendingAcknowledgement = new Promise<unknown>(resolve => {
      resolveAcknowledgement = resolve;
    });
    const reader = readerFor(() => pendingAcknowledgement);
    const operation = openHoidRecommendationChapter(
      { reader, refreshCurrentProgress: async () => progress },
      { ...inputFor(targetFor(progress), progress), signal: controller.signal },
    );

    controller.abort();
    resolveAcknowledgement({
      status: "opened",
      bookId: "twok",
      chapterNumber: 21,
      editionId: "roshar-omnibus-v1",
      locatorId: "nav:late-ack",
    });

    expect(await operation).toEqual({ status: "unavailable", reason: "cancelled" });
  });
});
