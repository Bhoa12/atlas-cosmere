import { describe, expect, it } from "vitest";
import { sha256Hex } from "./sha256";
import { HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH } from "./topicAssignmentPromotionAuthority";
import {
  createHoidGitHubRestTopicAssignmentMergeApiPort,
  type HoidGitHubRestFetch,
  type HoidGitHubRestResponse,
} from "./githubTopicAssignmentRestClient";

const TOKEN = "github_pat_read_only_test_token_1234567890";
const PLAN_FINGERPRINT = "d".repeat(64);

function manifest(overrides: Record<string, unknown> = {}) {
  const base = {
    schemaVersion: 1,
    assignmentCount: 1,
    assignmentIds: ["assignment.alpha"],
    assignmentReviewerIds: ["reviewer-1"],
    assignmentFingerprint: "a".repeat(64),
    evidenceFingerprint: "b".repeat(64),
    progressRevision: 8,
    progressFingerprint: "c".repeat(64),
    planFingerprint: PLAN_FINGERPRINT,
    ...overrides,
  };
  return {
    ...base,
    manifestFingerprint: sha256Hex(JSON.stringify([
      "hoid-topic-assignment-promotion-manifest-v1",
      base.assignmentCount,
      base.assignmentIds,
      base.assignmentReviewerIds,
      base.assignmentFingerprint,
      base.evidenceFingerprint,
      base.progressRevision,
      base.progressFingerprint,
      base.planFingerprint,
    ])),
  };
}

function jsonResponse(body: unknown, status = 200): HoidGitHubRestResponse {
  return Object.freeze({
    ok: status === 200,
    status,
    json: async () => body,
  });
}

function manifestResponse(value: unknown): unknown {
  const content = JSON.stringify(value);
  return {
    type: "file",
    path: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
    encoding: "base64",
    size: new TextEncoder().encode(content).byteLength,
    sha: "e".repeat(40),
    content: btoa(content),
  };
}

function fakeFetch(
  responder: (url: string, init: Parameters<HoidGitHubRestFetch>[1]) => HoidGitHubRestResponse,
  calls: Array<{ url: string; init: Parameters<HoidGitHubRestFetch>[1] }> = [],
): HoidGitHubRestFetch {
  return async (url, init) => {
    calls.push({ url, init });
    return responder(url, init);
  };
}

describe("read-only GitHub topic-assignment REST client", () => {
  it("reads the exact PR using a fixed GitHub origin and least-privilege GET request", async () => {
    const calls: Array<{ url: string; init: Parameters<HoidGitHubRestFetch>[1] }> = [];
    const pr = { number: 7, state: "closed", merged: true };
    const port = createHoidGitHubRestTopicAssignmentMergeApiPort(
      fakeFetch(() => jsonResponse(pr), calls),
      TOKEN,
    );

    await expect(port.getPullRequest({
      repositoryFullName: "Bhoa12/atlas-cosmere",
      pullRequestNumber: 7,
    })).resolves.toEqual(pr);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.github.com/repos/Bhoa12/atlas-cosmere/pulls/7");
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.redirect).toBe("error");
    expect(calls[0].init.cache).toBe("no-store");
    expect(calls[0].init.credentials).toBe("omit");
    expect(calls[0].init.headers.Authorization).toBe("Bearer " + TOKEN);
    expect(calls[0].init.headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
  });

  it("reads only the fixed promotion manifest at the exact reviewed commit", async () => {
    const calls: Array<{ url: string; init: Parameters<HoidGitHubRestFetch>[1] }> = [];
    const port = createHoidGitHubRestTopicAssignmentMergeApiPort(
      fakeFetch(() => jsonResponse(manifestResponse(manifest())), calls),
      TOKEN,
    );
    const commitSha = "f".repeat(40);

    await expect(port.getPromotionManifestAtCommit({
      repositoryFullName: "Bhoa12/atlas-cosmere",
      path: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
      commitSha,
    })).resolves.toEqual({
      commitSha,
      promotionPlanFingerprint: PLAN_FINGERPRINT,
    });

    expect(calls[0].url).toBe(
      "https://api.github.com/repos/Bhoa12/atlas-cosmere/contents/" +
      HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH + "?ref=" + commitSha,
    );
  });

  it("rejects a manifest with a wrong fingerprint or non-canonical registry arrays", async () => {
    const invalid = [
      { ...manifest(), manifestFingerprint: "0".repeat(64) },
      manifest({ assignmentIds: ["assignment.zeta", "assignment.alpha"], assignmentCount: 2 }),
      manifest({ assignmentReviewerIds: ["reviewer-2", "reviewer-1"] }),
      manifest({ unexpected: true }),
    ];
    for (const value of invalid) {
      const port = createHoidGitHubRestTopicAssignmentMergeApiPort(
        fakeFetch(() => jsonResponse(manifestResponse(value))),
        TOKEN,
      );
      await expect(port.getPromotionManifestAtCommit({
        repositoryFullName: "Bhoa12/atlas-cosmere",
        path: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
        commitSha: "f".repeat(40),
      })).rejects.toThrow();
    }
  });

  it("rejects alternate repositories, paths, malformed SHAs and PR numbers before network access", async () => {
    let calls = 0;
    const port = createHoidGitHubRestTopicAssignmentMergeApiPort(
      async () => {
        calls += 1;
        return jsonResponse({});
      },
      TOKEN,
    );

    await expect(port.getPullRequest({
      repositoryFullName: "https://attacker.example/Bhoa12/atlas-cosmere",
      pullRequestNumber: 1,
    })).rejects.toThrow();
    await expect(port.getPullRequest({
      repositoryFullName: "Bhoa12/atlas-cosmere",
      pullRequestNumber: 0,
    })).rejects.toThrow();
    await expect(port.getPromotionManifestAtCommit({
      repositoryFullName: "Bhoa12/atlas-cosmere",
      path: "src/hoid/topicTaxonomy.ts",
      commitSha: "f".repeat(40),
    })).rejects.toThrow();
    await expect(port.getPromotionManifestAtCommit({
      repositoryFullName: "Bhoa12/atlas-cosmere",
      path: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
      commitSha: "not-a-sha",
    })).rejects.toThrow();
    expect(calls).toBe(0);
  });

  it("rejects missing or malformed GitHub credentials without creating a client", () => {
    expect(() => createHoidGitHubRestTopicAssignmentMergeApiPort(null, TOKEN)).toThrow();
    expect(() => createHoidGitHubRestTopicAssignmentMergeApiPort(async () => jsonResponse({}), "short")).toThrow();
    expect(() => createHoidGitHubRestTopicAssignmentMergeApiPort(async () => jsonResponse({}), TOKEN + "\n")).toThrow();
  });

  it("fails closed on HTTP errors and does not echo transport errors or the token", async () => {
    const failing = createHoidGitHubRestTopicAssignmentMergeApiPort(
      async () => { throw new Error("network failure " + TOKEN); },
      TOKEN,
    );
    await expect(failing.getPullRequest({
      repositoryFullName: "Bhoa12/atlas-cosmere",
      pullRequestNumber: 7,
    })).rejects.toThrow("GitHub read request failed");

    const notFound = createHoidGitHubRestTopicAssignmentMergeApiPort(
      async () => jsonResponse({ message: "Not Found" }, 404),
      TOKEN,
    );
    await expect(notFound.getPullRequest({
      repositoryFullName: "Bhoa12/atlas-cosmere",
      pullRequestNumber: 7,
    })).rejects.toThrow("GitHub read request failed (404)");
  });

  it("rejects malformed base64, invalid UTF-8, oversized files and non-file responses", async () => {
    const valid = manifestResponse(manifest()) as Record<string, unknown>;
    const badBodies = [
      { ...valid, content: "%%%=" },
      { ...valid, content: btoa("\u00ff") },
      { ...valid, size: 999999 },
      { ...valid, type: "dir" },
    ];
    for (const body of badBodies) {
      const port = createHoidGitHubRestTopicAssignmentMergeApiPort(
        fakeFetch(() => jsonResponse(body)),
        TOKEN,
      );
      await expect(port.getPromotionManifestAtCommit({
        repositoryFullName: "Bhoa12/atlas-cosmere",
        path: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
        commitSha: "f".repeat(40),
      })).rejects.toThrow();
    }
  });

  it("rejects duplicate assignment IDs even when the manifest fingerprint is recomputed", async () => {
    const invalid = manifest({
      assignmentIds: ["assignment.alpha", "assignment.alpha"],
      assignmentCount: 2,
    });
    const port = createHoidGitHubRestTopicAssignmentMergeApiPort(
      fakeFetch(() => jsonResponse(manifestResponse(invalid))),
      TOKEN,
    );
    await expect(port.getPromotionManifestAtCommit({
      repositoryFullName: "Bhoa12/atlas-cosmere",
      path: HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH,
      commitSha: "f".repeat(40),
    })).rejects.toThrow();
  });
});
