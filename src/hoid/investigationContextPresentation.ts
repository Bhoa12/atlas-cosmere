import {
  planHoidInvestigationContext,
  type HoidInvestigationContextTopic,
  type HoidInvestigationContextSource,
} from "./investigationContext";
import {
  isHoidAuthorizedKnowledgeGraphResult,
  type HoidKnowledgeGraphPredicate,
} from "./knowledgeGraph";
import {
  isHoidAuthorizedEntityAliasDisclosureResult,
  resolveHoidAuthorizedEntityAliasDisclosures,
  type HoidResolvedEntityAliasDisclosure,
} from "./entityResolver";
import type { HoidAnswerBookScope } from "./answerScope";
import type { HoidInvestigationHistoryEntry } from "./investigationSession";
import { fingerprintHoidCursorProgressSnapshot } from "./knowledgeGraph";
import { sha256Hex } from "./sha256";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { HOID_EDITORIAL_KNOWLEDGE } from "./editorialRegistry";
import { HOID_ENTITY_ALIAS_EVIDENCE } from "./entityAliasRegistry";

export type HoidPresentedInvestigationContextSource = Readonly<{
  bookId: string;
  bookTitle: string;
  chapter: number;
  role: "relationship" | "entity-label";
}>;

export type HoidPresentedInvestigationContextLink = Readonly<{
  leftLabel: string;
  rightLabel: string;
  predicate: HoidKnowledgeGraphPredicate;
  explanation: string;
  leftInvestigations: readonly HoidInvestigationContextTopic[];
  rightInvestigations: readonly HoidInvestigationContextTopic[];
  sources: readonly HoidPresentedInvestigationContextSource[];
  followUpQuestion: string;
}>;

export type HoidInvestigationContextPresentationResult =
  | Readonly<{
      status: "ready";
      progressRevision: number;
      progressFingerprint: string;
      scopeFingerprint: string;
      links: readonly HoidPresentedInvestigationContextLink[];
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-request"
        | "invalid-progress"
        | "invalid-scope"
        | "invalid-graph"
        | "invalid-history"
        | "progress-mismatch"
        | "locked-or-ambiguous-alias"
        | "stale-progress";
    }>;

export type HoidInvestigationContextPresenter = Readonly<{
  present(input: unknown): HoidInvestigationContextPresentationResult;
}>;

type PresenterConfig = Readonly<{
  knowledge: unknown;
  aliasEvidence: unknown;
  getCurrentProgress: () => unknown;
}>;

const PRESENTERS = new WeakSet<object>();
const MAX_HISTORY = 64;
const MAX_SOURCES = 64;
const MAX_LABEL_LENGTH = 256;

const RELATION_LABELS: Readonly<Record<HoidKnowledgeGraphPredicate, string>> = Object.freeze({
  "related-to": "relación",
  "appears-in": "aparición",
  "located-in": "ubicación",
  "member-of": "pertenencia",
  "uses": "uso",
  "participates-in": "participación",
  "created-by": "creación",
  "part-of": "composición",
  "causes": "causalidad",
  "opposes": "oposición",
  "allied-with": "alianza",
});

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
  } catch {
    return null;
  }
}

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum ||
        Object.getPrototypeOf(value) !== Array.prototype) return null;
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
  } catch {
    return null;
  }
}

function canonicalHistory(value: unknown): readonly HoidInvestigationHistoryEntry[] | null {
  const entries = denseArray(value, 0, MAX_HISTORY);
  if (!entries) return null;
  const result: HoidInvestigationHistoryEntry[] = [];
  const sequences = new Set<number>();
  for (const raw of entries) {
    const entry = exactRecord(raw, [
      "subjectFingerprint", "domain", "topic", "progressRevision",
      "progressFingerprint", "scopeFingerprint", "sequence",
    ]);
    if (!entry ||
        typeof entry.subjectFingerprint !== "string" || !/^[a-f0-9]{64}$/u.test(entry.subjectFingerprint) ||
        typeof entry.domain !== "string" || typeof entry.topic !== "string" ||
        typeof entry.progressRevision !== "number" || !Number.isSafeInteger(entry.progressRevision) || entry.progressRevision < 0 ||
        typeof entry.progressFingerprint !== "string" || !/^[a-f0-9]{64}$/u.test(entry.progressFingerprint) ||
        typeof entry.scopeFingerprint !== "string" || !/^[a-f0-9]{64}$/u.test(entry.scopeFingerprint) ||
        typeof entry.sequence !== "number" || !Number.isSafeInteger(entry.sequence) || entry.sequence < 1 ||
        sequences.has(entry.sequence)) return null;
    sequences.add(entry.sequence);
    result.push(entry as unknown as HoidInvestigationHistoryEntry);
  }
  return Object.freeze(result);
}

function historyMatches(
  alias: HoidResolvedEntityAliasDisclosure,
  topics: readonly HoidInvestigationContextTopic[],
  history: readonly HoidInvestigationHistoryEntry[],
  progressRevision: number,
  progressFingerprint: string,
  scopeFingerprint: string,
): boolean {
  return history.some(entry =>
    entry.subjectFingerprint === alias.fingerprint &&
    entry.progressRevision === progressRevision &&
    entry.progressFingerprint === progressFingerprint &&
    entry.scopeFingerprint === scopeFingerprint &&
    topics.some(topic => topic.domain === entry.domain && topic.topic === entry.topic)
  );
}

function findHistoryBoundAlias(
  entityId: string,
  aliases: readonly HoidResolvedEntityAliasDisclosure[],
  topics: readonly HoidInvestigationContextTopic[],
  history: readonly HoidInvestigationHistoryEntry[],
  progressRevision: number,
  progressFingerprint: string,
  scopeFingerprint: string,
): HoidResolvedEntityAliasDisclosure | null {
  return aliases.find(alias =>
    alias.entityId === entityId &&
    historyMatches(alias, topics, history, progressRevision, progressFingerprint, scopeFingerprint)
  ) ?? null;
}

function sourceProjection(
  source: HoidInvestigationContextSource | Readonly<{ sourceBookId: string; chapter: number }>,
  role: HoidPresentedInvestigationContextSource["role"],
): HoidPresentedInvestigationContextSource | null {
  const work = HOID_SOURCE_BIBLIOGRAPHY.find(item => item.id === source.sourceBookId);
  if (!work || !Number.isSafeInteger(source.chapter) || source.chapter < 1) return null;
  return Object.freeze({
    bookId: work.id,
    bookTitle: work.title,
    chapter: source.chapter,
    role,
  });
}

function uniqueSources(
  values: readonly HoidPresentedInvestigationContextSource[],
): readonly HoidPresentedInvestigationContextSource[] {
  const byKey = new Map<string, HoidPresentedInvestigationContextSource>();
  for (const value of values) {
    byKey.set(value.role + ":" + value.bookId + ":" + value.chapter, value);
  }
  return Object.freeze([...byKey.values()].sort((left, right) =>
    left.bookTitle < right.bookTitle ? -1 :
    left.bookTitle > right.bookTitle ? 1 :
    left.chapter - right.chapter ||
    (left.role < right.role ? -1 : left.role > right.role ? 1 : 0)
  ));
}

function unavailable(
  reason: Extract<HoidInvestigationContextPresentationResult, { status: "unavailable" }>["reason"],
): HoidInvestigationContextPresentationResult {
  return Object.freeze({ status: "unavailable", reason });
}

function sameProgress(left: unknown, right: unknown): boolean {
  const a = fingerprintHoidCursorProgressSnapshot(left);
  const b = fingerprintHoidCursorProgressSnapshot(right);
  return a.status === "ready" && b.status === "ready" &&
    a.revision === b.revision && a.sha256 === b.sha256;
}

function canonicalConfig(value: unknown): PresenterConfig | null {
  const config = exactRecord(value, ["knowledge", "aliasEvidence", "getCurrentProgress"]);
  if (!config || typeof config.getCurrentProgress !== "function" ||
      !Array.isArray(config.knowledge) || !Array.isArray(config.aliasEvidence)) return null;
  return Object.freeze({
    knowledge: config.knowledge,
    aliasEvidence: config.aliasEvidence,
    getCurrentProgress: config.getCurrentProgress as () => unknown,
  });
}

/**
 * Converts the opaque context plan into user-facing explanations only after
 * every displayed label has its own approved, unlocked alias disclosure.
 * Provider output is not accepted at this boundary.
 */
export function createHoidInvestigationContextPresenter(configInput: unknown): HoidInvestigationContextPresenter | null {
  const config = canonicalConfig(configInput);
  if (!config) return null;

  const presenter: HoidInvestigationContextPresenter = Object.freeze({
    present(input: unknown): HoidInvestigationContextPresentationResult {
      const request = exactRecord(input, ["graph", "history", "bookScope"]);
      if (!request) return unavailable("invalid-request");

      let before: unknown;
      try {
        before = config.getCurrentProgress();
      } catch {
        return unavailable("invalid-progress");
      }
      const beforeIdentity = fingerprintHoidCursorProgressSnapshot(before);
      if (beforeIdentity.status !== "ready") return unavailable("invalid-progress");

      const plan = planHoidInvestigationContext({
        graph: request.graph,
        history: request.history,
        progressRevision: beforeIdentity.revision,
        progressFingerprint: beforeIdentity.sha256,
        bookScope: request.bookScope,
      });
      if (plan.status !== "ready") return unavailable(plan.reason);

      const history = canonicalHistory(request.history);
      if (!history) return unavailable("invalid-history");

      if (plan.links.length === 0) {
        let after: unknown;
        try {
          after = config.getCurrentProgress();
        } catch {
          return unavailable("invalid-progress");
        }
        if (!sameProgress(before, after)) return unavailable("stale-progress");
        return Object.freeze({
          status: "ready",
          progressRevision: plan.progressRevision,
          progressFingerprint: plan.progressFingerprint,
          scopeFingerprint: plan.scopeFingerprint,
          links: Object.freeze([]),
        });
      }

      if (!isHoidAuthorizedKnowledgeGraphResult(request.graph)) return unavailable("invalid-graph");
      const graph = request.graph;
      const neededNodeFingerprints = new Set<string>();
      for (const link of plan.links) {
        neededNodeFingerprints.add(link.leftNodeFingerprint);
        neededNodeFingerprints.add(link.rightNodeFingerprint);
      }
      const neededNodes = graph.nodes.filter(node => neededNodeFingerprints.has(sha256Hex(node.id)));
      if (neededNodes.length !== neededNodeFingerprints.size) return unavailable("invalid-graph");

      const disclosureResult = resolveHoidAuthorizedEntityAliasDisclosures(
        config.knowledge,
        config.aliasEvidence,
        before,
        neededNodes.map(node => node.id),
        request.bookScope,
      );
      if (!isHoidAuthorizedEntityAliasDisclosureResult(disclosureResult)) {
        return unavailable(disclosureResult.status === "unavailable"
          ? disclosureResult.reason === "invalid-progress" ? "invalid-progress" :
            disclosureResult.reason === "invalid-scope" ? "invalid-scope" :
            "locked-or-ambiguous-alias"
          : "locked-or-ambiguous-alias");
      }
      if (disclosureResult.progressRevision !== plan.progressRevision ||
          disclosureResult.progressFingerprint !== plan.progressFingerprint) {
        return unavailable("progress-mismatch");
      }

      const aliases = disclosureResult.aliases;
      const links: HoidPresentedInvestigationContextLink[] = [];
      for (const link of plan.links) {
        const leftNode = graph.nodes.find(node => sha256Hex(node.id) === link.leftNodeFingerprint);
        const rightNode = graph.nodes.find(node => sha256Hex(node.id) === link.rightNodeFingerprint);
        if (!leftNode || !rightNode) return unavailable("invalid-graph");

        const leftAlias = findHistoryBoundAlias(
          leftNode.id, aliases, link.leftInvestigations, history,
          plan.progressRevision, plan.progressFingerprint, plan.scopeFingerprint,
        );
        const rightAlias = findHistoryBoundAlias(
          rightNode.id, aliases, link.rightInvestigations, history,
          plan.progressRevision, plan.progressFingerprint, plan.scopeFingerprint,
        );
        // A graph edge may have matched a history fingerprint for an alias
        // whose own disclosure is still locked. In that case it is silently
        // omitted rather than revealing that the hidden alias exists.
        if (!leftAlias || !rightAlias) continue;

        if (leftAlias.label.length < 1 || leftAlias.label.length > MAX_LABEL_LENGTH ||
            rightAlias.label.length < 1 || rightAlias.label.length > MAX_LABEL_LENGTH) {
          return unavailable("locked-or-ambiguous-alias");
        }

        const sources: HoidPresentedInvestigationContextSource[] = [];
        for (const source of link.sources) {
          const projected = sourceProjection(source, "relationship");
          if (!projected) return unavailable("invalid-graph");
          sources.push(projected);
        }
        for (const source of leftAlias.sources) {
          const projected = sourceProjection(source, "entity-label");
          if (!projected) return unavailable("invalid-graph");
          sources.push(projected);
        }
        for (const source of rightAlias.sources) {
          const projected = sourceProjection(source, "entity-label");
          if (!projected) return unavailable("invalid-graph");
          sources.push(projected);
        }
        if (sources.length > MAX_SOURCES) return unavailable("invalid-graph");

        const relationLabel = RELATION_LABELS[link.predicate];
        links.push(Object.freeze({
          leftLabel: leftAlias.label,
          rightLabel: rightAlias.label,
          predicate: link.predicate,
          explanation: "El registro editorial verificado describe una relación de tipo " +
            relationLabel + " entre " + leftAlias.label + " y " + rightAlias.label + ".",
          leftInvestigations: link.leftInvestigations,
          rightInvestigations: link.rightInvestigations,
          sources: uniqueSources(sources),
          followUpQuestion: "¿Qué evidencias desbloqueadas explican la relación entre " +
            leftAlias.label + " y " + rightAlias.label + "?",
        }));
      }

      let after: unknown;
      try {
        after = config.getCurrentProgress();
      } catch {
        return unavailable("invalid-progress");
      }
      if (!sameProgress(before, after)) return unavailable("stale-progress");

      return Object.freeze({
        status: "ready",
        progressRevision: plan.progressRevision,
        progressFingerprint: plan.progressFingerprint,
        scopeFingerprint: plan.scopeFingerprint,
        links: Object.freeze(links),
      });
    },
  });
  PRESENTERS.add(presenter as object);
  return presenter;
}

export function isHoidInvestigationContextPresenter(
  value: unknown,
): value is HoidInvestigationContextPresenter {
  return value !== null && typeof value === "object" && PRESENTERS.has(value as object);
}

/** Production presenter bound to the local editorial and alias registries. */
export function createProductionHoidInvestigationContextPresenter(
  getCurrentProgress: () => unknown,
): HoidInvestigationContextPresenter | null {
  return createHoidInvestigationContextPresenter({
    knowledge: HOID_EDITORIAL_KNOWLEDGE,
    aliasEvidence: HOID_ENTITY_ALIAS_EVIDENCE,
    getCurrentProgress,
  });
}
