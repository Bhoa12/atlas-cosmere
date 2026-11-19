import { describe, expect, it, vi } from "vitest";
import {
  createHoidGitHubSourceControlReviewPort,
  type HoidGitHubReviewApiPort,
} from "./githubSourceControlReviewAdapter";
import {
  verifyHoidProtectedReviewSnapshot,
  type HoidPromotionReviewRequest,
  type HoidProtectedReviewFetchRequest,
} from "./promotionReviewAuthority";

const HEAD_SHA = "a".repeat(40);
const BASE_SHA = "b".repeat(40);
const PLAN_FINGERPRINT = "b".repeat(64);
const request: HoidProtectedReviewFetchRequest = Object.freeze({
  schemaVersion: 2,
  repositoryFullName: "Bhoa12/atlas-cosmere",
  pullRequestNumber: 123,
  expectedBaseRef: "feat/hoid-ia-core-run122",
  expectedBaseSha: BASE_SHA,
  expectedHeadRef: "feat/hoid-ia-core-run123",
  expectedHeadSha: HEAD_SHA,
  promotionManifestPath: "docs/hoid/editorial-bundle-promotion.json",
  minimumApprovals: 2,
  requireCodeOwnerReview: true,
  requireDismissStaleReviews: true,
  requireEnforcedAdmins: true,
  promotionPlanFingerprint: PLAN_FINGERPRINT,
});

const reviewRequest: HoidPromotionReviewRequest = Object.freeze({
  schemaVersion: request.schemaVersion,
  repositoryFullName: request.repositoryFullName,
  pullRequestNumber: request.pullRequestNumber,
  expectedBaseRef: request.expectedBaseRef,
  expectedBaseSha: request.expectedBaseSha,
  expectedHeadRef: request.expectedHeadRef,
  expectedHeadSha: request.expectedHeadSha,
  promotionManifestPath: request.promotionManifestPath,
  minimumApprovals: request.minimumApprovals,
  requireCodeOwnerReview: request.requireCodeOwnerReview,
  requireDismissStaleReviews: request.requireDismissStaleReviews,
  requireEnforcedAdmins: request.requireEnforcedAdmins,
});

function apiWith(overrides: Partial<HoidGitHubReviewApiPort> = {}) {
  const base: HoidGitHubReviewApiPort = {
    getPullRequest: vi.fn(async () => ({
      state: "open",
      draft: false,
      baseRef: request.expectedBaseRef,
      baseSha: BASE_SHA,
      headRef: request.expectedHeadRef,
      headSha: HEAD_SHA,
      authorId: "author",
    })),
    listPullRequestReviews: vi.fn(async () => [
      {
        reviewId: "review-1",
        reviewerId: "reviewer-a",
        state: "APPROVED",
        commitSha: HEAD_SHA,
        submittedAt: "2026-11-18T02:00:00.000Z",
        dismissed: false,
      },
      {
        reviewId: "review-2",
        reviewerId: "reviewer-a",
        state: "CHANGES_REQUESTED",
        commitSha: HEAD_SHA,
        submittedAt: "2026-11-18T02:02:00.000Z",
        dismissed: false,
      },
      {
        reviewId: "review-3",
        reviewerId: "code-owner",
        state: "APPROVED",
        commitSha: HEAD_SHA,
        submittedAt: "2026-11-18T02:03:00.000Z",
        dismissed: false,
      },
      {
        reviewId: "review-4",
        reviewerId: "reviewer-b",
        state: "APPROVED",
        commitSha: HEAD_SHA,
        submittedAt: "2026-11-18T02:04:00.000Z",
        dismissed: false,
      },
    ]),
    getEffectiveBranchProtection: vi.fn(async () => ({
      requiredApprovingReviewCount: 2,
      requireCodeOwnerReview: true,
      dismissStaleReviews: true,
      enforceAdmins: true,
    })),
    listCodeOwnerApprovalReviewerIds: vi.fn(async () => ["code-owner"]),
    getPromotionManifestAtCommit: vi.fn(async () => ({
      commitSha: HEAD_SHA,
      promotionPlanFingerprint: PLAN_FINGERPRINT,
    })),
  };
  return { ...base, ...overrides };
}

describe("Hoid GitHub source-control review adapter", () => {
  it("normalizes the latest review per reviewer and verifies the exact commit manifest", async () => {
    const api = apiWith();
    const adapter = createHoidGitHubSourceControlReviewPort(
      api,
      () => "2026-11-18T02:10:00.000Z",
    );
    const snapshot = await adapter.fetchProtectedReviewSnapshot(request);
    expect(snapshot).toMatchObject({
      repositoryFullName: request.repositoryFullName,
      pullRequestNumber: request.pullRequestNumber,
      baseSha: BASE_SHA,
      headSha: HEAD_SHA,
      promotionPlanFingerprint: PLAN_FINGERPRINT,
    });
    const reviews = (snapshot as { reviews: readonly { reviewerId: string; state: string; isCodeOwner: boolean }[] }).reviews;
    expect(reviews).toHaveLength(3);
    expect(reviews.find(item => item.reviewerId === "reviewer-a")?.state).toBe("CHANGES_REQUESTED");
    expect(reviews.find(item => item.reviewerId === "code-owner")?.isCodeOwner).toBe(true);
    expect(api.getPromotionManifestAtCommit).toHaveBeenCalledWith({
      repositoryFullName: request.repositoryFullName,
      path: request.promotionManifestPath,
      commitSha: HEAD_SHA,
    });
    expect(verifyHoidProtectedReviewSnapshot(reviewRequest, snapshot, PLAN_FINGERPRINT)).toMatchObject({
      status: "verified",
      requiredApprovals: 2,
      approvalReviewerIds: ["code-owner", "reviewer-b"],
    });
  });

  it("rejects a manifest fetched from a different commit", async () => {
    const api = apiWith({
      getPromotionManifestAtCommit: vi.fn(async () => ({
        commitSha: "c".repeat(40),
        promotionPlanFingerprint: PLAN_FINGERPRINT,
      })),
    });
    const adapter = createHoidGitHubSourceControlReviewPort(api);
    await expect(adapter.fetchProtectedReviewSnapshot(request)).rejects.toThrow(
      "exact pull request head",
    );
  });

  it("rejects malformed or incomplete branch protection instead of marking it verified", async () => {
    const api = apiWith({
      getEffectiveBranchProtection: vi.fn(async () => ({
        requiredApprovingReviewCount: 2,
        requireCodeOwnerReview: true,
        dismissStaleReviews: true,
      })),
    });
    const adapter = createHoidGitHubSourceControlReviewPort(api);
    await expect(adapter.fetchProtectedReviewSnapshot(request)).rejects.toThrow(
      "Branch protection could not be verified",
    );
  });

  it("rejects duplicate review IDs and invalid review timestamps", async () => {
    const duplicateApi = apiWith({
      listPullRequestReviews: vi.fn(async () => [
        {
          reviewId: "same",
          reviewerId: "one",
          state: "APPROVED",
          commitSha: HEAD_SHA,
          submittedAt: "2026-11-18T02:00:00.000Z",
          dismissed: false,
        },
        {
          reviewId: "same",
          reviewerId: "two",
          state: "APPROVED",
          commitSha: HEAD_SHA,
          submittedAt: "2026-11-18T02:01:00.000Z",
          dismissed: false,
        },
      ]),
    });
    await expect(
      createHoidGitHubSourceControlReviewPort(duplicateApi).fetchProtectedReviewSnapshot(request),
    ).rejects.toThrow("Duplicate GitHub review ID");

    const invalidTimeApi = apiWith({
      listPullRequestReviews: vi.fn(async () => [{
        reviewId: "bad-time",
        reviewerId: "one",
        state: "APPROVED",
        commitSha: HEAD_SHA,
        submittedAt: "yesterday",
        dismissed: false,
      }]),
    });
    await expect(
      createHoidGitHubSourceControlReviewPort(invalidTimeApi).fetchProtectedReviewSnapshot(request),
    ).rejects.toThrow("Invalid GitHub review record");
  });

  it("fails closed when two reviews by one reviewer have an ambiguous timestamp tie", async () => {
    const api = apiWith({
      listPullRequestReviews: vi.fn(async () => [
        {
          reviewId: "review-tie-a",
          reviewerId: "same-reviewer",
          state: "APPROVED",
          commitSha: HEAD_SHA,
          submittedAt: "2026-11-18T02:00:00.000Z",
          dismissed: false,
        },
        {
          reviewId: "review-tie-b",
          reviewerId: "same-reviewer",
          state: "CHANGES_REQUESTED",
          commitSha: HEAD_SHA,
          submittedAt: "2026-11-18T02:00:00.000Z",
          dismissed: false,
        },
      ]),
    });
    await expect(
      createHoidGitHubSourceControlReviewPort(api).fetchProtectedReviewSnapshot(request),
    ).rejects.toThrow("Ambiguous GitHub review ordering");
  });

  it("does not invoke accessors on an untrusted API response", async () => {
    let getterCalled = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(hostile, {
      state: { enumerable: true, value: "open" },
      draft: { enumerable: true, value: false },
      baseRef: { enumerable: true, value: request.expectedBaseRef },
      baseSha: { enumerable: true, value: BASE_SHA },
      headRef: { enumerable: true, value: request.expectedHeadRef },
      headSha: { enumerable: true, value: HEAD_SHA },
      authorId: {
        enumerable: true,
        get() {
          getterCalled = true;
          return "author";
        },
      },
    });
    const api = apiWith({
      getPullRequest: vi.fn(async () => hostile),
    });
    await expect(
      createHoidGitHubSourceControlReviewPort(api).fetchProtectedReviewSnapshot(request),
    ).rejects.toThrow("Invalid GitHub pull request response");
    expect(getterCalled).toBe(false);
  });

  it("rejects duplicate or malformed Code Owner identity results", async () => {
    const api = apiWith({
      listCodeOwnerApprovalReviewerIds: vi.fn(async () => ["code-owner", "code-owner"]),
    });
    await expect(
      createHoidGitHubSourceControlReviewPort(api).fetchProtectedReviewSnapshot(request),
    ).rejects.toThrow("CODEOWNERS approval identities could not be verified");
  });

  it("fails closed when GitHub omits the exact base commit SHA", async () => {
    const api = apiWith({
      getPullRequest: vi.fn(async () => ({
        state: "open",
        draft: false,
        baseRef: request.expectedBaseRef,
        headRef: request.expectedHeadRef,
        headSha: HEAD_SHA,
        authorId: "author",
      })),
    });
    await expect(
      createHoidGitHubSourceControlReviewPort(api).fetchProtectedReviewSnapshot(request),
    ).rejects.toThrow("Invalid GitHub pull request response");
  });


});
