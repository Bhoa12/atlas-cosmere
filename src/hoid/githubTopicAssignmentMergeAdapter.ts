import {
  HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH,
  type HoidTopicAssignmentMergeReviewPort,
  type HoidTopicAssignmentMergedSnapshotRequest,
} from "./topicAssignmentActivation";
import { HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH } from "./topicAssignmentPromotionAuthority";

export type HoidGitHubTopicAssignmentMergeApiPort = Readonly<{
  /** Return the raw GitHub REST pull-request object for the exact repository and PR. */
  getPullRequest(input: Readonly<{
    repositoryFullName: string;
    pullRequestNumber: number;
  }>): Promise<unknown>;
  /** Read the fixed promotion manifest from the exact reviewed PR head commit. */
  getPromotionManifestAtCommit(input: Readonly<{
    repositoryFullName: string;
    path: string;
    commitSha: string;
  }>): Promise<unknown>;
}>;

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/u;
const SHA_PATTERN = /^[a-f0-9]{40,64}$/u;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;

function ownDataValue(value: unknown, key: string): unknown {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
      return undefined;
    }
    return descriptor.value;
  } catch {
    return undefined;
  }
}

function canonicalRequest(value: unknown): HoidTopicAssignmentMergedSnapshotRequest | null {
  const keys = [
    "repositoryFullName",
    "pullRequestNumber",
    "expectedBaseRef",
    "expectedHeadRef",
    "expectedHeadSha",
    "promotionPlanFingerprint",
    "promotionManifestPath",
    "targetBranch",
  ];
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== "string" || !keys.includes(key))) return null;
    const record = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
      record[key] = descriptor.value;
    }
    if (
      typeof record.repositoryFullName !== "string" ||
      !REPOSITORY_PATTERN.test(record.repositoryFullName) ||
      !Number.isSafeInteger(record.pullRequestNumber) ||
      (record.pullRequestNumber as number) < 1 ||
      record.expectedBaseRef !== HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH ||
      typeof record.expectedHeadRef !== "string" ||
      !REF_PATTERN.test(record.expectedHeadRef) ||
      record.expectedHeadRef === HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH ||
      typeof record.expectedHeadSha !== "string" ||
      !SHA_PATTERN.test(record.expectedHeadSha) ||
      typeof record.promotionPlanFingerprint !== "string" ||
      !FINGERPRINT_PATTERN.test(record.promotionPlanFingerprint) ||
      typeof record.promotionManifestPath !== "string" ||
      record.promotionManifestPath !== HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH ||
      record.targetBranch !== HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH
    ) return null;
    return Object.freeze({
      repositoryFullName: record.repositoryFullName,
      pullRequestNumber: record.pullRequestNumber as number,
      expectedBaseRef: HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH,
      expectedHeadRef: record.expectedHeadRef,
      expectedHeadSha: record.expectedHeadSha,
      promotionPlanFingerprint: record.promotionPlanFingerprint,
      promotionManifestPath: record.promotionManifestPath as HoidTopicAssignmentMergedSnapshotRequest["promotionManifestPath"],
      targetBranch: HOID_TOPIC_ASSIGNMENT_ACTIVATION_TARGET_BRANCH,
    });
  } catch {
    return null;
  }
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  try {
    return new Date(parsed).toISOString() === value;
  } catch {
    return false;
  }
}

function methodFromPort<T>(value: unknown, methodName: string): ((request: T) => Promise<unknown>) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 4; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, methodName);
      if (descriptor) {
        if (!Object.prototype.hasOwnProperty.call(descriptor, "value") || typeof descriptor.value !== "function") return null;
        return (descriptor.value as (request: T) => Promise<unknown>).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * GitHub-specific adapter for the provider-neutral post-merge port.
 * It normalizes the raw REST PR response and reads the promotion manifest at
 * the exact reviewed head. The injected client is the only provider dependency.
 */
export function createHoidGitHubTopicAssignmentMergeReviewPort(
  apiInput: unknown,
): HoidTopicAssignmentMergeReviewPort {
  return Object.freeze({
    async fetchMergedPromotionSnapshot(requestInput: HoidTopicAssignmentMergedSnapshotRequest): Promise<unknown> {
      const request = canonicalRequest(requestInput);
      if (!request) throw new Error("Invalid merged topic-assignment request");

      const getPullRequest = methodFromPort<{
        repositoryFullName: string;
        pullRequestNumber: number;
      }>(apiInput, "getPullRequest");
      const getManifest = methodFromPort<{
        repositoryFullName: string;
        path: string;
        commitSha: string;
      }>(apiInput, "getPromotionManifestAtCommit");
      if (!getPullRequest || !getManifest) throw new Error("GitHub merge API port is incomplete");

      const [rawPullRequest, rawManifest] = await Promise.all([
        getPullRequest(Object.freeze({
          repositoryFullName: request.repositoryFullName,
          pullRequestNumber: request.pullRequestNumber,
        })),
        getManifest(Object.freeze({
          repositoryFullName: request.repositoryFullName,
          path: request.promotionManifestPath,
          commitSha: request.expectedHeadSha,
        })),
      ]);

      const state = ownDataValue(rawPullRequest, "state");
      const draft = ownDataValue(rawPullRequest, "draft");
      const merged = ownDataValue(rawPullRequest, "merged");
      const mergedAt = ownDataValue(rawPullRequest, "merged_at");
      const mergeCommitSha = ownDataValue(rawPullRequest, "merge_commit_sha");
      const base = ownDataValue(rawPullRequest, "base");
      const head = ownDataValue(rawPullRequest, "head");
      const pullRequestNumber = ownDataValue(rawPullRequest, "number");
      const baseRef = ownDataValue(base, "ref");
      const baseRepository = ownDataValue(ownDataValue(base, "repo"), "full_name");
      const headRef = ownDataValue(head, "ref");
      const headSha = ownDataValue(head, "sha");
      const manifestCommitSha = ownDataValue(rawManifest, "commitSha");
      const manifestFingerprint = ownDataValue(rawManifest, "promotionPlanFingerprint");

      if (
        state !== "closed" ||
        draft !== false ||
        merged !== true ||
        pullRequestNumber !== request.pullRequestNumber ||
        baseRef !== request.expectedBaseRef ||
        baseRepository !== request.repositoryFullName ||
        headRef !== request.expectedHeadRef ||
        headSha !== request.expectedHeadSha ||
        typeof mergeCommitSha !== "string" ||
        !SHA_PATTERN.test(mergeCommitSha) ||
        !canonicalTimestamp(mergedAt) ||
        manifestCommitSha !== request.expectedHeadSha ||
        manifestFingerprint !== request.promotionPlanFingerprint
      ) throw new Error("Merged PR or exact-head promotion manifest did not match");

      return Object.freeze({
        schemaVersion: 1,
        repositoryFullName: request.repositoryFullName,
        pullRequestNumber: request.pullRequestNumber,
        state: "closed",
        draft: false,
        merged: true,
        baseRef: request.expectedBaseRef,
        headRef: request.expectedHeadRef,
        headSha: request.expectedHeadSha,
        mergeCommitSha,
        promotionManifestPath: request.promotionManifestPath,
        promotionPlanFingerprint: request.promotionPlanFingerprint,
        mergedAt,
      });
    },
  });
}
