import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { buildHoidCursorReadingContext } from "./cursorReadingContext";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { resolveProductionHoidTopicAssignments } from "./topicAssignmentActivation";
import {
  composeHoidTopicRecommendations,
  type HoidTopicRecommendation,
} from "./topicRecommendations";
import {
  validateHoidTopicInterestContext,
  type HoidTopicInterestContext,
} from "./topicInterestContext";

type ProgressIdentity = Readonly<{ revision: number; fingerprint: string }>;

export type HoidTopicAnswerPort = (
  approvedClaimIds: readonly string[],
  progress: unknown,
) => unknown | Promise<unknown>;

export type HoidTopicInterestRecommendationResult =
  | Readonly<{
      status: "ready";
      items: readonly HoidTopicRecommendation[];
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "none";
      reason: "no-safe-reviewed-matches";
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-request"
        | "invalid-progress"
        | "progress-changed"
        | "context-missing"
        | "context-invalid"
        | "context-stale"
        | "assignments-not-activated"
        | "answers-unavailable"
        | "answers-failed"
        | "invalid-recommendations";
    }>;

export type HoidTopicInterestRecommendationGatewayConfig = Readonly<{
  /** Must return the authoritative SQLite v2 snapshot. */
  getCurrentProgress: () => unknown;
  /**
   * Trusted local port for rendering already-approved claims. It receives only
   * approved claim IDs and the current progress snapshot, never topic labels,
   * private EPUB content or prior conversation context. It must not call an
   * external language provider.
   */
  answerApprovedClaims?: HoidTopicAnswerPort;
}>;

function canonicalRecord(
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
  reason: Extract<HoidTopicInterestRecommendationResult, { status: "unavailable" }>["reason"],
): HoidTopicInterestRecommendationResult {
  return Object.freeze({ status: "unavailable", reason });
}

/**
 * Provider-neutral, progress-bound recommendation boundary. Interests are
 * explicit user selections, never inferred from behaviour or model output.
 * The production assignment registry and answer presentation remain the only
 * factual authority. An empty registry produces a neutral no-match result.
 */
export class HoidTopicInterestRecommendationGateway {
  constructor(private readonly config: HoidTopicInterestRecommendationGatewayConfig) {}

  async recommend(input: unknown): Promise<HoidTopicInterestRecommendationResult> {
    const raw = canonicalRecord(input, ["progress", "context", "limit"], ["progress", "context"]);
    if (!raw) return unavailable("invalid-request");
    const limit = raw.limit === undefined ? 5 : raw.limit;
    if (typeof limit !== "number" || !Number.isSafeInteger(limit) || limit < 1 || limit > 10) {
      return unavailable("invalid-request");
    }

    const requestedProgress = progressIdentity(raw.progress);
    if (!requestedProgress) return unavailable("invalid-progress");
    const validation = validateHoidTopicInterestContext(raw.context, requestedProgress);
    if (validation.status !== "valid") {
      if (validation.reason === "missing-context") return unavailable("context-missing");
      if (validation.reason === "invalid-progress") return unavailable("invalid-progress");
      if (validation.reason === "stale-context") return unavailable("context-stale");
      return unavailable("context-invalid");
    }

    let currentBefore: unknown;
    try {
      currentBefore = this.config.getCurrentProgress();
    } catch {
      return unavailable("invalid-progress");
    }
    const beforeIdentity = progressIdentity(currentBefore);
    if (!beforeIdentity) return unavailable("invalid-progress");
    if (!sameProgress(requestedProgress, beforeIdentity)) return unavailable("progress-changed");

    const reading = buildHoidCursorReadingContext(raw.progress);
    if (reading.status !== "ready") return unavailable("invalid-progress");
    const startedWorks = new Set(reading.context.positions.map(position => position.bookId));
    const selected = new Set(validation.context.topicIds);
    const activation = resolveProductionHoidTopicAssignments();
    if (activation.status === "inactive") {
      if (activation.reason === "no-topic-assignments") {
        return Object.freeze({
          status: "none",
          reason: "no-safe-reviewed-matches",
          progressRevision: requestedProgress.revision,
          progressFingerprint: requestedProgress.fingerprint,
        });
      }
      return unavailable("assignments-not-activated");
    }
    if (activation.status !== "active") return unavailable("invalid-recommendations");

    const assignments = activation.assignments;
    const claimIds = [...new Set(
      assignments
        .filter(assignment =>
          assignment.subjectKind === "work" &&
          selected.has(assignment.topicId) &&
          !startedWorks.has(assignment.subjectId)
        )
        .map(assignment => assignment.claimId),
    )].sort();

    let answers: unknown = [];
    if (claimIds.length > 0) {
      if (typeof this.config.answerApprovedClaims !== "function") {
        return unavailable("answers-unavailable");
      }
      try {
        answers = await this.config.answerApprovedClaims(Object.freeze(claimIds), raw.progress);
      } catch {
        return unavailable("answers-failed");
      }
    }

    // Revalidate both the caller-owned request snapshot and the live coordinator
    // snapshot after the optional asynchronous local answer port. This closes
    // mutation races in either object before evidence is composed.
    const requestAfterIdentity = progressIdentity(raw.progress);
    if (!requestAfterIdentity) return unavailable("invalid-progress");
    if (!sameProgress(requestedProgress, requestAfterIdentity)) return unavailable("progress-changed");

    let currentAfter: unknown;
    try {
      currentAfter = this.config.getCurrentProgress();
    } catch {
      return unavailable("invalid-progress");
    }
    const afterIdentity = progressIdentity(currentAfter);
    if (!afterIdentity) return unavailable("invalid-progress");
    if (!sameProgress(requestedProgress, afterIdentity)) return unavailable("progress-changed");

    const composed = composeHoidTopicRecommendations(
      validation.context.topicIds,
      raw.progress,
      answers,
      limit,
      assignments,
    );
    if (composed.status === "invalid") return unavailable("invalid-recommendations");

    if (composed.status === "none") {
      return Object.freeze({
        status: "none",
        reason: "no-safe-reviewed-matches",
        progressRevision: requestedProgress.revision,
        progressFingerprint: requestedProgress.fingerprint,
      });
    }

    return Object.freeze({
      status: "ready",
      items: composed.items,
      progressRevision: requestedProgress.revision,
      progressFingerprint: requestedProgress.fingerprint,
    });
  }
}

export function createHoidTopicInterestRecommendationGateway(
  config: HoidTopicInterestRecommendationGatewayConfig | null,
): HoidTopicInterestRecommendationGateway | null {
  if (
    config === null ||
    typeof config !== "object" ||
    typeof config.getCurrentProgress !== "function" ||
    (config.answerApprovedClaims !== undefined && typeof config.answerApprovedClaims !== "function")
  ) return null;
  return new HoidTopicInterestRecommendationGateway(config);
}
