import { describe, expect, it } from "vitest";
import {
  HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH,
  type HoidTopicAssignmentMergedSnapshotRequest,
} from "./topicAssignmentActivation";
import { HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH } from "./topicAssignmentPromotionAuthority";
import { createHoidGitHubTopicAssignmentMergeReviewPort } from "./githubTopicAssignmentMergeAdapter";

const request: HoidTopicAssignmentMergedSnapshotRequest = Object.freeze({
  repositoryFullName: "Bhoa12/atlas-cosmere",
  pullRequestNumber: 142,
  expectedBaseRef: "main",
  expectedHeadRef: "feat/hoid-ia-core-run142",
  expectedHeadSha: "a".repeat(40),
  promotionPlanFingerprint: "b".repeat(64),
  promotionManifestPath: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
  targetBranch: HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH,
});

function pullRequest(overrides: Record<string, unknown> = {}) {
  return {
    number: 142,
    state: "closed",
    draft: false,
    merged: true,
    merged_at: "2026-11-18T12:00:00.000Z",
    merge_commit_sha: "c".repeat(40),
    base: {
      ref: "main",
      repo: { full_name: "Bhoa12/atlas-cosmere" },
    },
    head: {
      ref: "feat/hoid-ia-core-run142",
      sha: "a".repeat(40),
    },
    ...overrides,
  };
}

function api(
  pr: unknown = pullRequest(),
  manifest: unknown = {
    commitSha: "a".repeat(40),
    promotionPlanFingerprint: "b".repeat(64),
  },
  onManifest?: (input: unknown) => void,
) {
  return {
    getPullRequest: async () => pr,
    getPromotionManifestAtCommit: async (input: unknown) => {
      onManifest?.(input);
      return manifest;
    },
  };
}

describe("GitHub topic-assignment merge adapter", () => {
  it("normalizes the exact merged PR and manifest at the reviewed head", async () => {
    let manifestRequest: unknown;
    const port = createHoidGitHubTopicAssignmentMergeReviewPort(api(
      pullRequest(),
      { commitSha: "a".repeat(40), promotionPlanFingerprint: "b".repeat(64) },
      input => { manifestRequest = input; },
    ));
    const result = await port.fetchMergedPromotionSnapshot(request);
    expect(result).toEqual({
      schemaVersion: 1,
      repositoryFullName: "Bhoa12/atlas-cosmere",
      pullRequestNumber: 142,
      state: "closed",
      draft: false,
      merged: true,
      baseRef: "main",
      headRef: "feat/hoid-ia-core-run142",
      headSha: "a".repeat(40),
      mergeCommitSha: "c".repeat(40),
      promotionManifestPath: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
      promotionPlanFingerprint: "b".repeat(64),
      mergedAt: "2026-11-18T12:00:00.000Z",
    });
    expect(manifestRequest).toEqual({
      repositoryFullName: "Bhoa12/atlas-cosmere",
      path: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
      commitSha: "a".repeat(40),
    });
  });

  it("rejects open, draft, unmerged or wrong-target pull requests", async () => {
    const cases = [
      pullRequest({ state: "open" }),
      pullRequest({ draft: true }),
      pullRequest({ merged: false }),
      pullRequest({ base: { ref: "feat/other", repo: { full_name: "Bhoa12/atlas-cosmere" } } }),
      pullRequest({ base: { ref: "main", repo: { full_name: "another/repository" } } }),
      pullRequest({ head: { ref: "feat/other", sha: "a".repeat(40) } }),
      pullRequest({ head: { ref: "feat/hoid-ia-core-run142", sha: "d".repeat(40) } }),
      pullRequest({ number: 143 }),
      pullRequest({ merge_commit_sha: "not-a-sha" }),
      pullRequest({ merged_at: "not-a-time" }),
    ];
    for (const value of cases) {
      const port = createHoidGitHubTopicAssignmentMergeReviewPort(api(value));
      await expect(port.fetchMergedPromotionSnapshot(request)).rejects.toThrow();
    }
  });

  it("rejects a manifest read from another commit or with another plan fingerprint", async () => {
    for (const manifest of [
      { commitSha: "d".repeat(40), promotionPlanFingerprint: "b".repeat(64) },
      { commitSha: "a".repeat(40), promotionPlanFingerprint: "e".repeat(64) },
    ]) {
      const port = createHoidGitHubTopicAssignmentMergeReviewPort(api(pullRequest(), manifest));
      await expect(port.fetchMergedPromotionSnapshot(request)).rejects.toThrow();
    }
  });

  it("rejects malformed requests and non-canonical manifest paths", async () => {
    const port = createHoidGitHubTopicAssignmentMergeReviewPort(api());
    await expect(port.fetchMergedPromotionSnapshot({
      ...request,
      promotionManifestPath: "src/hoid/topicTaxonomy.ts",
    } as unknown as HoidTopicAssignmentMergedSnapshotRequest)).rejects.toThrow();
    await expect(port.fetchMergedPromotionSnapshot({
      ...request,
      extra: true,
    } as unknown as HoidTopicAssignmentMergedSnapshotRequest)).rejects.toThrow();
  });

  it("does not invoke getters in an untrusted pull-request response", async () => {
    let invoked = false;
    const raw = pullRequest();
    Object.defineProperty(raw, "merged", {
      enumerable: true,
      get() {
        invoked = true;
        return true;
      },
    });
    const port = createHoidGitHubTopicAssignmentMergeReviewPort(api(raw));
    await expect(port.fetchMergedPromotionSnapshot(request)).rejects.toThrow();
    expect(invoked).toBe(false);
  });

  it("fails closed when the injected GitHub API is incomplete or unavailable", async () => {
    const incomplete = createHoidGitHubTopicAssignmentMergeReviewPort({});
    await expect(incomplete.fetchMergedPromotionSnapshot(request)).rejects.toThrow();

    const failing = createHoidGitHubTopicAssignmentMergeReviewPort({
      getPullRequest: async () => { throw new Error("offline"); },
      getPromotionManifestAtCommit: async () => ({ commitSha: "a".repeat(40), promotionPlanFingerprint: "b".repeat(64) }),
    });
    await expect(failing.fetchMergedPromotionSnapshot(request)).rejects.toThrow();
  });
});
