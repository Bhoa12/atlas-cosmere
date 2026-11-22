import { describe, expect, it } from "vitest";
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
  prepareHoidRecommendationNavigationHandoff,
} from "./editionBoundRecommendationNavigation";

const UPDATED_AT = "2026-11-22T17:00:00.000Z";

function snapshotFor(bookId: string, chapterNumber: number, revision = 1) {
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

function completedSnapshot(bookId: string) {
  return {
    schemaVersion: 2 as const,
    revision: 1,
    positions: [{ bookId, completed: true as const }],
    updatedAt: UPDATED_AT,
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

function prepare(target: unknown, progress: unknown, selectedActiveBookId?: string) {
  const currentIdentity = identity(progress);
  return prepareHoidRecommendationNavigationHandoff(
    target,
    progress,
    currentIdentity.revision,
    currentIdentity.fingerprint,
    selectedActiveBookId,
  );
}

describe("edition-bound recommendation navigation boundary", () => {
  it("prepares a handoff only for the exact currently open edition cursor", () => {
    const progress = snapshotFor("twok", 21);
    const target = targetFor(progress);
    const result = prepare(target, progress);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.handoff).toMatchObject({
      cursor: { bookId: "twok", chapterNumber: 21 },
      editionId: "roshar-omnibus-v1",
      locatorStatus: "verified",
      locatorId: expect.stringContaining("nav:roshar-omnibus-v1:"),
    });
    expect(result.progressRevision).toBe(1);
    expect(result.progressFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(result.handoff)).toBe(true);
  });

  it("allows chapter one only when the work has no recorded position", () => {
    const progress = emptySnapshot();
    const target = targetFor(progress);
    const result = prepare(target, progress);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.handoff.cursor).toMatchObject({
      bookId: "tfe",
      chapterNumber: 1,
    });
  });

  it("does not allow a cursor-only downgrade when the manifest has a verified locator", () => {
    const progress = snapshotFor("twok", 21);
    const target = targetFor(progress);
    expect(target.kind).toBe("edition-cursor");
    if (target.kind !== "edition-cursor" || !target.locatorId) return;

    const downgradedTarget = {
      kind: target.kind,
      cursor: target.cursor,
      editionId: target.editionId,
      navigationSha256: target.navigationSha256,
      locatorStatus: "cursor-only" as const,
    };
    expect(prepare(downgradedTarget, progress)).toEqual({
      status: "unavailable",
      reason: "locator-mismatch",
    });
  });

  it("rejects a stale progress revision", () => {
    const oldProgress = snapshotFor("twok", 21, 1);
    const target = targetFor(oldProgress);
    const currentProgress = snapshotFor("twok", 22, 2);
    const oldIdentity = identity(oldProgress);

    expect(prepareHoidRecommendationNavigationHandoff(
      target,
      currentProgress,
      oldIdentity.revision,
      oldIdentity.fingerprint,
    )).toEqual({ status: "unavailable", reason: "stale-progress" });
  });

  it("rejects a changed cursor even when the ledger revision is reused", () => {
    const oldProgress = snapshotFor("twok", 21, 1);
    const target = targetFor(oldProgress);
    const currentProgress = snapshotFor("twok", 22, 1);
    const oldIdentity = identity(oldProgress);

    expect(prepareHoidRecommendationNavigationHandoff(
      target,
      currentProgress,
      oldIdentity.revision,
      oldIdentity.fingerprint,
    )).toEqual({ status: "unavailable", reason: "stale-progress" });
  });

  it("rejects a target whose cursor differs from the current cursor", () => {
    const targetProgress = snapshotFor("twok", 21);
    const target = targetFor(targetProgress);
    const currentProgress = snapshotFor("twok", 22);

    expect(prepare(target, currentProgress)).toEqual({
      status: "unavailable",
      reason: "cursor-mismatch",
    });
  });

  it("rejects a target for a work the reader marked completed", () => {
    const target = targetFor(snapshotFor("twok", 21));
    const completed = completedSnapshot("twok");

    expect(prepare(target, completed)).toEqual({
      status: "unavailable",
      reason: "work-completed",
    });
  });

  it("requires an explicit active-work selection when several works are in progress", () => {
    const twok = createHoidReadingCursor("twok", 21);
    const elantris = createHoidReadingCursor("elantris", 3);
    if (twok.status !== "ready" || elantris.status !== "ready") {
      throw new Error("Multi-work cursor fixture unavailable");
    }
    const progress = {
      schemaVersion: 2 as const,
      revision: 1,
      positions: [
        { bookId: "twok", cursor: twok.cursor },
        { bookId: "elantris", cursor: elantris.cursor },
      ],
      updatedAt: UPDATED_AT,
    };
    const twokTarget = targetFor(snapshotFor("twok", 21));
    const elantrisTarget = targetFor(snapshotFor("elantris", 3));

    expect(prepare(twokTarget, progress)).toEqual({
      status: "unavailable",
      reason: "selection-required",
    });
    expect(prepare(twokTarget, progress, "twok").status).toBe("ready");
    expect(prepare(elantrisTarget, progress, "twok")).toEqual({
      status: "unavailable",
      reason: "selection-required",
    });
  });

  it("allows an unread chapter-one discovery target after the active work was explicitly selected", () => {
    const twok = createHoidReadingCursor("twok", 21);
    const elantris = createHoidReadingCursor("elantris", 3);
    if (twok.status !== "ready" || elantris.status !== "ready") {
      throw new Error("Multi-work cursor fixture unavailable");
    }
    const progress = {
      schemaVersion: 2 as const,
      revision: 1,
      positions: [
        { bookId: "twok", cursor: twok.cursor },
        { bookId: "elantris", cursor: elantris.cursor },
      ],
      updatedAt: UPDATED_AT,
    };
    const discoveryTarget = targetFor(emptySnapshot());

    expect(prepare(discoveryTarget, progress, "twok").status).toBe("ready");
  });

  it("rejects a selected active work that is not in the current progress snapshot", () => {
    const progress = snapshotFor("twok", 21);
    const target = targetFor(progress);

    expect(prepare(target, progress, "elantris")).toEqual({
      status: "unavailable",
      reason: "invalid-active-work",
    });
  });

  it("rejects a chapter beyond the first unit when the work has not started", () => {
    const target = targetFor(snapshotFor("twok", 21));
    const progress = emptySnapshot();

    expect(prepare(target, progress)).toEqual({
      status: "unavailable",
      reason: "work-not-started",
    });
  });

  it("rejects catalog-only recommendations as navigation targets", () => {
    expect(prepare(
      { kind: "catalog-only", reason: "segmentation-unverified" },
      emptySnapshot(),
    )).toEqual({
      status: "unavailable",
      reason: "catalog-only",
    });
  });

  it("rejects edition and navigation-digest substitutions", () => {
    const progress = snapshotFor("twok", 21);
    const target = targetFor(progress);
    if (target.kind !== "edition-cursor") throw new Error("Expected cursor target");

    expect(prepare({ ...target, editionId: "another-edition" }, progress)).toEqual({
      status: "unavailable",
      reason: "manifest-mismatch",
    });
    expect(prepare({ ...target, navigationSha256: "0".repeat(64) }, progress)).toEqual({
      status: "unavailable",
      reason: "manifest-mismatch",
    });
  });

  it("rejects locator substitution and unexpected target fields", () => {
    const progress = snapshotFor("twok", 21);
    const target = targetFor(progress);
    if (target.kind !== "edition-cursor" || !target.locatorId) {
      throw new Error("Expected a verified locator fixture");
    }

    expect(prepare({ ...target, locatorId: "nav:forged:locator.xhtml" }, progress)).toEqual({
      status: "unavailable",
      reason: "locator-mismatch",
    });
    expect(prepare({ ...target, filesystemPath: "../../chapter.xhtml" }, progress)).toEqual({
      status: "unavailable",
      reason: "invalid-target",
    });
  });

  it("rejects accessor-backed targets without invoking the getter", () => {
    const progress = snapshotFor("twok", 21);
    const target = targetFor(progress);
    if (target.kind !== "edition-cursor") throw new Error("Expected cursor target");
    let getterCalls = 0;
    const accessorTarget = {
      kind: target.kind,
      editionId: target.editionId,
      navigationSha256: target.navigationSha256,
      locatorStatus: target.locatorStatus,
      ...(target.locatorId ? { locatorId: target.locatorId } : {}),
    };
    Object.defineProperty(accessorTarget, "cursor", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return target.cursor;
      },
    });

    expect(prepare(accessorTarget, progress)).toEqual({
      status: "unavailable",
      reason: "invalid-target",
    });
    expect(getterCalls).toBe(0);
  });

  it("does not mutate the progress snapshot or the recommendation target", () => {
    const progress = snapshotFor("twok", 21);
    const target = targetFor(progress);
    const progressBefore = JSON.stringify(progress);
    const targetBefore = JSON.stringify(target);

    const result = prepare(target, progress);

    expect(result.status).toBe("ready");
    expect(JSON.stringify(progress)).toBe(progressBefore);
    expect(JSON.stringify(target)).toBe(targetBefore);
  });

  it("rejects malformed progress identities and snapshots", () => {
    const progress = snapshotFor("twok", 21);
    const target = targetFor(progress);

    expect(prepareHoidRecommendationNavigationHandoff(
      target,
      progress,
      1,
      "not-a-sha256",
    )).toEqual({
      status: "unavailable",
      reason: "invalid-progress-identity",
    });
    expect(prepareHoidRecommendationNavigationHandoff(
      target,
      { schemaVersion: 2, revision: 0, positions: [], updatedAt: UPDATED_AT },
      0,
      "0".repeat(64),
    )).toEqual({
      status: "unavailable",
      reason: "invalid-progress",
    });
  });
  it("rejects a target when any required data property is absent", () => {
    const progress = snapshotFor("twok", 21);
    const target = targetFor(progress);
    if (target.kind !== "edition-cursor") throw new Error("Expected cursor target");

    const missingLocatorStatus: Record<string, unknown> = { ...target };
    delete missingLocatorStatus.locatorStatus;
    expect(prepare(missingLocatorStatus, progress)).toEqual({
      status: "unavailable",
      reason: "invalid-target",
    });

    const missingEdition: Record<string, unknown> = { ...target };
    delete missingEdition.editionId;
    expect(prepare(missingEdition, progress)).toEqual({
      status: "unavailable",
      reason: "invalid-target",
    });
  });

});
