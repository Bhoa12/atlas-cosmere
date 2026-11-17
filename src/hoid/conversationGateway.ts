import type { HoidCursorEvidenceRuntime } from "./cursorEvidenceRuntime";
import type { HoidEvidenceAnswer } from "./evidenceRuntime";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";

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

export type HoidConversationGatewayConfig = Readonly<{
  runtime: Pick<HoidCursorEvidenceRuntime, "answer">;
  /** Must return the latest authoritative v2 snapshot, not a cached request snapshot. */
  getCurrentProgress: () => unknown;
}>;

const REQUEST_KEYS = ["question", "progress"] as const;
const MAX_QUESTION_LENGTH = 4_000;

function canonicalRequest(value: unknown): Readonly<{ question: string; progress: unknown }> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== REQUEST_KEYS.length) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !REQUEST_KEYS.includes(key as typeof REQUEST_KEYS[number])) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }

    if (
      typeof result.question !== "string" ||
      result.question.length < 1 ||
      result.question.length > MAX_QUESTION_LENGTH ||
      result.question !== result.question.trim() ||
      /[\u0000-\u001F\u007F]/u.test(result.question) ||
      !Object.prototype.hasOwnProperty.call(result, "progress")
    ) return null;

    return Object.freeze({ question: result.question, progress: result.progress });
  } catch {
    return null;
  }
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

/**
 * A provider-neutral conversation boundary that prevents an answer authorized
 * under an old reading position from being rendered after the reader changes
 * progress. It checks the authoritative snapshot before and after the strict
 * evidence runtime. A stale answer is discarded in full; its text and sources
 * are never returned to the UI.
 *
 * This is a response-freshness guard, not a cancellation primitive: a provider
 * already invoked by the strict runtime may finish, but its result is discarded
 * if the current progress no longer matches the request snapshot.
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
