import {
  buildHoidAuthorizedKnowledgeGraph,
  buildProductionHoidAuthorizedKnowledgeGraph,
  fingerprintHoidCursorProgressSnapshot,
  HOID_KNOWLEDGE_GRAPH_DEFINITION,
  type HoidKnowledgeGraphDefinition,
  type HoidKnowledgeGraphEdge,
  type HoidKnowledgeGraphPath,
  type HoidKnowledgeGraphResult,
  type HoidKnowledgeGraphSource,
} from "./knowledgeGraph";
import { HOID_APPROVED_CLAIMS, HOID_EDITORIAL_KNOWLEDGE } from "./editorialRegistry";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import type { HoidApprovedClaim } from "./evidenceRuntime";
import { sha256Hex } from "./sha256";

export type HoidKnowledgeGraphQuery = Readonly<{
  fromId: string;
  toId: string;
  maxDepth?: number;
  maxPaths?: number;
}>;

export type HoidKnowledgeGraphQueryResult =
  | Readonly<{
      status: "ready";
      progressRevision: number;
      progressFingerprint: string;
      paths: readonly HoidKnowledgeGraphPath[];
      truncated: boolean;
    }>
  | Readonly<{
      status: "no-path";
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-query"
        | "invalid-definition"
        | "invalid-knowledge"
        | "invalid-claims"
        | "invalid-progress"
        | "query-budget-exceeded";
    }>;

export type HoidExplanationPlanClaim = Readonly<{
  claimId: string;
  claimTextSha256: string;
  evidenceIds: readonly string[];
}>;

export type HoidExplanationPlan = Readonly<{
  schemaVersion: 1;
  planId: string;
  fromId: string;
  toId: string;
  progressRevision: number;
  progressFingerprint: string;
  paths: readonly HoidKnowledgeGraphPath[];
  claims: readonly HoidExplanationPlanClaim[];
  sources: readonly HoidKnowledgeGraphSource[];
  truncated: boolean;
}>;

export type HoidExplanationPlanResult =
  | Readonly<{ status: "ready"; plan: HoidExplanationPlan }>
  | Readonly<{ status: "no-path"; progressRevision: number; progressFingerprint: string }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-query"
        | "invalid-definition"
        | "invalid-knowledge"
        | "invalid-claims"
        | "invalid-progress"
        | "query-budget-exceeded";
    }>;

export type HoidRenderedExplanationSegment = Readonly<{
  claimId: string;
  text: string;
  evidenceIds: readonly string[];
  sources: readonly HoidKnowledgeGraphSource[];
}>;

export type HoidRenderedExplanation =
  | Readonly<{
      status: "ready";
      planId: string;
      progressRevision: number;
      text: string;
      segments: readonly HoidRenderedExplanationSegment[];
      sources: readonly HoidKnowledgeGraphSource[];
      truncated: boolean;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "untrusted-plan" | "stale-progress" | "invalid-claims" | "locked-evidence";
    }>;

type CanonicalQuery = Readonly<{
  fromId: string;
  toId: string;
  maxDepth: number;
  maxPaths: number;
}>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const MAX_DEPTH = 6;
const DEFAULT_DEPTH = 4;
const MAX_PATHS = 10;
const DEFAULT_PATHS = 3;
const MAX_QUERY_EXPANSIONS = 4_096;
const MAX_CLAIMS = 512;
const MAX_EVIDENCE_IDS = 16;
const MAX_CLAIM_TEXT_LENGTH = 4_000;
const trustedPlans = new WeakSet<object>();

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalDenseArray(value: unknown, max: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length > max || Object.getPrototypeOf(value) !== Array.prototype) {
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

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 128 && ID_PATTERN.test(value);
}

function canonicalQuery(value: unknown): CanonicalQuery | null {
  const record = canonicalRecord(value, ["fromId", "toId", "maxDepth", "maxPaths"]);
  if (
    !record ||
    !Object.prototype.hasOwnProperty.call(record, "fromId") ||
    !Object.prototype.hasOwnProperty.call(record, "toId")
  ) return null;
  const fromId = record.fromId;
  const toId = record.toId;
  const maxDepth = record.maxDepth === undefined ? DEFAULT_DEPTH : record.maxDepth;
  const maxPaths = record.maxPaths === undefined ? DEFAULT_PATHS : record.maxPaths;
  if (
    !validId(fromId) ||
    !validId(toId) ||
    fromId === toId ||
    typeof maxDepth !== "number" ||
    !Number.isSafeInteger(maxDepth) ||
    maxDepth < 1 ||
    maxDepth > MAX_DEPTH ||
    typeof maxPaths !== "number" ||
    !Number.isSafeInteger(maxPaths) ||
    maxPaths < 1 ||
    maxPaths > MAX_PATHS
  ) return null;
  return Object.freeze({ fromId, toId, maxDepth, maxPaths });
}

function unavailable(
  reason: Extract<HoidKnowledgeGraphResult, { status: "unavailable" }>["reason"] | "invalid-query" | "query-budget-exceeded",
): HoidKnowledgeGraphQueryResult {
  return Object.freeze({ status: "unavailable", reason });
}

function queryAuthorizedGraph(
  graph: Extract<HoidKnowledgeGraphResult, { status: "ready" }>,
  query: CanonicalQuery,
): HoidKnowledgeGraphQueryResult {
  const nodeIds = new Set(graph.nodes.map(node => node.id));
  if (!nodeIds.has(query.fromId) || !nodeIds.has(query.toId)) {
    return Object.freeze({
      status: "no-path",
      progressRevision: graph.progressRevision,
      progressFingerprint: graph.progressFingerprint,
    });
  }

  const adjacency = new Map<string, HoidKnowledgeGraphEdge[]>();
  for (const edge of graph.edges) {
    const current = adjacency.get(edge.sourceId) ?? [];
    current.push(edge);
    adjacency.set(edge.sourceId, current);
  }
  for (const edges of adjacency.values()) {
    edges.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }

  type QueueEntry = Readonly<{
    nodeIds: readonly string[];
    edges: readonly HoidKnowledgeGraphEdge[];
  }>;
  const queue: QueueEntry[] = [{ nodeIds: [query.fromId], edges: [] }];
  const paths: HoidKnowledgeGraphPath[] = [];
  let cursor = 0;
  let expansions = 0;
  let truncated = false;

  while (cursor < queue.length) {
    const current = queue[cursor];
    cursor += 1;
    if (current.edges.length >= query.maxDepth) continue;
    const outgoing = adjacency.get(current.nodeIds[current.nodeIds.length - 1]) ?? [];

    for (const edge of outgoing) {
      expansions += 1;
      if (expansions > MAX_QUERY_EXPANSIONS) return unavailable("query-budget-exceeded");
      if (current.nodeIds.includes(edge.targetId)) continue;

      const nextNodeIds = [...current.nodeIds, edge.targetId];
      const nextEdges = [...current.edges, edge];
      if (edge.targetId === query.toId) {
        if (paths.length === query.maxPaths) {
          truncated = true;
          break;
        }
        paths.push(Object.freeze({
          nodeIds: Object.freeze(nextNodeIds),
          edges: Object.freeze(nextEdges),
        }));
      } else if (nextEdges.length < query.maxDepth) {
        queue.push(Object.freeze({
          nodeIds: Object.freeze(nextNodeIds),
          edges: Object.freeze(nextEdges),
        }));
      }
    }
    if (truncated) break;
  }

  if (paths.length === 0) {
    return Object.freeze({
      status: "no-path",
      progressRevision: graph.progressRevision,
      progressFingerprint: graph.progressFingerprint,
    });
  }
  return Object.freeze({
    status: "ready",
    progressRevision: graph.progressRevision,
    progressFingerprint: graph.progressFingerprint,
    paths: Object.freeze(paths),
    truncated,
  });
}

/**
 * Query only a graph that has just been built by the strict authorization
 * boundary. The function accepts source-controlled inputs and the authoritative
 * v2 snapshot; it never accepts a caller-supplied prefiltered graph.
 *
 * Paths are directed, simple (no repeated node), breadth-first and bounded.
 * The query returns metadata and approved claim IDs, never claim prose.
 */
export function queryHoidKnowledgeGraph(
  definitionInput: unknown,
  knowledgeInput: unknown,
  claimsInput: unknown,
  progressInput: unknown,
  queryInput: unknown,
): HoidKnowledgeGraphQueryResult {
  const query = canonicalQuery(queryInput);
  if (!query) return unavailable("invalid-query");
  const graph = buildHoidAuthorizedKnowledgeGraph(
    definitionInput,
    knowledgeInput,
    claimsInput,
    progressInput,
  );
  if (graph.status !== "ready") return unavailable(graph.reason);
  return queryAuthorizedGraph(graph, query);
}

/** Production query bound to source-controlled editorial and graph registries. */
export function queryProductionHoidKnowledgeGraph(
  progressInput: unknown,
  queryInput: unknown,
): HoidKnowledgeGraphQueryResult {
  const query = canonicalQuery(queryInput);
  if (!query) return unavailable("invalid-query");
  const graph = buildProductionHoidAuthorizedKnowledgeGraph(progressInput);
  if (graph.status !== "ready") return unavailable(graph.reason);
  return queryAuthorizedGraph(graph, query);
}

function planFromQuery(
  query: CanonicalQuery,
  result: HoidKnowledgeGraphQueryResult,
): HoidExplanationPlanResult {
  if (result.status === "no-path") return result;
  if (result.status === "unavailable") return result;

  const claimsById = new Map<string, HoidExplanationPlanClaim>();
  const sourcesByKey = new Map<string, HoidKnowledgeGraphSource>();
  for (const path of result.paths) {
    for (const edge of path.edges) {
      const claim = Object.freeze({
        claimId: edge.claimId,
        claimTextSha256: edge.claimTextSha256,
        evidenceIds: Object.freeze([...edge.evidenceIds].sort()),
      });
      const existing = claimsById.get(claim.claimId);
      if (
        existing &&
        (
          existing.claimTextSha256 !== claim.claimTextSha256 ||
          existing.evidenceIds.join("\n") !== claim.evidenceIds.join("\n")
        )
      ) return unavailable("invalid-claims");
      claimsById.set(claim.claimId, claim);
      for (const source of edge.sources) {
        const key = [
          source.evidenceId,
          source.sourceBookId,
          source.sourceChapter,
          source.locatorId,
          source.unlockBookId,
          source.unlockChapter,
          source.editionId,
          source.navigationSha256,
          source.documentSha256,
        ].join("\n");
        sourcesByKey.set(key, source);
      }
    }
  }

  const claims = [...claimsById.values()].sort((a, b) =>
    a.claimId < b.claimId ? -1 : a.claimId > b.claimId ? 1 : 0
  );
  const sources = [...sourcesByKey.values()].sort((a, b) =>
    a.evidenceId < b.evidenceId ? -1 : a.evidenceId > b.evidenceId ? 1 : 0
  );
  const planPayload = [
    "hoid-explanation-plan-v1",
    result.progressFingerprint,
    query.fromId,
    query.toId,
    result.paths.map(path => [
      path.nodeIds,
      path.edges.map(edge => [
        edge.id,
        edge.claimId,
        edge.claimTextSha256,
        edge.evidenceIds,
      ]),
    ]),
    claims,
    sources,
  ];
  const plan: HoidExplanationPlan = Object.freeze({
    schemaVersion: 1,
    planId: sha256Hex(JSON.stringify(planPayload)),
    fromId: query.fromId,
    toId: query.toId,
    progressRevision: result.progressRevision,
    progressFingerprint: result.progressFingerprint,
    paths: result.paths,
    claims: Object.freeze(claims),
    sources: Object.freeze(sources),
    truncated: result.truncated,
  });
  trustedPlans.add(plan);
  return Object.freeze({ status: "ready", plan });
}

/**
 * Build a provider-independent explanation plan. It contains only IDs,
 * integrity digests and citations; it deliberately contains no narrative text.
 */
export function createHoidExplanationPlan(
  definitionInput: unknown,
  knowledgeInput: unknown,
  claimsInput: unknown,
  progressInput: unknown,
  queryInput: unknown,
): HoidExplanationPlanResult {
  const query = canonicalQuery(queryInput);
  if (!query) return unavailable("invalid-query");
  const result = queryHoidKnowledgeGraph(
    definitionInput,
    knowledgeInput,
    claimsInput,
    progressInput,
    query,
  );
  return planFromQuery(query, result);
}

/** Production plan bound to the local, source-controlled editorial registries. */
export function createProductionHoidExplanationPlan(
  progressInput: unknown,
  queryInput: unknown,
): HoidExplanationPlanResult {
  const query = canonicalQuery(queryInput);
  if (!query) return unavailable("invalid-query");
  const result = queryProductionHoidKnowledgeGraph(progressInput, query);
  return planFromQuery(query, result);
}

function canonicalApprovedClaims(value: unknown): readonly HoidApprovedClaim[] | null {
  const items = canonicalDenseArray(value, MAX_CLAIMS);
  if (!items) return null;
  const result: HoidApprovedClaim[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const record = canonicalRecord(item, ["id", "text", "intent", "evidenceIds", "review"]);
    if (!record || Reflect.ownKeys(item as object).length !== 5) return null;
    const id = record.id;
    const text = record.text;
    const intent = record.intent;
    if (
      !validId(id) ||
      seen.has(id) ||
      typeof text !== "string" ||
      text !== text.trim() ||
      text.length < 1 ||
      text.length > MAX_CLAIM_TEXT_LENGTH ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text) ||
      (intent !== "explain" && intent !== "context")
    ) return null;

    const evidenceIds = canonicalDenseArray(record.evidenceIds, MAX_EVIDENCE_IDS);
    if (
      !evidenceIds ||
      evidenceIds.length < 2 ||
      !evidenceIds.every(value => validId(value)) ||
      new Set(evidenceIds).size !== evidenceIds.length
    ) return null;

    const review = canonicalRecord(record.review, ["status", "origin", "reviewerId", "reviewedAt"]);
    if (!review || Reflect.ownKeys(record.review as object).length !== 4) return null;
    const reviewerId = review.reviewerId;
    const reviewedAt = review.reviewedAt;
    if (
      review.status !== "approved" ||
      review.origin !== "original-editorial" ||
      typeof reviewerId !== "string" ||
      !reviewerId.trim() ||
      reviewerId.length > 128 ||
      typeof reviewedAt !== "string"
    ) return null;
    const timestamp = Date.parse(reviewedAt);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== reviewedAt) return null;

    result.push(Object.freeze({
      id,
      text,
      intent,
      evidenceIds: Object.freeze([...(evidenceIds as string[])].sort()),
      review: Object.freeze({
        status: "approved",
        origin: "original-editorial",
        reviewerId: reviewerId.trim(),
        reviewedAt,
      }),
    }));
    seen.add(id);
  }
  return Object.freeze(result);
}

function citationIsUnlocked(
  source: HoidKnowledgeGraphSource,
  reading: readonly Readonly<{ bookId: string; chapter?: number; completed?: boolean }>[],
): boolean {
  const position = reading.find(item => item.bookId === source.unlockBookId);
  return Boolean(
    position &&
    (position.completed === true ||
      (typeof position.chapter === "number" && position.chapter >= source.unlockChapter)),
  );
}

/**
 * Resolve a plan to exact local editorial statements. The plan must be an
 * object produced by this module, its progress fingerprint must still match,
 * and every statement digest/evidence set must match the graph-bound plan.
 * This renderer performs no provider call and adds no model-authored prose.
 */
export function renderHoidExplanationPlan(
  planInput: unknown,
  claimsInput: unknown,
  progressInput: unknown,
): HoidRenderedExplanation {
  if (
    planInput === null ||
    typeof planInput !== "object" ||
    !trustedPlans.has(planInput as object)
  ) return Object.freeze({ status: "unavailable", reason: "untrusted-plan" });

  const plan = planInput as HoidExplanationPlan;
  const fingerprint = fingerprintHoidCursorProgressSnapshot(progressInput);
  const projection = projectHoidCursorProgressSnapshot(progressInput);
  if (
    fingerprint.status !== "ready" ||
    projection.status !== "ready" ||
    fingerprint.revision !== plan.progressRevision ||
    fingerprint.sha256 !== plan.progressFingerprint
  ) return Object.freeze({ status: "unavailable", reason: "stale-progress" });

  const claims = canonicalApprovedClaims(claimsInput);
  if (!claims) return Object.freeze({ status: "unavailable", reason: "invalid-claims" });
  const byId = new Map(claims.map(claim => [claim.id, claim]));
  const segments: HoidRenderedExplanationSegment[] = [];

  for (const planned of plan.claims) {
    const claim = byId.get(planned.claimId);
    if (
      !claim ||
      sha256Hex(claim.text) !== planned.claimTextSha256 ||
      claim.evidenceIds.join("\n") !== [...planned.evidenceIds].sort().join("\n")
    ) return Object.freeze({ status: "unavailable", reason: "invalid-claims" });

    const sources = plan.sources.filter(source => claim.evidenceIds.includes(source.evidenceId));
    if (
      sources.length !== claim.evidenceIds.length ||
      !sources.every(source => citationIsUnlocked(source, projection.reading))
    ) return Object.freeze({ status: "unavailable", reason: "locked-evidence" });

    segments.push(Object.freeze({
      claimId: claim.id,
      text: claim.text,
      evidenceIds: Object.freeze([...claim.evidenceIds]),
      sources: Object.freeze(sources),
    }));
  }

  if (segments.length === 0) return Object.freeze({ status: "unavailable", reason: "invalid-claims" });
  const rendered = Object.freeze(segments);
  return Object.freeze({
    status: "ready",
    planId: plan.planId,
    progressRevision: plan.progressRevision,
    text: rendered.map(segment => segment.text).join("\n\n"),
    segments: rendered,
    sources: plan.sources,
    truncated: plan.truncated,
  });
}

/** Production renderer can only resolve claims from the source-controlled registry. */
export function renderProductionHoidExplanationPlan(
  planInput: unknown,
  progressInput: unknown,
): HoidRenderedExplanation {
  return renderHoidExplanationPlan(planInput, HOID_APPROVED_CLAIMS, progressInput);
}
