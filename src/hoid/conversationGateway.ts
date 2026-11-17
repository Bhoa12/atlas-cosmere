import type { HoidCursorEvidenceRuntime } from "./cursorEvidenceRuntime";
import type { HoidClaimIntent, HoidEvidenceAnswer } from "./evidenceRuntime";
import type { HoidRecommendation } from "./recommendations";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";

type HoidConversationRuntime = Pick<HoidCursorEvidenceRuntime, "answer"> & {
  recommend?: (progress: unknown, limit?: number) => unknown | Promise<unknown>;
};

export type HoidConversationGatewayResult =
  | Readonly<{
      status: "ready";
      answer: HoidEvidenceAnswer;
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-request"
        | "invalid-progress"
        | "progress-changed"
        | "runtime-failed";
    }>;

export type HoidConversationRecommendationResult =
  | Readonly<{
      status: "ready";
      items: readonly HoidRecommendation[];
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-request"
        | "invalid-progress"
        | "progress-changed"
        | "runtime-unavailable"
        | "runtime-failed"
        | "invalid-recommendations";
    }>;

export type HoidConversationGatewayConfig = Readonly<{
  runtime: HoidConversationRuntime;
  /** Must return the coordinator's latest authoritative v2 snapshot. */
  getCurrentProgress: () => unknown;
}>;

const REQUEST_KEYS = ["question", "progress", "intent"] as const;
const RECOMMENDATION_KEYS = ["progress", "limit"] as const;
const MAX_QUESTION_LENGTH = 4_000;
const DEFAULT_RECOMMENDATION_LIMIT = 3;
const MAX_RECOMMENDATION_LIMIT = 20;

function canonicalRequest(value: unknown): Readonly<{
  question: string;
  progress: unknown;
  intent: HoidClaimIntent;
}> | null {
  const record = canonicalDataRecord(value, REQUEST_KEYS, ["question", "progress"]);
  if (!record) return null;

  const question = record.question;
  const intent = record.intent === undefined ? "explain" : record.intent;
  if (
    typeof question !== "string" ||
    question.length < 1 ||
    question.length > MAX_QUESTION_LENGTH ||
    question !== question.trim() ||
    /[\u0000-\u001F\u007F\p{Cf}]/u.test(question) ||
    (intent !== "explain" && intent !== "recommend" && intent !== "context")
  ) {
    return null;
  }

  return Object.freeze({
    question,
    progress: record.progress,
    intent,
  });
}

function canonicalDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }

    for (const key of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalDenseArray(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length > maximum || Object.getPrototypeOf(value) !== Array.prototype) {
      return null;
    }
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
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

type CanonicalRecommendationRequest = Readonly<{
  progress: unknown;
  limit: number;
}>;

function canonicalRecommendationRequest(value: unknown): CanonicalRecommendationRequest | null {
  const record = canonicalDataRecord(value, RECOMMENDATION_KEYS, ["progress"]);
  if (!record) return null;
  const limit = record.limit === undefined ? DEFAULT_RECOMMENDATION_LIMIT : record.limit;
  if (
    typeof limit !== "number" ||
    !Number.isSafeInteger(limit) ||
    limit < 0 ||
    limit > MAX_RECOMMENDATION_LIMIT
  ) return null;
  return Object.freeze({ progress: record.progress, limit });
}

type ProgressIdentity = Readonly<{ revision: number; fingerprint: string }>;

function progressIdentity(value: unknown): ProgressIdentity | null {
  const projection = projectHoidCursorProgressSnapshot(value);
  if (projection.status !== "ready") return null;
  return Object.freeze({
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
  });
}

function sameProgress(left: ProgressIdentity, right: ProgressIdentity): boolean {
  return left.revision === right.revision && left.fingerprint === right.fingerprint;
}

function unavailable(
  reason: Extract<HoidConversationGatewayResult, { status: "unavailable" }>["reason"],
): HoidConversationGatewayResult {
  return Object.freeze({ status: "unavailable", reason });
}

function unavailableRecommendation(
  reason: Extract<HoidConversationRecommendationResult, { status: "unavailable" }>["reason"],
): HoidConversationRecommendationResult {
  return Object.freeze({ status: "unavailable", reason });
}

type ParsedRecommendations =
  | Readonly<{ status: "ready"; items: readonly HoidRecommendation[] }>
  | Readonly<{ status: "invalid-progress" }>;

function canonicalRecommendationResult(
  value: unknown,
  limit: number,
  startedBookIds: readonly string[],
): ParsedRecommendations | null {
  const record = canonicalDataRecord(value, ["status", "items", "reason"], ["status"]);
  if (!record) return null;

  if (record.status === "abstain") {
    if (
      Object.keys(record).length !== 3 ||
      record.reason !== "invalid-progress"
    ) return null;
    const emptyItems = canonicalDenseArray(record.items, 0);
    if (!emptyItems || emptyItems.length !== 0) return null;
    return Object.freeze({ status: "invalid-progress" });
  }

  if (
    record.status !== "ready" ||
    Object.keys(record).length !== 2 ||
    !Object.prototype.hasOwnProperty.call(record, "items")
  ) return null;

  const rawItems = canonicalDenseArray(record.items, limit);
  if (!rawItems) return null;

  const started = new Set(startedBookIds);
  const seen = new Set<string>();
  const catalog = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title]));
  const items: HoidRecommendation[] = [];

  for (const raw of rawItems) {
    const item = canonicalDataRecord(raw, ["sourceId", "title", "reason"], ["sourceId", "title", "reason"]);
    if (!item) return null;

    const sourceId = item.sourceId;
    const title = item.title;
    if (
      typeof sourceId !== "string" ||
      typeof title !== "string" ||
      item.reason !== "unread-source" ||
      !catalog.has(sourceId) ||
      catalog.get(sourceId) !== title ||
      started.has(sourceId) ||
      seen.has(sourceId)
    ) return null;

    seen.add(sourceId);
    items.push(Object.freeze({
      sourceId,
      title,
      reason: "unread-source",
    }));
  }

  return Object.freeze({ status: "ready", items: Object.freeze(items) });
}

/**
 * Provider-neutral conversation boundary. It prevents answers and metadata-only
 * recommendations authorized under an old reading position from being rendered
 * after the reader changes progress.
 */
export class HoidConversationGateway {
  constructor(private readonly config: HoidConversationGatewayConfig) {}

  async answer(input: unknown): Promise<HoidConversationGatewayResult> {
    const request = canonicalRequest(input);
    if (!request) return unavailable("invalid-request");

    const requestedProgress = progressIdentity(request.progress);
    if (!requestedProgress) return unavailable("invalid-progress");

    let currentBefore: unknown;
    try {
      currentBefore = this.config.getCurrentProgress();
    } catch {
      return unavailable("invalid-progress");
    }

    const beforeIdentity = progressIdentity(currentBefore);
    if (!beforeIdentity) return unavailable("invalid-progress");
    if (!sameProgress(requestedProgress, beforeIdentity)) {
      return unavailable("progress-changed");
    }

    let answer: HoidEvidenceAnswer;
    try {
      answer = await this.config.runtime.answer({
        question: request.question,
        progress: request.progress,
        intent: request.intent,
      });
    } catch {
      return unavailable("runtime-failed");
    }

    let currentAfter: unknown;
    try {
      currentAfter = this.config.getCurrentProgress();
    } catch {
      return unavailable("invalid-progress");
    }

    const afterIdentity = progressIdentity(currentAfter);
    if (!afterIdentity) return unavailable("invalid-progress");
    if (!sameProgress(requestedProgress, afterIdentity)) {
      return unavailable("progress-changed");
    }

    return Object.freeze({
      status: "ready",
      answer,
      progressRevision: requestedProgress.revision,
      progressFingerprint: requestedProgress.fingerprint,
    });
  }

  async recommend(input: unknown): Promise<HoidConversationRecommendationResult> {
    const request = canonicalRecommendationRequest(input);
    if (!request) return unavailableRecommendation("invalid-request");

    const requestProjection = projectHoidCursorProgressSnapshot(request.progress);
    if (requestProjection.status !== "ready") {
      return unavailableRecommendation("invalid-progress");
    }
    const requestedProgress = Object.freeze({
      revision: requestProjection.revision,
      fingerprint: fingerprintHoidCursorProgressProjection(requestProjection),
    });

    let currentBefore: unknown;
    try {
      currentBefore = this.config.getCurrentProgress();
    } catch {
      return unavailableRecommendation("invalid-progress");
    }
    const beforeIdentity = progressIdentity(currentBefore);
    if (!beforeIdentity) return unavailableRecommendation("invalid-progress");
    if (!sameProgress(requestedProgress, beforeIdentity)) {
      return unavailableRecommendation("progress-changed");
    }

    const recommend = this.config.runtime.recommend;
    if (typeof recommend !== "function") {
      return unavailableRecommendation("runtime-unavailable");
    }

    let rawResult: unknown;
    try {
      rawResult = await recommend.call(this.config.runtime, request.progress, request.limit);
    } catch {
      return unavailableRecommendation("runtime-failed");
    }

    let currentAfter: unknown;
    try {
      currentAfter = this.config.getCurrentProgress();
    } catch {
      return unavailableRecommendation("invalid-progress");
    }
    const afterIdentity = progressIdentity(currentAfter);
    if (!afterIdentity) return unavailableRecommendation("invalid-progress");
    if (!sameProgress(requestedProgress, afterIdentity)) {
      return unavailableRecommendation("progress-changed");
    }

    const parsed = canonicalRecommendationResult(
      rawResult,
      request.limit,
      requestProjection.startedBookIds,
    );
    if (!parsed) return unavailableRecommendation("invalid-recommendations");
    if (parsed.status === "invalid-progress") {
      return unavailableRecommendation("invalid-progress");
    }

    return Object.freeze({
      status: "ready",
      items: parsed.items,
      progressRevision: requestedProgress.revision,
      progressFingerprint: requestedProgress.fingerprint,
    });
  }
}

export function createHoidConversationGateway(
  config: HoidConversationGatewayConfig | null,
): HoidConversationGateway | null {
  if (
    config === null ||
    typeof config !== "object" ||
    config.runtime === null ||
    typeof config.runtime !== "object" ||
    typeof config.runtime.answer !== "function" ||
    typeof config.getCurrentProgress !== "function"
  ) return null;
  return new HoidConversationGateway(config);
}
