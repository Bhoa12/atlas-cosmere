import { sha256Hex } from "./sha256";
import { HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH } from "./topicAssignmentPromotionAuthority";
import type { HoidGitHubTopicAssignmentMergeApiPort } from "./githubTopicAssignmentMergeAdapter";

export type HoidGitHubRestResponse = Readonly<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type HoidGitHubRestFetch = (
  url: string,
  init: Readonly<{
    method: "GET";
    headers: Readonly<Record<string, string>>;
    redirect: "error";
    cache: "no-store";
    credentials: "omit";
  }>,
) => Promise<HoidGitHubRestResponse>;

const API_ORIGIN = "https://api.github.com";
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const COMMIT_SHA_PATTERN = /^[a-f0-9]{40,64}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ASSIGNMENT_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const REVIEWER_ID_PATTERN = /^[A-Za-z0-9_.-]{1,100}$/u;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const MAX_MANIFEST_BYTES = 32 * 1024;

const MANIFEST_KEYS = new Set([
  "schemaVersion",
  "assignmentCount",
  "assignmentIds",
  "assignmentReviewerIds",
  "assignmentFingerprint",
  "evidenceFingerprint",
  "progressRevision",
  "progressFingerprint",
  "planFingerprint",
  "manifestFingerprint",
]);

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


function canonicalInputRecord(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.length || keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))) {
      return null;
    }
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of allowedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalManifestRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== MANIFEST_KEYS.size) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !MANIFEST_KEYS.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      result[key] = descriptor.value;
    }
    for (const key of MANIFEST_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalSortedStrings(value: unknown, pattern: RegExp, maximum: number): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > maximum || Object.getPrototypeOf(value) !== Array.prototype) {
      return null;
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string" ||
        !pattern.test(descriptor.value) ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) return null;
    }
    const sorted = [...result].sort();
    if (sorted.some((item, index) => item !== result[index])) return null;
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function decodeBase64Utf8(value: string): string | null {
  const normalized = value.replace(/\s+/gu, "");
  if (normalized.length === 0 || normalized.length % 4 !== 0 || !BASE64_PATTERN.test(normalized)) return null;

  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  const bytes = new Uint8Array((normalized.length / 4) * 3 - padding);
  let output = 0;

  for (let index = 0; index < normalized.length; index += 4) {
    const a = BASE64_ALPHABET.indexOf(normalized[index]);
    const b = BASE64_ALPHABET.indexOf(normalized[index + 1]);
    const c = normalized[index + 2] === "=" ? 0 : BASE64_ALPHABET.indexOf(normalized[index + 2]);
    const d = normalized[index + 3] === "=" ? 0 : BASE64_ALPHABET.indexOf(normalized[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) return null;

    const block = (a << 18) | (b << 12) | (c << 6) | d;
    if (output < bytes.length) bytes[output++] = (block >> 16) & 0xff;
    if (output < bytes.length) bytes[output++] = (block >> 8) & 0xff;
    if (output < bytes.length) bytes[output++] = block & 0xff;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function validatePromotionManifest(value: unknown, expectedPlanFingerprint: string): boolean {
  const raw = canonicalManifestRecord(value);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    !Number.isSafeInteger(raw.assignmentCount) ||
    (raw.assignmentCount as number) < 1 ||
    (raw.assignmentCount as number) > 512 ||
    !Number.isSafeInteger(raw.progressRevision) ||
    (raw.progressRevision as number) < 0 ||
    typeof raw.assignmentFingerprint !== "string" ||
    !SHA256_PATTERN.test(raw.assignmentFingerprint) ||
    typeof raw.evidenceFingerprint !== "string" ||
    !SHA256_PATTERN.test(raw.evidenceFingerprint) ||
    typeof raw.progressFingerprint !== "string" ||
    !SHA256_PATTERN.test(raw.progressFingerprint) ||
    typeof raw.planFingerprint !== "string" ||
    raw.planFingerprint !== expectedPlanFingerprint ||
    !SHA256_PATTERN.test(raw.planFingerprint) ||
    typeof raw.manifestFingerprint !== "string" ||
    !SHA256_PATTERN.test(raw.manifestFingerprint)
  ) return false;

  const assignmentIds = canonicalSortedStrings(raw.assignmentIds, ASSIGNMENT_ID_PATTERN, 512);
  const reviewerIds = canonicalSortedStrings(raw.assignmentReviewerIds, REVIEWER_ID_PATTERN, 512);
  if (!assignmentIds || !reviewerIds || assignmentIds.length !== raw.assignmentCount) return false;

  const computedPlanFingerprint = sha256Hex(JSON.stringify([
    "hoid-topic-assignment-promotion-v1",
    raw.assignmentCount,
    assignmentIds,
    reviewerIds,
    raw.assignmentFingerprint,
    raw.evidenceFingerprint,
    raw.progressRevision,
    raw.progressFingerprint,
  ]));
  if (computedPlanFingerprint !== raw.planFingerprint) return false;

  const expectedFingerprint = sha256Hex(JSON.stringify([
    "hoid-topic-assignment-promotion-manifest-v1",
    raw.assignmentCount,
    assignmentIds,
    reviewerIds,
    raw.assignmentFingerprint,
    raw.evidenceFingerprint,
    raw.progressRevision,
    raw.progressFingerprint,
    raw.planFingerprint,
  ]));
  return expectedFingerprint === raw.manifestFingerprint;
}

function decodeRepository(value: unknown): Readonly<{ owner: string; repo: string }> | null {
  if (typeof value !== "string" || !REPOSITORY_PATTERN.test(value)) return null;
  const [owner, repo] = value.split("/");
  return owner && repo ? Object.freeze({ owner, repo }) : null;
}

function encodePath(path: string): string {
  return path.split("/").map(segment => encodeURIComponent(segment)).join("/");
}

function validToken(value: unknown): value is string {
  return typeof value === "string" &&
    value.length >= 20 &&
    value.length <= 500 &&
    value.trim() === value &&
    /^[\x21-\x7e]+$/u.test(value);
}

/**
 * Read-only GitHub REST client for editorial maintenance tooling.
 *
 * The fetch implementation and token are injected. This module never reads
 * process.env, never writes GitHub resources and is not instantiated by the
 * reader-facing Hoid screen. Callers should provide a least-privilege token
 * with contents:read and pull-requests:read only.
 */
export function createHoidGitHubRestTopicAssignmentMergeApiPort(
  fetchInput: unknown,
  tokenInput: unknown,
): HoidGitHubTopicAssignmentMergeApiPort {
  if (typeof fetchInput !== "function" || !validToken(tokenInput)) {
    throw new Error("Invalid read-only GitHub REST client configuration");
  }
  const fetcher = fetchInput as HoidGitHubRestFetch;
  const token = tokenInput;

  async function getJson(url: string): Promise<unknown> {
    let response: HoidGitHubRestResponse;
    try {
      response = await fetcher(url, Object.freeze({
        method: "GET",
        headers: Object.freeze({
          Accept: "application/vnd.github+json",
          Authorization: "Bearer " + token,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "atlas-cosmere-hoid-editorial-audit",
        }),
        redirect: "error",
        cache: "no-store",
        credentials: "omit",
      }));
    } catch {
      throw new Error("GitHub read request failed");
    }

    if (!response || response.ok !== true || response.status !== 200) {
      const status = response && Number.isSafeInteger(response.status) ? response.status : 0;
      throw new Error("GitHub read request failed (" + status + ")");
    }

    try {
      return await response.json();
    } catch {
      throw new Error("GitHub returned an invalid JSON response");
    }
  }

  return Object.freeze({
    async getPullRequest(input): Promise<unknown> {
      const raw = canonicalInputRecord(input, ["repositoryFullName", "pullRequestNumber"]);
      const repository = decodeRepository(raw?.repositoryFullName);
      const pullRequestNumber = raw?.pullRequestNumber;
      if (!repository || !Number.isSafeInteger(pullRequestNumber) || (pullRequestNumber as number) < 1) {
        throw new Error("Invalid GitHub pull-request lookup");
      }

      const url = API_ORIGIN + "/repos/" +
        encodeURIComponent(repository.owner) + "/" +
        encodeURIComponent(repository.repo) + "/pulls/" + (pullRequestNumber as number);
      return getJson(url);
    },

    async getPromotionManifestAtCommit(input): Promise<unknown> {
      const raw = canonicalInputRecord(input, ["repositoryFullName", "path", "commitSha"]);
      const repository = decodeRepository(raw?.repositoryFullName);
      const path = raw?.path;
      const commitSha = raw?.commitSha;
      if (
        !repository ||
        path !== HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH ||
        typeof commitSha !== "string" ||
        !COMMIT_SHA_PATTERN.test(commitSha)
      ) throw new Error("Invalid GitHub promotion-manifest lookup");

      const url = API_ORIGIN + "/repos/" +
        encodeURIComponent(repository.owner) + "/" +
        encodeURIComponent(repository.repo) + "/contents/" +
        encodePath(path) + "?ref=" + encodeURIComponent(commitSha);
      const response = await getJson(url);
      const type = ownDataValue(response, "type");
      const responsePath = ownDataValue(response, "path");
      const encoding = ownDataValue(response, "encoding");
      const size = ownDataValue(response, "size");
      const blobSha = ownDataValue(response, "sha");
      const content = ownDataValue(response, "content");

      if (
        type !== "file" ||
        responsePath !== HOID_TOPIC_ASSIGNMENT_PROMOTION_MANIFEST_PATH ||
        encoding !== "base64" ||
        !Number.isSafeInteger(size) ||
        (size as number) < 1 ||
        (size as number) > MAX_MANIFEST_BYTES ||
        typeof blobSha !== "string" ||
        !COMMIT_SHA_PATTERN.test(blobSha) ||
        typeof content !== "string" ||
        content.length > Math.ceil(MAX_MANIFEST_BYTES * 4 / 3) + 256
      ) throw new Error("GitHub promotion manifest is malformed");

      const decoded = decodeBase64Utf8(content);
      if (decoded === null || new TextEncoder().encode(decoded).byteLength !== size) {
        throw new Error("GitHub promotion manifest encoding is invalid");
      }

      let manifest: unknown;
      try {
        manifest = JSON.parse(decoded);
      } catch {
        throw new Error("GitHub promotion manifest JSON is invalid");
      }

      const planFingerprint = ownDataValue(manifest, "planFingerprint");
      if (
        typeof planFingerprint !== "string" ||
        !SHA256_PATTERN.test(planFingerprint) ||
        !validatePromotionManifest(manifest, planFingerprint)
      ) throw new Error("GitHub promotion manifest validation failed");

      return Object.freeze({
        commitSha,
        promotionPlanFingerprint: planFingerprint,
      });
    },
  });
}
