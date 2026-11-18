import {
  type HoidProtectedReviewFetchRequest,
  type HoidSourceControlReviewPort,
} from "./promotionReviewAuthority";

export type HoidGitHubReviewApiPort = Readonly<{
  getPullRequest(input: Readonly<{
    repositoryFullName: string;
    pullRequestNumber: number;
  }>): Promise<unknown>;
  listPullRequestReviews(input: Readonly<{
    repositoryFullName: string;
    pullRequestNumber: number;
  }>): Promise<unknown>;
  getEffectiveBranchProtection(input: Readonly<{
    repositoryFullName: string;
    branchName: string;
  }>): Promise<unknown>;
  listCodeOwnerApprovalReviewerIds(input: Readonly<{
    repositoryFullName: string;
    pullRequestNumber: number;
    headSha: string;
  }>): Promise<unknown>;
  getPromotionManifestAtCommit(input: Readonly<{
    repositoryFullName: string;
    path: string;
    commitSha: string;
  }>): Promise<unknown>;
}>;

type CanonicalPullRequest = Readonly<{
  state: "open" | "closed";
  draft: boolean;
  baseRef: string;
  headRef: string;
  headSha: string;
  authorId: string;
}>;

type CanonicalReview = Readonly<{
  reviewId: string;
  reviewerId: string;
  state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED";
  commitSha: string;
  submittedAt: string;
  dismissed: boolean;
}>;

type CanonicalBranchProtection = Readonly<{
  requiredApprovingReviewCount: number;
  requireCodeOwnerReview: boolean;
  dismissStaleReviews: boolean;
  enforceAdmins: boolean;
}>;

const REQUEST_KEYS = new Set([
  "schemaVersion",
  "repositoryFullName",
  "pullRequestNumber",
  "expectedBaseRef",
  "expectedHeadRef",
  "expectedHeadSha",
  "promotionManifestPath",
  "minimumApprovals",
  "requireCodeOwnerReview",
  "requireDismissStaleReviews",
  "requireEnforcedAdmins",
  "promotionPlanFingerprint",
]);
const PULL_REQUEST_KEYS = new Set(["state", "draft", "baseRef", "headRef", "headSha", "authorId"]);
const REVIEW_KEYS = new Set([
  "reviewId",
  "reviewerId",
  "state",
  "commitSha",
  "submittedAt",
  "dismissed",
]);
const PROTECTION_KEYS = new Set([
  "requiredApprovingReviewCount",
  "requireCodeOwnerReview",
  "dismissStaleReviews",
  "enforceAdmins",
]);
const MANIFEST_KEYS = new Set(["commitSha", "promotionPlanFingerprint"]);
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/;
const PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]{1,240}$/;
const SHA_PATTERN = /^[a-f0-9]{40,64}$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

function canonicalRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.size) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of allowedKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalDenseArray(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length > maximum) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result.push(descriptor.value);
    }
    return Object.freeze(result);
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

function methodFromPort<T>(
  value: unknown,
  methodName: string,
): ((request: T) => Promise<unknown>) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 4; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, methodName);
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as (request: T) => Promise<unknown>).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

function canonicalRequest(value: unknown): HoidProtectedReviewFetchRequest | null {
  const raw = canonicalRecord(value, REQUEST_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    typeof raw.repositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(raw.repositoryFullName) ||
    !Number.isSafeInteger(raw.pullRequestNumber) ||
    (raw.pullRequestNumber as number) < 1 ||
    typeof raw.expectedBaseRef !== "string" ||
    !REF_PATTERN.test(raw.expectedBaseRef) ||
    typeof raw.expectedHeadRef !== "string" ||
    !REF_PATTERN.test(raw.expectedHeadRef) ||
    raw.expectedBaseRef === raw.expectedHeadRef ||
    typeof raw.expectedHeadSha !== "string" ||
    !SHA_PATTERN.test(raw.expectedHeadSha) ||
    typeof raw.promotionManifestPath !== "string" ||
    !PATH_PATTERN.test(raw.promotionManifestPath) ||
    !Number.isSafeInteger(raw.minimumApprovals) ||
    (raw.minimumApprovals as number) < 1 ||
    (raw.minimumApprovals as number) > 5 ||
    typeof raw.requireCodeOwnerReview !== "boolean" ||
    typeof raw.requireDismissStaleReviews !== "boolean" ||
    typeof raw.requireEnforcedAdmins !== "boolean" ||
    typeof raw.promotionPlanFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(raw.promotionPlanFingerprint)
  ) return null;
  return Object.freeze({
    schemaVersion: 1,
    repositoryFullName: raw.repositoryFullName,
    pullRequestNumber: raw.pullRequestNumber as number,
    expectedBaseRef: raw.expectedBaseRef,
    expectedHeadRef: raw.expectedHeadRef,
    expectedHeadSha: raw.expectedHeadSha,
    promotionManifestPath: raw.promotionManifestPath,
    minimumApprovals: raw.minimumApprovals as number,
    requireCodeOwnerReview: raw.requireCodeOwnerReview,
    requireDismissStaleReviews: raw.requireDismissStaleReviews,
    requireEnforcedAdmins: raw.requireEnforcedAdmins,
    promotionPlanFingerprint: raw.promotionPlanFingerprint,
  });
}

function canonicalPullRequest(value: unknown): CanonicalPullRequest | null {
  const raw = canonicalRecord(value, PULL_REQUEST_KEYS);
  if (
    !raw ||
    !(raw.state === "open" || raw.state === "closed") ||
    typeof raw.draft !== "boolean" ||
    typeof raw.baseRef !== "string" ||
    !REF_PATTERN.test(raw.baseRef) ||
    typeof raw.headRef !== "string" ||
    !REF_PATTERN.test(raw.headRef) ||
    typeof raw.headSha !== "string" ||
    !SHA_PATTERN.test(raw.headSha) ||
    typeof raw.authorId !== "string" ||
    !raw.authorId.trim() ||
    raw.authorId.length > 128
  ) return null;
  return Object.freeze({
    state: raw.state,
    draft: raw.draft,
    baseRef: raw.baseRef,
    headRef: raw.headRef,
    headSha: raw.headSha,
    authorId: raw.authorId,
  });
}

function canonicalReview(value: unknown): CanonicalReview | null {
  const raw = canonicalRecord(value, REVIEW_KEYS);
  if (
    !raw ||
    typeof raw.reviewId !== "string" ||
    !raw.reviewId.trim() ||
    raw.reviewId.length > 128 ||
    typeof raw.reviewerId !== "string" ||
    !raw.reviewerId.trim() ||
    raw.reviewerId.length > 128 ||
    !(
      raw.state === "APPROVED" ||
      raw.state === "CHANGES_REQUESTED" ||
      raw.state === "COMMENTED" ||
      raw.state === "DISMISSED"
    ) ||
    typeof raw.commitSha !== "string" ||
    !SHA_PATTERN.test(raw.commitSha) ||
    !canonicalTimestamp(raw.submittedAt) ||
    typeof raw.dismissed !== "boolean"
  ) return null;
  return Object.freeze({
    reviewId: raw.reviewId,
    reviewerId: raw.reviewerId,
    state: raw.state,
    commitSha: raw.commitSha,
    submittedAt: raw.submittedAt,
    dismissed: raw.dismissed || raw.state === "DISMISSED",
  });
}

function canonicalProtection(value: unknown): CanonicalBranchProtection | null {
  const raw = canonicalRecord(value, PROTECTION_KEYS);
  if (
    !raw ||
    !Number.isSafeInteger(raw.requiredApprovingReviewCount) ||
    (raw.requiredApprovingReviewCount as number) < 0 ||
    (raw.requiredApprovingReviewCount as number) > 10 ||
    typeof raw.requireCodeOwnerReview !== "boolean" ||
    typeof raw.dismissStaleReviews !== "boolean" ||
    typeof raw.enforceAdmins !== "boolean"
  ) return null;
  return Object.freeze({
    requiredApprovingReviewCount: raw.requiredApprovingReviewCount as number,
    requireCodeOwnerReview: raw.requireCodeOwnerReview,
    dismissStaleReviews: raw.dismissStaleReviews,
    enforceAdmins: raw.enforceAdmins,
  });
}

function canonicalCodeOwnerIds(value: unknown): ReadonlySet<string> | null {
  const values = canonicalDenseArray(value, 100);
  if (!values) return null;
  const ids = new Set<string>();
  for (const item of values) {
    if (typeof item !== "string" || !item.trim() || item.length > 128 || ids.has(item)) return null;
    ids.add(item);
  }
  return ids;
}

function canonicalManifest(value: unknown): Readonly<{
  commitSha: string;
  promotionPlanFingerprint: string;
}> | null {
  const raw = canonicalRecord(value, MANIFEST_KEYS);
  if (
    !raw ||
    typeof raw.commitSha !== "string" ||
    !SHA_PATTERN.test(raw.commitSha) ||
    typeof raw.promotionPlanFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(raw.promotionPlanFingerprint)
  ) return null;
  return Object.freeze({
    commitSha: raw.commitSha,
    promotionPlanFingerprint: raw.promotionPlanFingerprint,
  });
}

function latestReviews(
  input: readonly CanonicalReview[],
  codeOwnerIds: ReadonlySet<string>,
): readonly Readonly<{
  reviewId: string;
  reviewerId: string;
  state: CanonicalReview["state"];
  commitSha: string;
  submittedAt: string;
  dismissed: boolean;
  isCodeOwner: boolean;
}>[] {
  const reviewIds = new Set<string>();
  const latest = new Map<string, CanonicalReview>();
  for (const review of input) {
    if (reviewIds.has(review.reviewId)) throw new Error("Duplicate GitHub review ID");
    reviewIds.add(review.reviewId);
    const current = latest.get(review.reviewerId);
    if (!current) {
      latest.set(review.reviewerId, review);
      continue;
    }
    const submittedAt = Date.parse(review.submittedAt);
    const currentSubmittedAt = Date.parse(current.submittedAt);
    if (submittedAt === currentSubmittedAt) {
      throw new Error("Ambiguous GitHub review ordering for one reviewer");
    }
    if (submittedAt > currentSubmittedAt) latest.set(review.reviewerId, review);
  }
  return Object.freeze([...latest.values()]
    .sort((left, right) => left.reviewerId.localeCompare(right.reviewerId))
    .map(review => Object.freeze({
      reviewId: review.reviewId,
      reviewerId: review.reviewerId,
      state: review.state,
      commitSha: review.commitSha,
      submittedAt: review.submittedAt,
      dismissed: review.dismissed,
      isCodeOwner: codeOwnerIds.has(review.reviewerId),
    })));
}

/**
 * GitHub-specific composition adapter. The injected read API client is the
 * only provider-specific dependency; the Hoid core sees the generic review port.
 * The client must resolve effective CODEOWNERS approvals and read the manifest
 * at the exact commit SHA supplied here.
 */
export function createHoidGitHubSourceControlReviewPort(
  apiInput: unknown,
  now: () => string = () => new Date().toISOString(),
): HoidSourceControlReviewPort {
  return Object.freeze({
    async fetchProtectedReviewSnapshot(requestInput: HoidProtectedReviewFetchRequest): Promise<unknown> {
      const request = canonicalRequest(requestInput);
      if (!request) throw new Error("Invalid protected review request");

      const getPullRequest = methodFromPort(apiInput, "getPullRequest");
      const listPullRequestReviews = methodFromPort(apiInput, "listPullRequestReviews");
      const getEffectiveBranchProtection = methodFromPort(apiInput, "getEffectiveBranchProtection");
      const listCodeOwnerApprovalReviewerIds = methodFromPort(apiInput, "listCodeOwnerApprovalReviewerIds");
      const getPromotionManifestAtCommit = methodFromPort(apiInput, "getPromotionManifestAtCommit");
      if (
        !getPullRequest ||
        !listPullRequestReviews ||
        !getEffectiveBranchProtection ||
        !listCodeOwnerApprovalReviewerIds ||
        !getPromotionManifestAtCommit
      ) throw new Error("GitHub review API port is incomplete");

      const prRequest = Object.freeze({
        repositoryFullName: request.repositoryFullName,
        pullRequestNumber: request.pullRequestNumber,
      });
      const pullRequest = canonicalPullRequest(await getPullRequest(prRequest));
      if (!pullRequest) throw new Error("Invalid GitHub pull request response");

      const reviewRequest = prRequest;
      const protectionRequest = Object.freeze({
        repositoryFullName: request.repositoryFullName,
        branchName: pullRequest.baseRef,
      });
      const codeOwnerRequest = Object.freeze({
        repositoryFullName: request.repositoryFullName,
        pullRequestNumber: request.pullRequestNumber,
        headSha: pullRequest.headSha,
      });
      const manifestRequest = Object.freeze({
        repositoryFullName: request.repositoryFullName,
        path: request.promotionManifestPath,
        commitSha: pullRequest.headSha,
      });

      const [rawReviews, rawProtection, rawCodeOwners, rawManifest] = await Promise.all([
        listPullRequestReviews(reviewRequest),
        getEffectiveBranchProtection(protectionRequest),
        listCodeOwnerApprovalReviewerIds(codeOwnerRequest),
        getPromotionManifestAtCommit(manifestRequest),
      ]);

      const reviewItems = canonicalDenseArray(rawReviews, 200);
      if (!reviewItems) throw new Error("Invalid GitHub review list");
      const reviews: CanonicalReview[] = [];
      for (const item of reviewItems) {
        const review = canonicalReview(item);
        if (!review) throw new Error("Invalid GitHub review record");
        reviews.push(review);
      }

      const protection = canonicalProtection(rawProtection);
      if (!protection) throw new Error("Branch protection could not be verified");
      const codeOwnerIds = canonicalCodeOwnerIds(rawCodeOwners);
      if (!codeOwnerIds) throw new Error("CODEOWNERS approval identities could not be verified");
      const manifest = canonicalManifest(rawManifest);
      if (!manifest || manifest.commitSha !== pullRequest.headSha) {
        throw new Error("Promotion manifest was not read from the exact pull request head");
      }

      const verifiedAt = now();
      if (!canonicalTimestamp(verifiedAt)) throw new Error("Invalid review verification timestamp");

      return Object.freeze({
        schemaVersion: 1,
        repositoryFullName: request.repositoryFullName,
        pullRequestNumber: request.pullRequestNumber,
        state: pullRequest.state,
        draft: pullRequest.draft,
        baseRef: pullRequest.baseRef,
        headRef: pullRequest.headRef,
        headSha: pullRequest.headSha,
        authorId: pullRequest.authorId,
        promotionManifestPath: request.promotionManifestPath,
        promotionPlanFingerprint: manifest.promotionPlanFingerprint,
        verifiedAt,
        branchProtection: Object.freeze({
          status: "verified",
          requiredApprovingReviewCount: protection.requiredApprovingReviewCount,
          requireCodeOwnerReview: protection.requireCodeOwnerReview,
          dismissStaleReviews: protection.dismissStaleReviews,
          enforceAdmins: protection.enforceAdmins,
        }),
        reviews: latestReviews(reviews, codeOwnerIds),
      });
    },
  });
}
