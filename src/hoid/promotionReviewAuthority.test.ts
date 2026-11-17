import { describe, expect, it, vi } from "vitest";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { createHoidReadingCursor } from "./readingManifest";
import {
  authorizeHoidPromotionCommit,
  fingerprintHoidEditorialPromotionPlan,
  verifyHoidProtectedReviewSnapshot,
  type HoidPromotionReviewRequest,
  type HoidEditorialPromotionPlanInput,
  type HoidProtectedReviewFetchRequest,
  type HoidProtectedReviewSnapshot,
} from "./promotionReviewAuthority";

const HEAD_SHA = "a".repeat(40);

function progressSnapshot(chapter = 5, revision = 17) {
  const cursor = createHoidReadingCursor("twok", chapter);
  if (cursor.status !== "ready") throw new Error("Cursor de promoción de prueba no disponible");
  return Object.freeze({
    schemaVersion: 2,
    revision,
    positions: Object.freeze([Object.freeze({ bookId: "twok", cursor: cursor.cursor })]),
    updatedAt: "2026-11-17T21:00:00.000Z",
  });
}

const initialProgress = progressSnapshot();
const initialProjection = projectHoidCursorProgressSnapshot(initialProgress);
if (initialProjection.status !== "ready") throw new Error("Proyección de progreso de prueba no disponible");

const plan: HoidEditorialPromotionPlanInput = Object.freeze({
  status: "ready-for-maintainer-commit",
  entityIds: Object.freeze(["dawnshard.lopen", "twok.shallan"]),
  relationshipIds: Object.freeze([
    "dawnshard.relationship.lopen-taliks-candid-exchange",
    "twok.relationship.shallan-seeks-jasnah",
  ]),
  progressRevision: initialProjection.revision,
  progressFingerprint: fingerprintHoidCursorProgressProjection(initialProjection),
  requiresProtectedReview: true,
  promotionAllowed: false,
  productionWritePerformed: false,
});

function progressPortWith(snapshots: readonly unknown[] = [initialProgress, initialProgress]) {
  let index = 0;
  return {
    readAuthoritativeProgressSnapshot: vi.fn(async () =>
      snapshots[Math.min(index++, snapshots.length - 1)]
    ),
  };
}

const request: HoidPromotionReviewRequest = Object.freeze({
  schemaVersion: 1,
  repositoryFullName: "Bhoa12/atlas-cosmere",
  pullRequestNumber: 11,
  expectedBaseRef: "feat/hoid-ia-core-run117",
  expectedHeadRef: "feat/hoid-ia-core-run118",
  expectedHeadSha: HEAD_SHA,
  promotionManifestPath: "docs/hoid/promotion-plan.json",
  minimumApprovals: 2,
  requireCodeOwnerReview: true,
  requireDismissStaleReviews: true,
  requireEnforcedAdmins: true,
});

function snapshotFor(fetchRequest: HoidProtectedReviewFetchRequest): HoidProtectedReviewSnapshot {
  return Object.freeze({
    schemaVersion: 1,
    repositoryFullName: request.repositoryFullName,
    pullRequestNumber: request.pullRequestNumber,
    state: "open",
    draft: false,
    baseRef: request.expectedBaseRef,
    headRef: request.expectedHeadRef,
    headSha: request.expectedHeadSha,
    authorId: "pull-request-author",
    promotionManifestPath: request.promotionManifestPath,
    promotionPlanFingerprint: fetchRequest.promotionPlanFingerprint,
    verifiedAt: "2026-11-17T21:00:00.000Z",
    branchProtection: Object.freeze({
      status: "verified",
      requiredApprovingReviewCount: 2,
      requireCodeOwnerReview: true,
      dismissStaleReviews: true,
      enforceAdmins: true,
    }),
    reviews: Object.freeze([
      Object.freeze({
        reviewId: "review-101",
        reviewerId: "code-owner",
        state: "APPROVED",
        commitSha: HEAD_SHA,
        submittedAt: "2026-11-17T20:45:00.000Z",
        dismissed: false,
        isCodeOwner: true,
      }),
      Object.freeze({
        reviewId: "review-102",
        reviewerId: "second-reviewer",
        state: "APPROVED",
        commitSha: HEAD_SHA,
        submittedAt: "2026-11-17T20:50:00.000Z",
        dismissed: false,
        isCodeOwner: false,
      }),
    ]),
  });
}

function portWith(
  mutate: (snapshot: HoidProtectedReviewSnapshot, request: HoidProtectedReviewFetchRequest) => unknown = snapshot => snapshot,
) {
  return {
    fetchProtectedReviewSnapshot: vi.fn(async (fetchRequest: HoidProtectedReviewFetchRequest) =>
      mutate(snapshotFor(fetchRequest), fetchRequest)
    ),
  };
}

describe("Hoid protected source-control review authority", () => {
  it("produces a deterministic fingerprint for the canonical promotion manifest", () => {
    const first = fingerprintHoidEditorialPromotionPlan(plan);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprintHoidEditorialPromotionPlan(plan)).toBe(first);
    expect(fingerprintHoidEditorialPromotionPlan({ ...plan, productionWritePerformed: true })).toBeNull();
  });

  it("supports class-based source-control adapters without accepting accessors", async () => {
    class Adapter {
      async fetchProtectedReviewSnapshot(fetchRequest: HoidProtectedReviewFetchRequest): Promise<unknown> {
        return snapshotFor(fetchRequest);
      }
    }
    const result = await authorizeHoidPromotionCommit(plan, request, new Adapter(), progressPortWith());
    expect(result.status).toBe("ready-for-maintainer-commit");

    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "fetchProtectedReviewSnapshot", {
      enumerable: true,
      get: () => async () => snapshotFor({ ...request, promotionPlanFingerprint: "b".repeat(64) }),
    });
    expect(await authorizeHoidPromotionCommit(plan, request, hostile, progressPortWith())).toMatchObject({
      status: "blocked",
      reason: "invalid-source-control-port",
    });
  });

  it("authorizes only a reviewed exact PR head and never writes production", async () => {
    const port = portWith();
    const result = await authorizeHoidPromotionCommit(plan, request, port, progressPortWith());
    expect(result).toMatchObject({
      status: "ready-for-maintainer-commit",
      repositoryFullName: request.repositoryFullName,
      pullRequestNumber: request.pullRequestNumber,
      headSha: HEAD_SHA,
      approvalReviewerIds: ["code-owner", "second-reviewer"],
      requiredApprovals: 2,
      protectedReviewVerified: true,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(port.fetchProtectedReviewSnapshot).toHaveBeenCalledTimes(1);
    expect(port.fetchProtectedReviewSnapshot.mock.calls[0][0].promotionPlanFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not call the source-control adapter for a blocked promotion plan", async () => {
    const port = portWith();
    const result = await authorizeHoidPromotionCommit({ status: "blocked" }, request, port, progressPortWith());
    expect(result).toEqual({
      status: "blocked",
      reason: "promotion-plan-blocked",
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(port.fetchProtectedReviewSnapshot).not.toHaveBeenCalled();
  });

  it("rejects a forged or malformed ready plan before calling the adapter", async () => {
    const port = portWith();
    const result = await authorizeHoidPromotionCommit({ ...plan, promotionAllowed: true }, request, port, progressPortWith());
    expect(result).toMatchObject({ status: "blocked", reason: "invalid-plan" });
    expect(port.fetchProtectedReviewSnapshot).not.toHaveBeenCalled();
  });

  it("rejects path traversal and malformed source-control requests", async () => {
    const port = portWith();
    const result = await authorizeHoidPromotionCommit(plan, {
      ...request,
      promotionManifestPath: "docs/hoid/../../production.json",
    }, port, progressPortWith());
    expect(result).toMatchObject({ status: "blocked", reason: "invalid-request" });
    expect(port.fetchProtectedReviewSnapshot).not.toHaveBeenCalled();
  });

  it("binds the snapshot to the exact repository, pull request and branch pair", () => {
    const valid = snapshotFor({
      ...request,
      promotionPlanFingerprint: "b".repeat(64),
    });
    expect(verifyHoidProtectedReviewSnapshot(request, {
      ...valid,
      repositoryFullName: "someone/else",
    }, "b".repeat(64)).status).toBe("invalid");
    expect(verifyHoidProtectedReviewSnapshot(request, {
      ...valid,
      pullRequestNumber: 12,
    }, "b".repeat(64)).status).toBe("invalid");
    expect(verifyHoidProtectedReviewSnapshot(request, {
      ...valid,
      baseRef: "main",
    }, "b".repeat(64)).status).toBe("invalid");
  });

  it("rejects a changed PR head even when older reviews are approved", () => {
    const valid = snapshotFor({ ...request, promotionPlanFingerprint: "b".repeat(64) });
    const result = verifyHoidProtectedReviewSnapshot(request, {
      ...valid,
      headSha: "c".repeat(40),
    }, "b".repeat(64));
    expect(result).toEqual({ status: "invalid", reason: "head-mismatch" });
  });

  it("requires the adapter to identify the exact promotion manifest path", () => {
    const valid = snapshotFor({ ...request, promotionPlanFingerprint: "b".repeat(64) });
    expect(verifyHoidProtectedReviewSnapshot(request, {
      ...valid,
      promotionManifestPath: "docs/hoid/other-plan.json",
    }, "b".repeat(64))).toEqual({
      status: "invalid",
      reason: "promotion-manifest-mismatch",
    });
  });

  it("rejects a snapshot whose promotion manifest fingerprint differs from the reviewed plan", () => {
    const valid = snapshotFor({ ...request, promotionPlanFingerprint: "b".repeat(64) });
    expect(verifyHoidProtectedReviewSnapshot(request, valid, "c".repeat(64))).toEqual({
      status: "invalid",
      reason: "promotion-plan-mismatch",
    });
  });

  it("does not count approvals from the pull-request author", () => {
    const valid = snapshotFor({ ...request, promotionPlanFingerprint: "b".repeat(64) });
    const result = verifyHoidProtectedReviewSnapshot(request, {
      ...valid,
      reviews: [
        ...valid.reviews,
        {
          reviewId: "review-author",
          reviewerId: "pull-request-author",
          state: "APPROVED",
          commitSha: HEAD_SHA,
          submittedAt: "2026-11-17T20:55:00.000Z",
          dismissed: false,
          isCodeOwner: true,
        },
      ],
    }, "b".repeat(64));
    expect(result).toMatchObject({ status: "verified", approvalReviewerIds: ["code-owner", "second-reviewer"] });
  });

  it("does not count approvals on an older commit or dismissed approvals", () => {
    const valid = snapshotFor({ ...request, promotionPlanFingerprint: "b".repeat(64) });
    const result = verifyHoidProtectedReviewSnapshot(request, {
      ...valid,
      reviews: valid.reviews.map((review, index) => ({
        ...review,
        commitSha: index === 0 ? "c".repeat(40) : review.commitSha,
        dismissed: index === 1,
      })),
    }, "b".repeat(64));
    expect(result).toEqual({ status: "invalid", reason: "approval-quorum-not-met" });
  });

  it("rejects review timestamps later than the adapter verification time", () => {
    const valid = snapshotFor({ ...request, promotionPlanFingerprint: "b".repeat(64) });
    expect(verifyHoidProtectedReviewSnapshot(request, {
      ...valid,
      reviews: valid.reviews.map((review, index) => ({
        ...review,
        submittedAt: index === 0 ? "2026-11-17T22:00:00.000Z" : review.submittedAt,
      })),
    }, "b".repeat(64))).toEqual({
      status: "invalid",
      reason: "invalid-snapshot",
    });
  });

  it("requires one effective review per reviewer to avoid ambiguous review history", () => {
    const valid = snapshotFor({ ...request, promotionPlanFingerprint: "b".repeat(64) });
    const result = verifyHoidProtectedReviewSnapshot(request, {
      ...valid,
      reviews: [...valid.reviews, { ...valid.reviews[0], reviewId: "review-duplicate" }],
    }, "b".repeat(64));
    expect(result).toEqual({ status: "invalid", reason: "invalid-snapshot" });
  });

  it("requires branch protection to be fetched and to satisfy the configured policy", () => {
    const valid = snapshotFor({ ...request, promotionPlanFingerprint: "b".repeat(64) });
    expect(verifyHoidProtectedReviewSnapshot(request, {
      ...valid,
      branchProtection: { ...valid.branchProtection, status: "unverified" },
    }, "b".repeat(64))).toEqual({ status: "invalid", reason: "branch-protection-unverified" });
    expect(verifyHoidProtectedReviewSnapshot(request, {
      ...valid,
      branchProtection: { ...valid.branchProtection, enforceAdmins: false },
    }, "b".repeat(64))).toEqual({ status: "invalid", reason: "branch-protection-insufficient" });
  });

  it("requires a code-owner approval when the request and repository rules demand it", () => {
    const valid = snapshotFor({ ...request, promotionPlanFingerprint: "b".repeat(64) });
    const result = verifyHoidProtectedReviewSnapshot(request, {
      ...valid,
      reviews: valid.reviews.map(review => ({ ...review, isCodeOwner: false })),
    }, "b".repeat(64));
    expect(result).toEqual({ status: "invalid", reason: "code-owner-approval-missing" });
  });

  it("rejects draft and closed pull requests", () => {
    const valid = snapshotFor({ ...request, promotionPlanFingerprint: "b".repeat(64) });
    expect(verifyHoidProtectedReviewSnapshot(request, { ...valid, draft: true }, "b".repeat(64))).toEqual({
      status: "invalid",
      reason: "draft-pull-request",
    });
    expect(verifyHoidProtectedReviewSnapshot(request, { ...valid, state: "closed" }, "b".repeat(64))).toEqual({
      status: "invalid",
      reason: "pull-request-not-open",
    });
  });

  it("contains adapter failures and invalid adapter objects", async () => {
    const throwingPort = {
      fetchProtectedReviewSnapshot: async () => { throw new Error("network failure"); },
    };
    expect(await authorizeHoidPromotionCommit(plan, request, throwingPort, progressPortWith())).toMatchObject({
      status: "blocked",
      reason: "review-source-unavailable",
    });
    expect(await authorizeHoidPromotionCommit(plan, request, {}, progressPortWith())).toMatchObject({
      status: "blocked",
      reason: "invalid-source-control-port",
    });
  });

  it("fails closed when the source-control adapter exceeds the timeout", async () => {
    vi.useFakeTimers();
    try {
      const port = {
        fetchProtectedReviewSnapshot: vi.fn(() => new Promise<unknown>(() => undefined)),
      };
      const pending = authorizeHoidPromotionCommit(plan, request, port, progressPortWith());
      await vi.advanceTimersByTimeAsync(8_000);
      await expect(pending).resolves.toMatchObject({ status: "blocked", reason: "review-timeout" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("checks the live Atlas cursor before and after source-control review", async () => {
    const port = portWith();
    const progressPort = progressPortWith([initialProgress, progressSnapshot(6, 18)]);
    const result = await authorizeHoidPromotionCommit(plan, request, port, progressPort);
    expect(result).toMatchObject({ status: "blocked", reason: "progress-changed" });
    expect(port.fetchProtectedReviewSnapshot).toHaveBeenCalledTimes(1);
    expect(progressPort.readAuthoritativeProgressSnapshot).toHaveBeenCalledTimes(2);
  });

  it("does not contact source control when the live cursor already differs from the plan", async () => {
    const port = portWith();
    const progressPort = progressPortWith([progressSnapshot(6, 18)]);
    const result = await authorizeHoidPromotionCommit(plan, request, port, progressPort);
    expect(result).toMatchObject({ status: "blocked", reason: "progress-changed" });
    expect(port.fetchProtectedReviewSnapshot).not.toHaveBeenCalled();
  });

  it("fails closed when the authoritative progress port is unavailable or invalid", async () => {
    const port = portWith();
    const unavailable = {
      readAuthoritativeProgressSnapshot: async () => { throw new Error("coordinator unavailable"); },
    };
    expect(await authorizeHoidPromotionCommit(plan, request, port, unavailable)).toMatchObject({
      status: "blocked",
      reason: "progress-source-unavailable",
    });
    const invalid = progressPortWith([{ schemaVersion: 2, revision: -1, positions: [], updatedAt: "bad" }]);
    expect(await authorizeHoidPromotionCommit(plan, request, port, invalid)).toMatchObject({
      status: "blocked",
      reason: "invalid-progress",
    });
  });

  it("rejects accessor-based snapshots rather than executing getters", () => {
    const valid = snapshotFor({ ...request, promotionPlanFingerprint: "b".repeat(64) });
    const hostile = { ...valid } as Record<string, unknown>;
    Object.defineProperty(hostile, "headSha", { enumerable: true, get: () => HEAD_SHA });
    expect(verifyHoidProtectedReviewSnapshot(request, hostile, "b".repeat(64))).toEqual({
      status: "invalid",
      reason: "invalid-snapshot",
    });
  });
});
