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
  query: HoidKnowledgeGraphQuery,
): boolean {
  try {
    if (plan === null || typeof plan !== "object" || Array.isArray(plan)) return false;
    const prototype = Object.getPrototypeOf(plan);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const read = (key: string): unknown => {
      const descriptor = Object.getOwnPropertyDescriptor(plan, key);
      return descriptor && Object.prototype.hasOwnProperty.call(descriptor, "value")
        ? descriptor.value
        : undefined;
    };
    const planId = read("planId");
    return Boolean(
      read("schemaVersion") === 1 &&
      planId === plan.planId &&
      typeof planId === "string" &&
      FINGERPRINT_PATTERN.test(planId) &&
      read("fromId") === query.fromId &&
      read("toId") === query.toId &&
      read("progressRevision") === expected.revision &&
      read("progressFingerprint") === expected.fingerprint
    );
  } catch {
    return false;
  }
}

function canonicalArrayItems(
  value: unknown,
  minimum: number,
  maximum: number,
): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const items: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      items.push(descriptor.value);
    }
    return Object.freeze(items);
  } catch {
    return null;
  }
}

const SOURCE_KEYS = [
  "evidenceId",
  "sourceBookId",
  "sourceChapter",
  "locatorId",
  "unlockBookId",
  "unlockChapter",
  "editionId",
  "navigationSha256",
  "documentSha256",
] as const;

function canonicalSource(value: unknown): Record<string, unknown> | null {
  const source = canonicalRecord(value, SOURCE_KEYS, SOURCE_KEYS);
  if (!source) return null;
  if (
    typeof source.evidenceId !== "string" ||
    !ID_PATTERN.test(source.evidenceId) ||
    typeof source.sourceBookId !== "string" ||
    !ID_PATTERN.test(source.sourceBookId) ||
    typeof source.sourceChapter !== "number" ||
    !Number.isSafeInteger(source.sourceChapter) ||
    source.sourceChapter < 1 ||
    typeof source.unlockBookId !== "string" ||
    source.unlockBookId !== source.sourceBookId ||
    typeof source.unlockChapter !== "number" ||
    !Number.isSafeInteger(source.unlockChapter) ||
    source.unlockChapter < source.sourceChapter ||
    typeof source.locatorId !== "string" ||
    source.locatorId.length < 1 ||
    source.locatorId.length > 256 ||
    /[\\u0000-\\u001F\\u007F]/u.test(source.locatorId) ||
    typeof source.editionId !== "string" ||
    source.editionId.length < 1 ||
    source.editionId.length > 128 ||
    typeof source.navigationSha256 !== "string" ||
    !FINGERPRINT_PATTERN.test(source.navigationSha256) ||
    typeof source.documentSha256 !== "string" ||
    !FINGERPRINT_PATTERN.test(source.documentSha256)
  ) return null;
  return source;
}

function sourceFingerprint(source: Record<string, unknown>): string {
  return JSON.stringify(SOURCE_KEYS.map(key => source[key]));
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
      typeof record.truncated !== "boolean"
    ) return false;

    const rawSegments = canonicalArrayItems(record.segments, 1, MAX_SEGMENTS);
    const rawSources = canonicalArrayItems(record.sources, 1, MAX_SOURCES);
    if (!rawSegments || !rawSources) return false;

    const sourcesById = new Map<string, Record<string, unknown>>();
    for (const rawSource of rawSources) {
      const source = canonicalSource(rawSource);
      if (!source) return false;
      const evidenceId = source.evidenceId as string;
      if (sourcesById.has(evidenceId)) return false;
      sourcesById.set(evidenceId, source);
    }

    const segmentTexts: string[] = [];
    const referencedSourceIds = new Set<string>();
    for (const rawSegment of rawSegments) {
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
        segment.text.length > 4_000
      ) return false;

      const evidenceIds = canonicalArrayItems(segment.evidenceIds, 1, 16);
      const rawSegmentSources = canonicalArrayItems(segment.sources, 1, 16);
      if (!evidenceIds || !rawSegmentSources) return false;
      if (!evidenceIds.every(id => typeof id === "string" && ID_PATTERN.test(id))) return false;
      const evidenceSet = new Set(evidenceIds as readonly string[]);
      if (evidenceSet.size !== evidenceIds.length) return false;

      const segmentSources: Record<string, unknown>[] = [];
      for (const rawSource of rawSegmentSources) {
        const source = canonicalSource(rawSource);
        if (!source) return false;
        segmentSources.push(source);
      }
      const sourceIds = segmentSources.map(source => source.evidenceId as string);
      if (
        sourceIds.length !== evidenceIds.length ||
        new Set(sourceIds).size !== sourceIds.length ||
        JSON.stringify([...sourceIds].sort()) !== JSON.stringify([...(evidenceIds as readonly string[])].sort())
      ) return false;

      for (const source of segmentSources) {
        const evidenceId = source.evidenceId as string;
        const topLevelSource = sourcesById.get(evidenceId);
        if (!topLevelSource || sourceFingerprint(source) !== sourceFingerprint(topLevelSource)) return false;
        referencedSourceIds.add(evidenceId);
      }
      segmentTexts.push(segment.text);
    }

    return (
      referencedSourceIds.size === sourcesById.size &&
      record.text === segmentTexts.join("\\n\\n")
    );
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

    if (!validPlanIdentity(planned.plan, requested, request.query)) {
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
