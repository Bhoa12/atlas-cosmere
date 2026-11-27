import {
  canonicalizeHoidKnowledgeEntries,
  type HoidKnowledgeEntry,
} from "./catalog";
import {
  validateHoidApprovedClaimAttestation,
  type HoidApprovedClaim,
} from "./approvedClaimIntegrity";
import {
  evidenceCitationFor,
  isEvidenceUnlocked,
  type HoidEvidenceCitation,
} from "./evidenceScope";
import {
  canonicalizeHoidAnswerBookScope,
  claimEvidenceMatchesHoidBookScope,
  type HoidAnswerBookScope,
} from "./answerScope";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import {
  projectHoidAnswerForDisplay,
  type HoidDisplayCitation,
} from "./answerDisplayProjection";
import type {
  HoidAnswerPresentation,
  HoidPresentedCitation,
} from "./answerPresentation";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import type { ReadingPosition } from "./types";

export type HoidNarrativeTemporalRelation = Readonly<{
  id: string;
  relation: "precedes";
  earlierEventId: string;
  laterEventId: string;
  claimId: string;
}>;

export type HoidNarrativeTemporalEventNode = Readonly<{
  eventId: string;
  citations: readonly HoidDisplayCitation[];
}>;

export type HoidNarrativeTemporalRelationEdge = Readonly<{
  relationId: string;
  earlierEventId: string;
  laterEventId: string;
  claimId: string;
  citations: readonly HoidDisplayCitation[];
}>;

export type HoidNarrativeTemporalPartialOrderResult =
  | Readonly<{ status: "not-found" }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-request" | "invalid-progress" | "invalid-scope" | "invalid-registry";
    }>
  | Readonly<{
      status: "ready";
      semantics: "editorial-partial-order";
      layers: readonly Readonly<{
        events: readonly HoidNarrativeTemporalEventNode[];
        withinLayer: "unordered";
      }>[];
      relations: readonly HoidNarrativeTemporalRelationEdge[];
      progressRevision: number;
      progressFingerprint: string;
    }>;

export type HoidNarrativeTemporalRelationIndex = Readonly<{
  getAuthorizedPartialOrder(input: unknown): HoidNarrativeTemporalPartialOrderResult;
}>;

export type HoidNarrativeTemporalChronologyResult =
  | HoidNarrativeTemporalPartialOrderResult
  | Readonly<{
      status: "unavailable";
      reason: "progress-changed" | "cancelled";
    }>;

export type HoidNarrativeTemporalChronologyAdapter = Readonly<{
  build(
    input: unknown,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<HoidNarrativeTemporalChronologyResult>;
}>;

type ProgressIdentity = Readonly<{
  revision: number;
  fingerprint: string;
  reading: readonly ReadingPosition[];
}>;

type CanonicalRelation = Readonly<{
  id: string;
  earlierEventId: string;
  laterEventId: string;
  claim: HoidApprovedClaim;
}>;

type CanonicalGraph = Readonly<{
  knowledge: readonly HoidKnowledgeEntry[];
  byId: ReadonlyMap<string, HoidKnowledgeEntry>;
  relations: readonly CanonicalRelation[];
}>;

type AdapterConfig = Readonly<{
  index: HoidNarrativeTemporalRelationIndex;
  refreshCurrentProgress: () => unknown | Promise<unknown>;
}>;

const MAX_KNOWLEDGE = 512;
const MAX_CLAIMS = 512;
const MAX_RELATIONS = 512;
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const TITLE_BY_ID = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title] as const));
const HOID_TEMPORAL_INDEXES = new WeakSet<object>();

function exactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = allowedKeys,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length < requiredKeys.length || keys.length > allowedKeys.length) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
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

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < minimum ||
      value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
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
      if (
        typeof key !== "string" ||
        !/^(0|[1-9][0-9]*)$/u.test(key) ||
        Number(key) >= value.length
      ) return null;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function validId(value: unknown): value is string {
  return typeof value === "string" &&
    value === value.trim() &&
    value.length >= 1 &&
    value.length <= 128 &&
    ID_PATTERN.test(value);
}

function progressIdentity(value: unknown): ProgressIdentity | null {
  const projection = projectHoidCursorProgressSnapshot(value);
  if (projection.status !== "ready") return null;
  return Object.freeze({
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
    reading: projection.reading,
  });
}

function sameProgress(left: ProgressIdentity, right: ProgressIdentity): boolean {
  return left.revision === right.revision && left.fingerprint === right.fingerprint;
}

function entryIsUnlocked(
  entry: HoidKnowledgeEntry,
  reading: ProgressIdentity["reading"],
): boolean {
  const firstAppearance = reading.find(position =>
    position.bookId === entry.firstSafeAppearance.bookId
  );
  const mentionUnlocked = Boolean(
    firstAppearance &&
    (firstAppearance.completed === true ||
      (typeof firstAppearance.chapter === "number" &&
        firstAppearance.chapter >= entry.firstSafeAppearance.chapter)),
  );
  return mentionUnlocked && isEvidenceUnlocked(entry, reading);
}

function parseRelation(value: unknown): HoidNarrativeTemporalRelation | null {
  const raw = exactRecord(value, [
    "id",
    "relation",
    "earlierEventId",
    "laterEventId",
    "claimId",
  ]);
  if (
    !raw ||
    !validId(raw.id) ||
    raw.relation !== "precedes" ||
    !validId(raw.earlierEventId) ||
    !validId(raw.laterEventId) ||
    raw.earlierEventId === raw.laterEventId ||
    !validId(raw.claimId)
  ) return null;
  return Object.freeze({
    id: raw.id,
    relation: "precedes",
    earlierEventId: raw.earlierEventId,
    laterEventId: raw.laterEventId,
    claimId: raw.claimId,
  });
}

function graphHasCycle(relations: readonly CanonicalRelation[]): boolean {
  const nodes = new Set<string>();
  const outgoing = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  for (const relation of relations) {
    nodes.add(relation.earlierEventId);
    nodes.add(relation.laterEventId);
    const targets = outgoing.get(relation.earlierEventId) ?? new Set<string>();
    targets.add(relation.laterEventId);
    outgoing.set(relation.earlierEventId, targets);
    indegree.set(relation.earlierEventId, indegree.get(relation.earlierEventId) ?? 0);
    indegree.set(relation.laterEventId, (indegree.get(relation.laterEventId) ?? 0) + 1);
  }

  const ready = [...nodes]
    .filter(id => (indegree.get(id) ?? 0) === 0)
    .sort();
  let visited = 0;
  while (ready.length > 0) {
    const current = ready.shift()!;
    visited += 1;
    for (const target of outgoing.get(current) ?? []) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) {
        ready.push(target);
        ready.sort();
      }
    }
  }
  return visited !== nodes.size;
}

function canonicalGraph(input: unknown): CanonicalGraph | null {
  const raw = exactRecord(input, ["knowledge", "claims", "relations"]);
  if (!raw) return null;

  const rawKnowledge = denseArray(raw.knowledge, 1, MAX_KNOWLEDGE);
  const rawClaims = denseArray(raw.claims, 1, MAX_CLAIMS);
  const rawRelations = denseArray(raw.relations, 1, MAX_RELATIONS);
  if (!rawKnowledge || !rawClaims || !rawRelations) return null;

  const knowledge = canonicalizeHoidKnowledgeEntries(rawKnowledge);
  if (knowledge.length !== rawKnowledge.length) return null;
  const byId = new Map<string, HoidKnowledgeEntry>();
  for (const entry of knowledge) {
    if (byId.has(entry.id)) return null;
    byId.set(entry.id, entry);
  }

  const claims: HoidApprovedClaim[] = [];
  const claimById = new Map<string, HoidApprovedClaim>();
  for (const rawClaim of rawClaims) {
    const validation = validateHoidApprovedClaimAttestation(rawClaim, knowledge);
    if (validation.status !== "valid" || claimById.has(validation.claim.id)) return null;
    claims.push(validation.claim);
    claimById.set(validation.claim.id, validation.claim);
  }

  const relations: CanonicalRelation[] = [];
  const relationIds = new Set<string>();
  const claimIds = new Set<string>();
  const edges = new Set<string>();
  for (const rawRelation of rawRelations) {
    const relation = parseRelation(rawRelation);
    if (!relation || relationIds.has(relation.id) || claimIds.has(relation.claimId)) return null;
    const edgeKey = relation.earlierEventId + "\u0000" + relation.laterEventId;
    if (edges.has(edgeKey)) return null;

    const earlier = byId.get(relation.earlierEventId);
    const later = byId.get(relation.laterEventId);
    const claim = claimById.get(relation.claimId);
    if (
      !earlier ||
      !later ||
      earlier.kind !== "event" ||
      later.kind !== "event" ||
      earlier.provenance !== "verified" ||
      later.provenance !== "verified" ||
      !evidenceCitationFor(earlier) ||
      !evidenceCitationFor(later) ||
      !claim ||
      claim.intent === "recommend" ||
      !claim.entityIds ||
      claim.entityIds.length !== 2 ||
      !claim.entityIds.includes(relation.earlierEventId) ||
      !claim.entityIds.includes(relation.laterEventId) ||
      claim.evidenceIds.length < 3 ||
      !claim.evidenceIds.includes(relation.earlierEventId) ||
      !claim.evidenceIds.includes(relation.laterEventId)
    ) return null;

    for (const evidenceId of claim.evidenceIds) {
      const evidence = byId.get(evidenceId);
      if (
        !evidence ||
        evidence.provenance !== "verified" ||
        !evidenceCitationFor(evidence)
      ) return null;
    }

    relationIds.add(relation.id);
    claimIds.add(relation.claimId);
    edges.add(edgeKey);
    relations.push(Object.freeze({
      id: relation.id,
      earlierEventId: relation.earlierEventId,
      laterEventId: relation.laterEventId,
      claim,
    }));
  }

  relations.sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  );
  if (graphHasCycle(relations)) return null;

  return Object.freeze({
    knowledge: Object.freeze(knowledge),
    byId,
    relations: Object.freeze(relations),
  });
}

function toPresentedCitation(source: HoidEvidenceCitation): HoidPresentedCitation | null {
  const title = TITLE_BY_ID.get(source.sourceBookId);
  if (!title) return null;
  return Object.freeze({
    evidenceId: source.evidenceId,
    sourceBookId: source.sourceBookId,
    title,
    chapter: source.sourceChapter,
    locatorId: source.locatorId,
  });
}

function projectCitations(
  sources: readonly HoidEvidenceCitation[],
): readonly HoidDisplayCitation[] | null {
  const presented = sources.map(toPresentedCitation);
  if (presented.some(item => item === null)) return null;
  const citations = presented as HoidPresentedCitation[];
  const presentation: Extract<HoidAnswerPresentation, { status: "ready" }> = Object.freeze({
    status: "ready",
    text: "Metadata-only temporal provenance",
    claimIds: Object.freeze([]),
    evidenceIds: Object.freeze(citations.map(item => item.evidenceId)),
    citations: Object.freeze(citations),
  });
  return projectHoidAnswerForDisplay(presentation)?.citations ?? null;
}

function buildPartialOrder(
  graph: CanonicalGraph,
  progress: ProgressIdentity,
  scope: HoidAnswerBookScope,
): HoidNarrativeTemporalPartialOrderResult {
  const visible: CanonicalRelation[] = [];
  for (const relation of graph.relations) {
    const earlier = graph.byId.get(relation.earlierEventId);
    const later = graph.byId.get(relation.laterEventId);
    if (!earlier || !later) return Object.freeze({ status: "unavailable", reason: "invalid-registry" });
    if (!entryIsUnlocked(earlier, progress.reading) || !entryIsUnlocked(later, progress.reading)) continue;

    const sources: HoidEvidenceCitation[] = [];
    let safe = true;
    for (const evidenceId of relation.claim.evidenceIds) {
      const entry = graph.byId.get(evidenceId);
      const citation = entry ? evidenceCitationFor(entry) : null;
      if (!entry || !citation || !entryIsUnlocked(entry, progress.reading)) {
        safe = false;
        break;
      }
      sources.push(citation);
    }
    if (!safe) continue;
    if (!claimEvidenceMatchesHoidBookScope(
      sources.map(source => source.sourceBookId),
      scope,
    )) continue;
    visible.push(relation);
  }

  if (visible.length === 0) return Object.freeze({ status: "not-found" });

  const nodes = new Set<string>();
  const predecessors = new Map<string, Set<string>>();
  for (const relation of visible) {
    nodes.add(relation.earlierEventId);
    nodes.add(relation.laterEventId);
    const incoming = predecessors.get(relation.laterEventId) ?? new Set<string>();
    incoming.add(relation.earlierEventId);
    predecessors.set(relation.laterEventId, incoming);
  }

  const remaining = new Set(nodes);
  const layers: {
    events: readonly HoidNarrativeTemporalEventNode[];
    withinLayer: "unordered";
  }[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter(id => [...(predecessors.get(id) ?? [])].every(predecessor => !remaining.has(predecessor)))
      .sort();
    if (ready.length === 0) return Object.freeze({ status: "unavailable", reason: "invalid-registry" });

    const events: HoidNarrativeTemporalEventNode[] = [];
    for (const eventId of ready) {
      const entry = graph.byId.get(eventId);
      const source = entry ? evidenceCitationFor(entry) : null;
      if (!entry || !source) return Object.freeze({ status: "unavailable", reason: "invalid-registry" });
      const citations = projectCitations([source]);
      if (!citations) return Object.freeze({ status: "unavailable", reason: "invalid-registry" });
      events.push(Object.freeze({ eventId, citations }));
    }
    layers.push(Object.freeze({
      events: Object.freeze(events),
      withinLayer: "unordered" as const,
    }));
    for (const id of ready) remaining.delete(id);
  }

  const relationEdges: HoidNarrativeTemporalRelationEdge[] = [];
  for (const relation of visible) {
    const sources: HoidEvidenceCitation[] = [];
    for (const evidenceId of relation.claim.evidenceIds) {
      const entry = graph.byId.get(evidenceId);
      const source = entry ? evidenceCitationFor(entry) : null;
      if (!source) return Object.freeze({ status: "unavailable", reason: "invalid-registry" });
      sources.push(source);
    }
    const citations = projectCitations(sources);
    if (!citations) return Object.freeze({ status: "unavailable", reason: "invalid-registry" });
    relationEdges.push(Object.freeze({
      relationId: relation.id,
      earlierEventId: relation.earlierEventId,
      laterEventId: relation.laterEventId,
      claimId: relation.claim.id,
      citations,
    }));
  }

  relationEdges.sort((left, right) =>
    left.relationId < right.relationId ? -1 : left.relationId > right.relationId ? 1 : 0
  );
  return Object.freeze({
    status: "ready",
    semantics: "editorial-partial-order",
    layers: Object.freeze(layers),
    relations: Object.freeze(relationEdges),
    progressRevision: progress.revision,
    progressFingerprint: progress.fingerprint,
  });
}

/**
 * Creates a metadata-only, editorially reviewed temporal relation index.
 * Every edge is backed by an approved claim that names exactly two event
 * entities and cites both event identities plus at least one independent
 * relation-evidence record. The complete graph must be acyclic.
 *
 * This index is not a production registry, signature authority, or UI model.
 * Hashes in the underlying claim attestations detect drift; they do not
 * authenticate the reviewer.
 */
export function createHoidNarrativeTemporalRelationIndex(
  input: unknown,
): HoidNarrativeTemporalRelationIndex | null {
  const graph = canonicalGraph(input);
  if (!graph) return null;

  const index: HoidNarrativeTemporalRelationIndex = Object.freeze({
    getAuthorizedPartialOrder(rawInput: unknown): HoidNarrativeTemporalPartialOrderResult {
      const request = exactRecord(rawInput, ["progress", "bookScope"]);
      if (!request) return Object.freeze({ status: "unavailable", reason: "invalid-request" });
      const scope = canonicalizeHoidAnswerBookScope(request.bookScope);
      if (!scope) return Object.freeze({ status: "unavailable", reason: "invalid-scope" });
      const progress = progressIdentity(request.progress);
      if (!progress) return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
      return buildPartialOrder(graph, progress, scope);
    },
  });
  HOID_TEMPORAL_INDEXES.add(index as object);
  return index;
}

export function isHoidNarrativeTemporalRelationIndex(
  value: unknown,
): value is HoidNarrativeTemporalRelationIndex {
  return value !== null &&
    typeof value === "object" &&
    HOID_TEMPORAL_INDEXES.has(value as object);
}

function unavailable(
  reason: Extract<HoidNarrativeTemporalChronologyResult, { status: "unavailable" }>["reason"],
): HoidNarrativeTemporalChronologyResult {
  return Object.freeze({ status: "unavailable", reason });
}

function adapterConfig(input: unknown): AdapterConfig | null {
  const raw = exactRecord(input, ["index", "refreshCurrentProgress"]);
  if (
    !raw ||
    !isHoidNarrativeTemporalRelationIndex(raw.index) ||
    typeof raw.refreshCurrentProgress !== "function"
  ) return null;
  return Object.freeze({
    index: raw.index,
    refreshCurrentProgress: raw.refreshCurrentProgress as () => unknown | Promise<unknown>,
  });
}

/**
 * Adds a durable-progress freshness guard around the pure temporal index.
 * The adapter cannot write progress, mutate claims, persist data or call a
 * provider. A cursor change during retrieval discards the complete result.
 */
export function createHoidNarrativeTemporalChronologyAdapter(
  input: unknown,
): HoidNarrativeTemporalChronologyAdapter | null {
  const config = adapterConfig(input);
  if (!config) return null;

  return Object.freeze({
    async build(
      rawInput: unknown,
      options: Readonly<{ signal?: AbortSignal }> = {},
    ): Promise<HoidNarrativeTemporalChronologyResult> {
      if (options.signal?.aborted) return unavailable("cancelled");
      const request = exactRecord(rawInput, ["progress", "bookScope"]);
      if (!request) return unavailable("invalid-request");
      const requested = progressIdentity(request.progress);
      if (!requested) return unavailable("invalid-progress");

      let beforeSnapshot: unknown;
      try {
        beforeSnapshot = await config.refreshCurrentProgress();
      } catch {
        return unavailable("invalid-progress");
      }
      if (options.signal?.aborted) return unavailable("cancelled");
      const before = progressIdentity(beforeSnapshot);
      if (!before) return unavailable("invalid-progress");
      if (!sameProgress(requested, before)) return unavailable("progress-changed");

      let result: HoidNarrativeTemporalPartialOrderResult;
      try {
        result = config.index.getAuthorizedPartialOrder({
          progress: beforeSnapshot,
          bookScope: request.bookScope,
        });
      } catch {
        return unavailable("invalid-registry");
      }
      if (options.signal?.aborted) return unavailable("cancelled");

      let afterSnapshot: unknown;
      try {
        afterSnapshot = await config.refreshCurrentProgress();
      } catch {
        return unavailable("invalid-progress");
      }
      if (options.signal?.aborted) return unavailable("cancelled");
      const after = progressIdentity(afterSnapshot);
      if (!after) return unavailable("invalid-progress");
      if (!sameProgress(before, after)) return unavailable("progress-changed");
      return result;
    },
  });
}
