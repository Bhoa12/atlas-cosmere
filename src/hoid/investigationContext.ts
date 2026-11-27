import { canonicalizeHoidAnswerBookScope, claimEvidenceMatchesHoidBookScope } from "./answerScope";
import { isHoidAuthorizedKnowledgeGraphResult, type HoidKnowledgeGraphPredicate } from "./knowledgeGraph";
import type { HoidInvestigationDomain, HoidInvestigationHistoryEntry, HoidInvestigationTopic } from "./investigationSession";
import { fingerprintHoidInvestigationScope } from "./investigationIdentity";
import { sha256Hex } from "./sha256";

export type HoidInvestigationContextTopic = Readonly<{ domain: HoidInvestigationDomain; topic: HoidInvestigationTopic }>;
export type HoidInvestigationContextSource = Readonly<{ sourceBookId: string; chapter: number }>;
export type HoidInvestigationContextLink = Readonly<{
  linkFingerprint: string;
  leftNodeFingerprint: string;
  rightNodeFingerprint: string;
  predicate: HoidKnowledgeGraphPredicate;
  leftInvestigations: readonly HoidInvestigationContextTopic[];
  rightInvestigations: readonly HoidInvestigationContextTopic[];
  sources: readonly HoidInvestigationContextSource[];
}>;
export type HoidInvestigationContextPlanResult =
  | Readonly<{ status: "ready"; progressRevision: number; progressFingerprint: string; scopeFingerprint: string; links: readonly HoidInvestigationContextLink[] }>
  | Readonly<{ status: "unavailable"; reason: "invalid-request" | "invalid-graph" | "invalid-history" | "invalid-progress" | "progress-mismatch" | "invalid-scope" }>;

const SHA = /^[a-f0-9]{64}$/u;
const ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const MAX_HISTORY = 64;
const MAX_NODES = 512;
const MAX_EDGES = 1_024;
const MAX_ALIASES = 64;
const MAX_SOURCES = 64;
const MAX_LINKS = 8;
const PREDICATES = new Set<HoidKnowledgeGraphPredicate>([
  "related-to", "appears-in", "located-in", "member-of", "uses",
  "participates-in", "created-by", "part-of", "causes", "opposes", "allied-with",
]);
const CHARACTER_TOPICS = new Set(["overview", "perspective", "knowledge", "capability", "affiliation", "relationship", "status", "motivation", "cause"]);
const MAGIC_TOPICS = new Set(["overview", "principle", "rule", "limitation", "cost", "application", "exception", "interaction"]);

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== "string" || !keys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    return keys.every(key => Object.prototype.hasOwnProperty.call(result, key)) ? result : null;
  } catch { return null; }
}

function denseArray(value: unknown, min: number, max: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < min || value.length > max || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) return null;
    }
    return Object.freeze(result);
  } catch { return null; }
}

function validDomainTopic(domain: unknown, topic: unknown): domain is HoidInvestigationDomain {
  if (typeof topic !== "string") return false;
  if (domain === "character-evolution") return CHARACTER_TOPICS.has(topic);
  if (domain === "magic-system") return MAGIC_TOPICS.has(topic);
  if (domain === "entity-dossier") return topic === "overview";
  if (domain === "entity-relationship") return topic === "relationship";
  if (domain === "entity-timeline") return topic === "timeline";
  return false;
}

function canonicalHistory(value: unknown, revision: number, fingerprint: string, scopeFingerprint: string): readonly HoidInvestigationHistoryEntry[] | null {
  const raw = denseArray(value, 0, MAX_HISTORY);
  if (!raw) return null;
  const result: HoidInvestigationHistoryEntry[] = [];
  const sequences = new Set<number>();
  for (const item of raw) {
    const entry = exactRecord(item, ["subjectFingerprint", "domain", "topic", "progressRevision", "progressFingerprint", "scopeFingerprint", "sequence"]);
    if (
      !entry ||
      typeof entry.subjectFingerprint !== "string" || !SHA.test(entry.subjectFingerprint) ||
      !validDomainTopic(entry.domain, entry.topic) ||
      typeof entry.progressRevision !== "number" || !Number.isSafeInteger(entry.progressRevision) || entry.progressRevision < 0 ||
      typeof entry.progressFingerprint !== "string" || !SHA.test(entry.progressFingerprint) ||
      typeof entry.scopeFingerprint !== "string" || !SHA.test(entry.scopeFingerprint) ||
      typeof entry.sequence !== "number" || !Number.isSafeInteger(entry.sequence) || entry.sequence < 1 ||
      sequences.has(entry.sequence)
    ) return null;
    sequences.add(entry.sequence);
    if (entry.progressRevision === revision && entry.progressFingerprint === fingerprint && entry.scopeFingerprint === scopeFingerprint) {
      result.push(Object.freeze({
        subjectFingerprint: entry.subjectFingerprint,
        domain: entry.domain,
        topic: entry.topic as HoidInvestigationTopic,
        progressRevision: entry.progressRevision,
        progressFingerprint: entry.progressFingerprint,
        scopeFingerprint: entry.scopeFingerprint,
        sequence: entry.sequence,
      }));
    }
  }
  return Object.freeze(result);
}

function topicsFor(values: Map<string, HoidInvestigationContextTopic>): readonly HoidInvestigationContextTopic[] {
  return Object.freeze([...values.values()].sort((a, b) =>
    a.domain < b.domain ? -1 : a.domain > b.domain ? 1 :
    a.topic < b.topic ? -1 : a.topic > b.topic ? 1 : 0
  ));
}

/** Plans links only from a locally branded authorized graph and exact-scope completed history. */
export function planHoidInvestigationContext(input: unknown): HoidInvestigationContextPlanResult {
  const request = exactRecord(input, ["graph", "history", "progressRevision", "progressFingerprint", "bookScope"]);
  if (!request) return Object.freeze({ status: "unavailable", reason: "invalid-request" });
  if (
    typeof request.progressRevision !== "number" || !Number.isSafeInteger(request.progressRevision) || request.progressRevision < 0 ||
    typeof request.progressFingerprint !== "string" || !SHA.test(request.progressFingerprint)
  ) return Object.freeze({ status: "unavailable", reason: "invalid-progress" });

  const scope = canonicalizeHoidAnswerBookScope(request.bookScope);
  if (!scope) return Object.freeze({ status: "unavailable", reason: "invalid-scope" });
  const scopeFingerprint = fingerprintHoidInvestigationScope(request.progressRevision, request.progressFingerprint, scope);
  if (!scopeFingerprint) return Object.freeze({ status: "unavailable", reason: "invalid-scope" });

  if (!isHoidAuthorizedKnowledgeGraphResult(request.graph)) return Object.freeze({ status: "unavailable", reason: "invalid-graph" });
  const graph = request.graph;
  if (graph.progressRevision !== request.progressRevision || graph.progressFingerprint !== request.progressFingerprint) {
    return Object.freeze({ status: "unavailable", reason: "progress-mismatch" });
  }
  const history = canonicalHistory(request.history, request.progressRevision, request.progressFingerprint, scopeFingerprint);
  if (!history) return Object.freeze({ status: "unavailable", reason: "invalid-history" });

  const nodes = denseArray(graph.nodes, 0, MAX_NODES);
  const edges = denseArray(graph.edges, 0, MAX_EDGES);
  if (!nodes || !edges) return Object.freeze({ status: "unavailable", reason: "invalid-graph" });

  const nodeIds = new Set<string>();
  const aliasOwners = new Map<string, Set<string>>();
  for (const rawNode of nodes) {
    const node = exactRecord(rawNode, ["id", "kind", "aliasFingerprints"]);
    const aliases = node ? denseArray(node.aliasFingerprints, 1, MAX_ALIASES) : null;
    if (!node || typeof node.id !== "string" || !ID.test(node.id) || typeof node.kind !== "string" ||
        nodeIds.has(node.id) || !aliases || aliases.some(alias => typeof alias !== "string" || !SHA.test(alias))) {
      return Object.freeze({ status: "unavailable", reason: "invalid-graph" });
    }
    nodeIds.add(node.id);
    for (const alias of aliases as readonly string[]) {
      const owners = aliasOwners.get(alias) ?? new Set<string>();
      owners.add(node.id);
      aliasOwners.set(alias, owners);
    }
  }

  const byNode = new Map<string, Map<string, HoidInvestigationContextTopic>>();
  for (const entry of history) {
    const owners = aliasOwners.get(entry.subjectFingerprint);
    if (!owners || owners.size !== 1) continue;
    const nodeId = [...owners][0];
    const topics = byNode.get(nodeId) ?? new Map<string, HoidInvestigationContextTopic>();
    topics.set(entry.domain + ":" + entry.topic, Object.freeze({ domain: entry.domain, topic: entry.topic }));
    byNode.set(nodeId, topics);
  }

  const links: HoidInvestigationContextLink[] = [];
  const seen = new Set<string>();
  for (const rawEdge of edges) {
    if (rawEdge === null || typeof rawEdge !== "object") return Object.freeze({ status: "unavailable", reason: "invalid-graph" });
    const edge = rawEdge as Record<string, unknown>;
    if (
      typeof edge.id !== "string" || !ID.test(edge.id) ||
      typeof edge.sourceId !== "string" || typeof edge.targetId !== "string" ||
      edge.sourceId === edge.targetId || !PREDICATES.has(edge.predicate as HoidKnowledgeGraphPredicate) ||
      !nodeIds.has(edge.sourceId) || !nodeIds.has(edge.targetId)
    ) return Object.freeze({ status: "unavailable", reason: "invalid-graph" });
    const left = byNode.get(edge.sourceId);
    const right = byNode.get(edge.targetId);
    if (!left || !right) continue;

    const rawSources = denseArray(edge.sources, 1, MAX_SOURCES);
    if (!rawSources) return Object.freeze({ status: "unavailable", reason: "invalid-graph" });
    const bookIds: string[] = [];
    const citations = new Map<string, HoidInvestigationContextSource>();
    for (const rawSource of rawSources) {
      if (rawSource === null || typeof rawSource !== "object") return Object.freeze({ status: "unavailable", reason: "invalid-graph" });
      const source = rawSource as Record<string, unknown>;
      if (
        typeof source.sourceBookId !== "string" || source.sourceBookId !== source.sourceBookId.trim() ||
        typeof source.sourceChapter !== "number" || !Number.isSafeInteger(source.sourceChapter) || source.sourceChapter < 1
      ) return Object.freeze({ status: "unavailable", reason: "invalid-graph" });
      bookIds.push(source.sourceBookId);
      citations.set(source.sourceBookId + ":" + source.sourceChapter, Object.freeze({
        sourceBookId: source.sourceBookId,
        chapter: source.sourceChapter,
      }));
    }
    if (!claimEvidenceMatchesHoidBookScope(bookIds, scope)) continue;
    const sources = Object.freeze([...citations.values()].sort((a, b) =>
      a.sourceBookId < b.sourceBookId ? -1 : a.sourceBookId > b.sourceBookId ? 1 : a.chapter - b.chapter
    ));
    if (sources.length === 0) continue;

    const predicate = edge.predicate as HoidKnowledgeGraphPredicate;
    const linkFingerprint = sha256Hex(JSON.stringify({
      edgeId: edge.id, sourceId: edge.sourceId, targetId: edge.targetId, predicate,
      progressRevision: request.progressRevision, progressFingerprint: request.progressFingerprint, scopeFingerprint,
    }));
    if (seen.has(linkFingerprint)) continue;
    seen.add(linkFingerprint);
    links.push(Object.freeze({
      linkFingerprint,
      leftNodeFingerprint: sha256Hex(edge.sourceId),
      rightNodeFingerprint: sha256Hex(edge.targetId),
      predicate,
      leftInvestigations: topicsFor(left),
      rightInvestigations: topicsFor(right),
      sources,
    }));
  }

  links.sort((a, b) =>
    a.leftNodeFingerprint < b.leftNodeFingerprint ? -1 : a.leftNodeFingerprint > b.leftNodeFingerprint ? 1 :
    a.rightNodeFingerprint < b.rightNodeFingerprint ? -1 : a.rightNodeFingerprint > b.rightNodeFingerprint ? 1 :
    a.predicate < b.predicate ? -1 : a.predicate > b.predicate ? 1 : 0
  );
  return Object.freeze({
    status: "ready",
    progressRevision: request.progressRevision,
    progressFingerprint: request.progressFingerprint,
    scopeFingerprint,
    links: Object.freeze(links.slice(0, MAX_LINKS)),
  });
}
