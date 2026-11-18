import {
  createProductionHoidExplanationPlan,
  renderProductionHoidExplanationPlan,
  type HoidExplanationPlan,
  type HoidExplanationPlanResult,
  type HoidKnowledgeGraphQuery,
  type HoidRenderedExplanation,
} from "./knowledgeGraphQuery";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";

export type HoidExplanationEnginePort = Readonly<{
  createPlan: (
    progress: unknown,
    query: HoidKnowledgeGraphQuery,
  ) => HoidExplanationPlanResult;
  renderPlan: (
    plan: HoidExplanationPlan,
    progress: unknown,
  ) => HoidRenderedExplanation;
}>;

export type HoidExplanationGatewayResult =
  | Readonly<{
      status: "ready";
      explanation: HoidRenderedExplanation & Readonly<{ status: "ready" }>;
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "no-path";
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-request"
        | "invalid-progress"
        | "progress-changed"
        | "engine-failed"
        | "plan-unavailable"
        | "invalid-plan"
        | "render-unavailable"
        | "invalid-rendered-explanation";
    }>;

export type HoidExplanationGatewayConfig = Readonly<{
  /** Must return the latest authoritative cursor-native v2 snapshot. */
  getCurrentProgress: () => unknown;
  /** Trusted local planner/renderer. Production uses the source-controlled factory below. */
  engine: HoidExplanationEnginePort;
}>;

type ProgressIdentity = Readonly<{
  revision: number;
  fingerprint: string;
}>;

type CanonicalRequest = Readonly<{
  progress: unknown;
  query: HoidKnowledgeGraphQuery;
}>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const MAX_EXPLANATION_LENGTH = 32_000;
const MAX_SEGMENTS = 50;
const MAX_SOURCES = 512;

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

function canonicalQuery(value: unknown): HoidKnowledgeGraphQuery | null {
  const record = canonicalRecord(
    value,
    ["fromId", "toId", "maxDepth", "maxPaths"],
    ["fromId", "toId"],
  );
  if (!record) return null;

  const fromId = record.fromId;
  const toId = record.toId;
  const maxDepth = record.maxDepth === undefined ? 4 : record.maxDepth;
  const maxPaths = record.maxPaths === undefined ? 3 : record.maxPaths;
  if (
    typeof fromId !== "string" ||
    !ID_PATTERN.test(fromId) ||
    fromId.length > 128 ||
    typeof toId !== "string" ||
    !ID_PATTERN.test(toId) ||
    toId.length > 128 ||
    fromId === toId ||
    typeof maxDepth !== "number" ||
    !Number.isSafeInteger(maxDepth) ||
    maxDepth < 1 ||
    maxDepth > 6 ||
    typeof maxPaths !== "number" ||
    !Number.isSafeInteger(maxPaths) ||
    maxPaths < 1 ||
    maxPaths > 10
  ) return null;

  return Object.freeze({ fromId, toId, maxDepth, maxPaths });
}

function canonicalRequest(value: unknown): CanonicalRequest | null {
  const record = canonicalRecord(value, ["progress", "query"], ["progress", "query"]);
  if (!record) return null;
  const query = canonicalQuery(record.query);
  if (!query) return null;
  return Object.freeze({ progress: record.progress, query });
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

function validPlanIdentity(
  plan: HoidExplanationPlan,
  expected: ProgressIdentity,
): boolean {
  try {
    if (plan === null || typeof plan !== "object" || Array.isArray(plan)) return false;
    const prototype = Object.getPrototypeOf(plan);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const planId = Object.getOwnPropertyDescriptor(plan, "planId");
    const revision = Object.getOwnPropertyDescriptor(plan, "progressRevision");
    const fingerprint = Object.getOwnPropertyDescriptor(plan, "progressFingerprint");
    return Boolean(
      planId &&
      Object.prototype.hasOwnProperty.call(planId, "value") &&
      typeof planId.value === "string" &&
      FINGERPRINT_PATTERN.test(planId.value) &&
      revision &&
      Object.prototype.hasOwnProperty.call(revision, "value") &&
      revision.value === expected.revision &&
      fingerprint &&
      Object.prototype.hasOwnProperty.call(fingerprint, "value") &&
      fingerprint.value === expected.fingerprint
    );
  } catch {
    return false;
  }
}

function validRenderedExplanation(
  value: HoidRenderedExplanation,
  expectedPlanId: string,
  expected: ProgressIdentity,
): value is Extract<HoidRenderedExplanation, { status: "ready" }> {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const record = canonicalRecord(
      value,
      ["status", "planId", "progressRevision", "text", "segments", "sources", "truncated"],
      ["status", "planId", "progressRevision", "text", "segments", "sources", "truncated"],
    );
    if (!record || record.status !== "ready") return false;
    if (
      record.planId !== expectedPlanId ||
      record.progressRevision !== expected.revision ||
      typeof record.text !== "string" ||
      record.text.length < 1 ||
      record.text.length > MAX_EXPLANATION_LENGTH ||
      typeof record.truncated !== "boolean" ||
      !Array.isArray(record.segments) ||
      record.segments.length < 1 ||
      record.segments.length > MAX_SEGMENTS ||
      !Array.isArray(record.sources) ||
      record.sources.length < 1 ||
      record.sources.length > MAX_SOURCES
    ) return false;

    const segmentTexts: string[] = [];
    for (const rawSegment of record.segments) {
      const segment = canonicalRecord(
        rawSegment,
        ["claimId", "text", "evidenceIds", "sources"],
        ["claimId", "text", "evidenceIds", "sources"],
      );
      if (
        !segment ||
        typeof segment.claimId !== "string" ||
        !ID_PATTERN.test(segment.claimId) ||
        typeof segment.text !== "string" ||
        segment.text.length < 1 ||
        segment.text.length > 4_000 ||
        !Array.isArray(segment.evidenceIds) ||
        segment.evidenceIds.length < 1 ||
        segment.evidenceIds.length > 16 ||
        !segment.evidenceIds.every((id: unknown) => typeof id === "string" && ID_PATTERN.test(id)) ||
        !Array.isArray(segment.sources) ||
        segment.sources.length !== segment.evidenceIds.length
      ) return false;
      segmentTexts.push(segment.text);
    }
    return record.text === segmentTexts.join("\n\n");
  } catch {
    return false;
  }
}

/**
 * Progress-bound orchestration for graph explanations.
 *
 * This gateway never calls an AI provider. The trusted planner can only use
 * the authorized local graph, and the renderer can only emit exact approved
 * editorial claims with their source citations. Progress is read before and
 * after planning/rendering; a changed snapshot discards the complete result.
 */
export class HoidExplanationGateway {
  constructor(private readonly config: HoidExplanationGatewayConfig) {}

  explain(input: unknown): HoidExplanationGatewayResult {
    const request = canonicalRequest(input);
    if (!request) return Object.freeze({ status: "unavailable", reason: "invalid-request" });

    const requested = progressIdentity(request.progress);
    if (!requested) return Object.freeze({ status: "unavailable", reason: "invalid-progress" });

    let beforeSnapshot: unknown;
    try {
      beforeSnapshot = this.config.getCurrentProgress();
    } catch {
      return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
    }
    const before = progressIdentity(beforeSnapshot);
    if (!before) return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
    if (!sameProgress(requested, before)) {
      return Object.freeze({ status: "unavailable", reason: "progress-changed" });
    }

    let planned: HoidExplanationPlanResult;
    try {
      planned = this.config.engine.createPlan(request.progress, request.query);
    } catch {
      return Object.freeze({ status: "unavailable", reason: "engine-failed" });
    }

    if (planned.status === "unavailable") {
      return Object.freeze({ status: "unavailable", reason: "plan-unavailable" });
    }

    if (planned.status === "no-path") {
      if (
        planned.progressRevision !== requested.revision ||
        planned.progressFingerprint !== requested.fingerprint
      ) return Object.freeze({ status: "unavailable", reason: "invalid-plan" });
      let afterSnapshot: unknown;
      try {
        afterSnapshot = this.config.getCurrentProgress();
      } catch {
        return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
      }
      const after = progressIdentity(afterSnapshot);
      if (!after) return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
      if (!sameProgress(requested, after)) {
        return Object.freeze({ status: "unavailable", reason: "progress-changed" });
      }
      return Object.freeze({
        status: "no-path",
        progressRevision: requested.revision,
        progressFingerprint: requested.fingerprint,
      });
    }

    if (!validPlanIdentity(planned.plan, requested)) {
      return Object.freeze({ status: "unavailable", reason: "invalid-plan" });
    }

    let rendered: HoidRenderedExplanation;
    try {
      rendered = this.config.engine.renderPlan(planned.plan, request.progress);
    } catch {
      return Object.freeze({ status: "unavailable", reason: "engine-failed" });
    }
    if (rendered.status !== "ready") {
      return Object.freeze({ status: "unavailable", reason: "render-unavailable" });
    }
    if (!validRenderedExplanation(rendered, planned.plan.planId, requested)) {
      return Object.freeze({ status: "unavailable", reason: "invalid-rendered-explanation" });
    }

    let afterSnapshot: unknown;
    try {
      afterSnapshot = this.config.getCurrentProgress();
    } catch {
      return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
    }
    const after = progressIdentity(afterSnapshot);
    if (!after) return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
    if (!sameProgress(requested, after)) {
      return Object.freeze({ status: "unavailable", reason: "progress-changed" });
    }

    return Object.freeze({
      status: "ready",
      explanation: rendered,
      progressRevision: requested.revision,
      progressFingerprint: requested.fingerprint,
    });
  }
}

/** Dependency-injection factory for trusted local explanation engines and tests. */
export function createHoidExplanationGateway(
  config: HoidExplanationGatewayConfig | null,
): HoidExplanationGateway | null {
  if (
    config === null ||
    typeof config !== "object" ||
    typeof config.getCurrentProgress !== "function" ||
    config.engine === null ||
    typeof config.engine !== "object" ||
    typeof config.engine.createPlan !== "function" ||
    typeof config.engine.renderPlan !== "function"
  ) return null;
  return new HoidExplanationGateway(config);
}

/** Production composition: source-controlled graph, approved claims and local renderer only. */
export function createProductionHoidExplanationGateway(
  getCurrentProgress: (() => unknown) | null,
): HoidExplanationGateway | null {
  if (typeof getCurrentProgress !== "function") return null;
  return createHoidExplanationGateway({
    getCurrentProgress,
    engine: Object.freeze({
      createPlan: createProductionHoidExplanationPlan,
      renderPlan: renderProductionHoidExplanationPlan,
    }),
  });
}
