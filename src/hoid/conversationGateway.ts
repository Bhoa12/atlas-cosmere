import type { HoidCursorEvidenceRuntime } from "./cursorEvidenceRuntime";
import type { HoidClaimIntent, HoidEvidenceAnswer, HoidRuntimeCallOptions } from "./evidenceRuntime";
import type { HoidRecommendation } from "./recommendations";
import { canonicalizeHoidAnswerBookScope, type HoidAnswerBookScope } from "./answerScope";
import {
  isHoidExplanationDepth,
  resolveHoidExplanationDepthBudget,
  type HoidExplanationDepth,
} from "./explanationDepth";
import { buildHoidCursorReadingContext, type HoidCursorReadingContext } from "./cursorReadingContext";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import {
  resolveProductionHoidEntityIds,
  resolveProductionHoidEntityMentions,
  type HoidEntityMentionResolutionResult,
} from "./entityResolver";
import type { HoidKnowledgeKind } from "./catalog";
import { invokeWithHoidProgressChangeWatch, type HoidProgressChangeSubscription } from "./progressChangeWatch";
import { isHoidRelationshipQuestion } from "./relationshipIntent";
import { createProductionHoidExplanationGateway } from "./explanationGateway";
import {
  createHoidRelationshipGateway,
  type HoidRelationshipGateway,
  type HoidRelationshipGatewayResult,
} from "./relationshipGateway";
import { createHoidEvidenceAnswerFromRelationshipResult } from "./relationshipPresentation";
import {
  createHoidConversationContext,
  resolveHoidConversationFollowUp,
  validateHoidConversationContext,
  type HoidConversationContext,
} from "./conversationContext";
import {
  createHoidTypedConversationContext,
  resolveHoidTypedEntityFollowUp,
  type HoidTypedConversationContext,
} from "./typedConversationContext";
import {
  createHoidConversationScopeBinding,
  validateHoidConversationScopeBinding,
  type HoidConversationScopeBinding,
} from "./conversationScopeBinding";
import {
  resolveProductionHoidCoreference,
  type HoidCoreferenceResolutionResult,
} from "./coreferenceResolver";

type HoidConversationRuntime = Pick<HoidCursorEvidenceRuntime, "answer"> & {
  recommend?: (progress: unknown, limit?: number, options?: HoidRuntimeCallOptions) => unknown | Promise<unknown>;
};

export type HoidConversationGatewayResult =
  | Readonly<{
      status: "ready";
      answer: HoidEvidenceAnswer;
      depth: HoidExplanationDepth;
      conversationContext?: HoidConversationContext;
      typedConversationContext?: HoidTypedConversationContext;
      conversationScopeBinding?: HoidConversationScopeBinding;
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-request"
        | "invalid-progress"
        | "progress-changed"
        | "cancelled"
        | "runtime-failed"
        | "entity-blocked"
        | "entity-ambiguous"
        | "entity-unavailable"
        | "context-ambiguous"
        | "context-unavailable"
        | "context-stale"
        | "context-scope-unavailable"
        | "context-scope-mismatch";
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
        | "cancelled"
        | "runtime-unavailable"
        | "runtime-failed"
        | "invalid-recommendations";
    }>;

export type HoidConversationReadingContextResult =
  | Readonly<{
      status: "ready";
      context: HoidCursorReadingContext;
      progressRevision: number;
      progressFingerprint: string;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-request" | "invalid-progress" | "progress-changed";
    }>;

export type HoidConversationGatewayConfig = Readonly<{
  runtime: HoidConversationRuntime;
  /** Must return the coordinator's latest authoritative v2 snapshot. */
  getCurrentProgress: () => unknown;
  /** Optional durable read-through used before and after async answer work. */
  refreshCurrentProgress?: () => unknown | Promise<unknown>;
  /** Optional durable-ledger event port; listeners fire only after a committed progress change. */
  subscribeToProgressChanges?: HoidProgressChangeSubscription;
  /** Optional test seam; production defaults to reviewed local coreference evidence. */
  resolveCoreference?: (
    question: string,
    context: unknown,
    progress: unknown,
  ) => HoidCoreferenceResolutionResult;
  /** Optional test seam; production defaults to the source-controlled mention resolver. */
  resolveEntities?: (progress: unknown, question: string) => HoidEntityMentionResolutionResult;
  /** Revalidates every typed context ID against current production knowledge and alias evidence. */
  resolveEntityIds?: (progress: unknown, entityIds: readonly string[]) => HoidEntityMentionResolutionResult;
  /** Optional trusted local graph route; production composition supplies it by default. */
  relationshipGateway?: Pick<HoidRelationshipGateway, "answer"> | null;
}>;

async function readCurrentProgress(config: HoidConversationGatewayConfig): Promise<unknown> {
  if (typeof config.refreshCurrentProgress === "function") {
    return await config.refreshCurrentProgress();
  }
  return config.getCurrentProgress();
}

const REQUEST_KEYS = ["question", "progress", "intent", "context", "typedContext", "depth", "bookScope", "scopeBinding"] as const;
const RECOMMENDATION_KEYS = ["progress", "limit"] as const;
const CONTEXT_KEYS = ["progress"] as const;
const MAX_QUESTION_LENGTH = 4_000;
const DEFAULT_RECOMMENDATION_LIMIT = 3;
const MAX_RECOMMENDATION_LIMIT = 20;

function canonicalRequest(value: unknown): Readonly<{
  question: string;
  progress: unknown;
  intent: HoidClaimIntent;
  depth: HoidExplanationDepth;
  selectionBudget: NonNullable<ReturnType<typeof resolveHoidExplanationDepthBudget>>;
  context?: unknown;
  typedContext?: unknown;
  bookScope?: HoidAnswerBookScope;
  scopeBinding?: unknown;
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

  const depth = record.depth === undefined ? "detailed" : record.depth;
  if (!isHoidExplanationDepth(depth)) return null;
  const selectionBudget = resolveHoidExplanationDepthBudget(depth);
  if (!selectionBudget) return null;

  let bookScope: HoidAnswerBookScope | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "bookScope")) {
    const canonicalScope = canonicalizeHoidAnswerBookScope(record.bookScope);
    if (!canonicalScope) return null;
    bookScope = canonicalScope;
  }

  return Object.freeze({
    question,
    progress: record.progress,
    intent,
    depth,
    selectionBudget,
    ...(Object.prototype.hasOwnProperty.call(record, "context") ? { context: record.context } : {}),
    ...(Object.prototype.hasOwnProperty.call(record, "typedContext") ? { typedContext: record.typedContext } : {}),
    ...(bookScope ? { bookScope } : {}),
    ...(Object.prototype.hasOwnProperty.call(record, "scopeBinding") ? { scopeBinding: record.scopeBinding } : {}),
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

function canonicalContextRequest(value: unknown): Readonly<{ progress: unknown }> | null {
  const record = canonicalDataRecord(value, CONTEXT_KEYS, ["progress"]);
  if (!record) return null;
  return Object.freeze({ progress: record.progress });
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

const ENTITY_KINDS = new Set<HoidKnowledgeKind>([
  "character", "place", "event", "phenomenon", "concept", "magic", "organization", "object",
]);

function canonicalTypedEntityReauthorization(
  value: unknown,
  expectedIds: readonly string[],
  expectedKinds: readonly HoidKnowledgeKind[],
  expectedProgress: ProgressIdentity,
): boolean {
  const record = canonicalDataRecord(
    value,
    ["status", "resolution", "progressRevision", "progressFingerprint", "matches", "truncated"],
    ["status"],
  );
  if (
    !record ||
    Object.keys(record).length !== 6 ||
    record.status !== "ready" ||
    record.resolution !== "matched" ||
    record.progressRevision !== expectedProgress.revision ||
    record.progressFingerprint !== expectedProgress.fingerprint ||
    record.truncated !== false
  ) return false;

  const matches = canonicalDenseArray(record.matches, 4);
  if (!matches || matches.length !== expectedIds.length || expectedIds.length !== expectedKinds.length) return false;
  for (let index = 0; index < matches.length; index += 1) {
    const item = canonicalDataRecord(matches[index], [
      "id", "kind", "matchedAlias", "entitySource", "aliasEvidence",
    ], ["id", "kind"]);
    if (
      !item ||
      typeof item.id !== "string" ||
      item.id !== expectedIds[index] ||
      typeof item.kind !== "string" ||
      !ENTITY_KINDS.has(item.kind as HoidKnowledgeKind) ||
      item.kind !== expectedKinds[index]
    ) return false;
  }
  return true;
}

function reauthorizeTypedContext(
  progress: unknown,
  context: HoidTypedConversationContext,
  expectedProgress: ProgressIdentity,
  resolver: NonNullable<HoidConversationGatewayConfig["resolveEntityIds"]>,
): boolean {
  try {
    const ids = context.entities.map(entity => entity.id);
    const kinds = context.entities.map(entity => entity.kind);
    const result = resolver(progress, ids);
    return canonicalTypedEntityReauthorization(result, ids, kinds, expectedProgress);
  } catch {
    return false;
  }
}

function buildTypedContextFromIds(
  progress: unknown,
  entityIds: readonly string[],
  expectedProgress: ProgressIdentity,
  resolver: NonNullable<HoidConversationGatewayConfig["resolveEntityIds"]>,
): HoidTypedConversationContext | null {
  if (entityIds.length < 2 || entityIds.length > 4) return null;
  try {
    const result = resolver(progress, entityIds);
    const record = canonicalDataRecord(
      result,
      ["status", "resolution", "progressRevision", "progressFingerprint", "matches", "truncated"],
      ["status"],
    );
    if (
      !record ||
      Object.keys(record).length !== 6 ||
      record.status !== "ready" ||
      record.resolution !== "matched" ||
      record.progressRevision !== expectedProgress.revision ||
      record.progressFingerprint !== expectedProgress.fingerprint ||
      record.truncated !== false
    ) return null;
    const matches = canonicalDenseArray(record.matches, 4);
    if (!matches || matches.length !== entityIds.length) return null;
    const refs: Array<Readonly<{ id: string; kind: HoidKnowledgeKind }>> = [];
    for (let index = 0; index < matches.length; index += 1) {
      const item = canonicalDataRecord(matches[index], [
        "id", "kind", "matchedAlias", "entitySource", "aliasEvidence",
      ], ["id", "kind"]);
      if (
        !item ||
        item.id !== entityIds[index] ||
        typeof item.kind !== "string" ||
        !ENTITY_KINDS.has(item.kind as HoidKnowledgeKind)
      ) return null;
      refs.push(Object.freeze({ id: item.id as string, kind: item.kind as HoidKnowledgeKind }));
    }
    return createHoidTypedConversationContext(refs, expectedProgress);
  } catch {
    return null;
  }
}

function sameProgress(left: ProgressIdentity, right: ProgressIdentity): boolean {
  return left.revision === right.revision && left.fingerprint === right.fingerprint;
}

type FollowUpScopeResolution =
  | Readonly<{ status: "ready"; scope: HoidAnswerBookScope }>
  | Readonly<{ status: "unavailable"; reason: "context-scope-unavailable" | "context-scope-mismatch" | "context-stale" }>;

function resolveFollowUpScope(
  request: Readonly<{ scopeBinding?: unknown; bookScope?: HoidAnswerBookScope }>,
  progress: unknown,
): FollowUpScopeResolution {
  if (request.scopeBinding === undefined) {
    return Object.freeze({ status: "unavailable", reason: "context-scope-unavailable" });
  }
  const validation = validateHoidConversationScopeBinding(
    request.scopeBinding,
    progress,
    request.bookScope,
  );
  if (validation.status === "ready") {
    return Object.freeze({ status: "ready", scope: validation.scope });
  }
  if (validation.reason === "stale-progress") {
    return Object.freeze({ status: "unavailable", reason: "context-stale" });
  }
  if (validation.reason === "scope-mismatch") {
    return Object.freeze({ status: "unavailable", reason: "context-scope-mismatch" });
  }
  return Object.freeze({ status: "unavailable", reason: "context-scope-unavailable" });
}

type ActiveConversationScopeResolution =
  | Readonly<{
      status: "ready";
      scope?: HoidAnswerBookScope;
      binding?: HoidConversationScopeBinding;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "context-scope-unavailable" | "context-scope-mismatch" | "context-stale";
    }>;

/**
 * Once an answer establishes a scope, every subsequent turn remains inside it
 * until the user explicitly resets the conversation or selects another scope.
 * This also covers complete-looking questions that follow-up heuristics miss.
 */
function resolveActiveConversationScope(
  request: Readonly<{ scopeBinding?: unknown; bookScope?: HoidAnswerBookScope }>,
  progress: unknown,
): ActiveConversationScopeResolution {
  if (request.scopeBinding === undefined) {
    return Object.freeze({
      status: "ready",
      ...(request.bookScope ? { scope: request.bookScope } : {}),
    });
  }
  const validation = validateHoidConversationScopeBinding(
    request.scopeBinding,
    progress,
    request.bookScope,
  );
  if (validation.status === "ready") {
    return Object.freeze({
      status: "ready",
      scope: validation.scope,
      binding: validation.binding,
    });
  }
  if (validation.reason === "stale-progress") {
    return Object.freeze({ status: "unavailable", reason: "context-stale" });
  }
  if (validation.reason === "scope-mismatch") {
    return Object.freeze({ status: "unavailable", reason: "context-scope-mismatch" });
  }
  return Object.freeze({ status: "unavailable", reason: "context-scope-unavailable" });
}

function callerAborted(options?: HoidRuntimeCallOptions): boolean {
  return options?.signal?.aborted === true;
}

const MAX_ENTITY_SCOPE_IDS = 8;
const ENTITY_SCOPE_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

/** Canonicalize only the IDs of an unambiguous, progress-bound mention result. */
function canonicalMatchedEntityIds(
  result: Extract<HoidEntityMentionResolutionResult, { status: "ready" }>,
): readonly string[] | null {
  try {
    if (result.resolution === "not-found") {
      return Array.isArray(result.matches) && result.matches.length === 0 && result.truncated === false
        ? Object.freeze([])
        : null;
    }
    if (result.resolution !== "matched" || result.truncated !== false) return null;
    const matches = result.matches;
    if (!Array.isArray(matches) || matches.length < 1 || matches.length > MAX_ENTITY_SCOPE_IDS) return null;
    if (Object.getPrototypeOf(matches) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(matches);
    if (keys.length !== matches.length + 1 || !keys.includes("length")) return null;

    const ids: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < matches.length; index += 1) {
      const itemDescriptor = Object.getOwnPropertyDescriptor(matches, String(index));
      if (!itemDescriptor || !Object.prototype.hasOwnProperty.call(itemDescriptor, "value") || itemDescriptor.enumerable !== true) return null;
      const item = itemDescriptor.value;
      if (item === null || typeof item !== "object" || Array.isArray(item)) return null;
      const idDescriptor = Object.getOwnPropertyDescriptor(item, "id");
      if (
        !idDescriptor ||
        !Object.prototype.hasOwnProperty.call(idDescriptor, "value") ||
        idDescriptor.enumerable !== true ||
        typeof idDescriptor.value !== "string"
      ) return null;
      const id = idDescriptor.value;
      if (!ENTITY_SCOPE_ID_PATTERN.test(id) || seen.has(id)) return null;
      seen.add(id);
      ids.push(id);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= matches.length) return null;
    }
    return Object.freeze(ids.sort());
  } catch {
    return null;
  }
}

function unavailable(
  reason: Extract<HoidConversationGatewayResult, { status: "unavailable" }>["reason"],
): HoidConversationGatewayResult {
  return Object.freeze({ status: "unavailable", reason });
}

function unavailableReadingContext(
  reason: Extract<HoidConversationReadingContextResult, { status: "unavailable" }>["reason"],
): HoidConversationReadingContextResult {
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
  context: HoidCursorReadingContext,
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

  const started = new Set(context.positions.map(position => position.bookId));
  const seen = new Set<string>();
  const catalog = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title]));
  const catalogOrder = new Map(HOID_SOURCE_BIBLIOGRAPHY.map((work, index) => [work.id, index]));
  const activeOrder = new Map(
    context.positions
      .filter(position => position.status === "in-progress")
      .map((position, index) => [position.bookId, index] as const),
  );
  const items: HoidRecommendation[] = [];
  let recommendationPhase: "resume" | "unread" = "resume";
  let lastActiveOrder = -1;
  let lastUnreadCatalogIndex = -1;

  for (const raw of rawItems) {
    const item = canonicalDataRecord(
      raw,
      ["sourceId", "title", "reason", "currentChapter", "completedThroughChapter"],
      ["sourceId", "title", "reason"],
    );
    if (!item) return null;

    const sourceId = item.sourceId;
    const title = item.title;
    if (
      typeof sourceId !== "string" ||
      typeof title !== "string" ||
      !catalog.has(sourceId) ||
      catalog.get(sourceId) !== title ||
      seen.has(sourceId)
    ) return null;

    if (item.reason === "unread-source") {
      if (
        Object.keys(item).length !== 3 ||
        started.has(sourceId)
      ) return null;
      recommendationPhase = "unread";
      const catalogIndex = catalogOrder.get(sourceId);
      if (catalogIndex === undefined || catalogIndex <= lastUnreadCatalogIndex) return null;
      lastUnreadCatalogIndex = catalogIndex;
      seen.add(sourceId);
      items.push(Object.freeze({ sourceId, title, reason: "unread-source" }));
      continue;
    }

    if (item.reason === "resume-current-work") {
      if (recommendationPhase !== "resume") return null;
      const activeIndex = activeOrder.get(sourceId);
      if (activeIndex === undefined || activeIndex <= lastActiveOrder) return null;
      lastActiveOrder = activeIndex;
      const position = context.positions.find(candidate => candidate.bookId === sourceId);
      if (
        Object.keys(item).length !== 5 ||
        !position ||
        position.status !== "in-progress" ||
        typeof item.currentChapter !== "number" ||
        !Number.isSafeInteger(item.currentChapter) ||
        item.currentChapter !== position.currentChapter ||
        !(
          item.completedThroughChapter === null ||
          (typeof item.completedThroughChapter === "number" &&
            Number.isSafeInteger(item.completedThroughChapter))
        ) ||
        item.completedThroughChapter !== position.completedThroughChapter
      ) return null;
      seen.add(sourceId);
      items.push(Object.freeze({
        sourceId,
        title,
        reason: "resume-current-work",
        currentChapter: position.currentChapter,
        completedThroughChapter: position.completedThroughChapter,
      }));
      continue;
    }

    return null;
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

  private invokeWithProgressWatch<T>(
    expected: ProgressIdentity,
    options: HoidRuntimeCallOptions | undefined,
    invoke: (runtimeOptions?: HoidRuntimeCallOptions) => T | Promise<T>,
  ) {
    return invokeWithHoidProgressChangeWatch({
      subscribe: this.config.subscribeToProgressChanges,
      options,
      verifyCurrent: async () => {
        let current: unknown;
        try {
          current = await readCurrentProgress(this.config);
        } catch {
          return "invalid" as const;
        }
        const identity = progressIdentity(current);
        if (!identity) return "invalid" as const;
        return sameProgress(expected, identity) ? "current" as const : "changed" as const;
      },
      invoke,
    });
  }

  async answer(input: unknown, options?: HoidRuntimeCallOptions): Promise<HoidConversationGatewayResult> {
    if (callerAborted(options)) return unavailable("cancelled");
    const request = canonicalRequest(input);
    if (!request) return unavailable("invalid-request");

    const requestedProgress = progressIdentity(request.progress);
    if (!requestedProgress) return unavailable("invalid-progress");

    let currentBefore: unknown;
    try {
      currentBefore = await readCurrentProgress(this.config);
    } catch {
      return unavailable("invalid-progress");
    }

    if (callerAborted(options)) return unavailable("cancelled");
    const beforeIdentity = progressIdentity(currentBefore);
    if (!beforeIdentity) return unavailable("invalid-progress");
    if (!sameProgress(requestedProgress, beforeIdentity)) {
      return unavailable("progress-changed");
    }

    const activeScopeResolution = resolveActiveConversationScope(request, request.progress);
    if (activeScopeResolution.status !== "ready") return unavailable(activeScopeResolution.reason);
    const activeBookScope = activeScopeResolution.scope;
    const inheritedScopeBinding = activeScopeResolution.binding;

    const typedFollowUp = resolveHoidTypedEntityFollowUp(
      request.question,
      request.typedContext,
      requestedProgress,
    );
    if (typedFollowUp.status === "unavailable") {
      if (typedFollowUp.reason === "stale-context") return unavailable("context-stale");
      if (typedFollowUp.reason === "invalid-progress") return unavailable("invalid-progress");
      if (typedFollowUp.reason === "invalid-question") return unavailable("invalid-request");
      if (typedFollowUp.reason === "ambiguous-reference") return unavailable("context-ambiguous");
      return unavailable("context-unavailable");
    }
    if (typedFollowUp.status === "resolved") {
      const resolveEntityIds = this.config.resolveEntityIds ?? resolveProductionHoidEntityIds;
      if (!reauthorizeTypedContext(request.progress, typedFollowUp.context, requestedProgress, resolveEntityIds)) {
        return unavailable("context-unavailable");
      }
      const followUpScope = resolveFollowUpScope(request, request.progress);
      if (followUpScope.status !== "ready") return unavailable(followUpScope.reason);
      const effectiveBookScope = followUpScope.scope;

      let answer: HoidEvidenceAnswer;
      try {
        // Only the single, live-reauthorized target ID and the prior evidence scope
        // cross the strict runtime boundary; names and prior prose remain local.
        const invocation = await this.invokeWithProgressWatch(
          requestedProgress,
          options,
          runtimeOptions => this.config.runtime.answer({
            question: request.question,
            progress: request.progress,
            intent: request.intent,
            selectionBudget: request.selectionBudget,
            entityIds: [typedFollowUp.entityId],
            bookScope: effectiveBookScope,
          }, runtimeOptions),
        );
        if (invocation.status === "cancelled") return unavailable("cancelled");
        if (invocation.status === "unavailable") return unavailable("invalid-progress");
        if (invocation.status === "failed") {
          return unavailable(invocation.progressChanged ? "progress-changed" : "runtime-failed");
        }
        if (invocation.progressChanged) return unavailable("progress-changed");
        answer = invocation.value;
      } catch {
        return unavailable("runtime-failed");
      }

      let currentAfterTypedFollowUp: unknown;
      try {
        currentAfterTypedFollowUp = await readCurrentProgress(this.config);
      } catch {
        return unavailable("invalid-progress");
      }
      if (callerAborted(options)) return unavailable("cancelled");
      const afterTypedIdentity = progressIdentity(currentAfterTypedFollowUp);
      if (!afterTypedIdentity) return unavailable("invalid-progress");
      if (!sameProgress(requestedProgress, afterTypedIdentity)) return unavailable("progress-changed");

      const scopeBinding = createHoidConversationScopeBinding(answer, request.progress, effectiveBookScope) ?? inheritedScopeBinding;
      const priorRelationship = validateHoidConversationContext(request.context, requestedProgress);
      const conversationContext = scopeBinding && priorRelationship.status === "resolved"
        ? createHoidConversationContext(priorRelationship.entityIds, requestedProgress) ?? undefined
        : undefined;
      return Object.freeze({
        status: "ready",
        answer,
        depth: request.depth,
        ...(conversationContext ? { conversationContext } : {}),
        ...(scopeBinding ? {
          typedConversationContext: typedFollowUp.context,
          conversationScopeBinding: scopeBinding,
        } : {}),
        progressRevision: requestedProgress.revision,
        progressFingerprint: requestedProgress.fingerprint,
      });
    }

    const coreference = (this.config.resolveCoreference ?? resolveProductionHoidCoreference)(
      request.question,
      request.context,
      request.progress,
    );
    if (coreference.status === "unavailable") {
      if (
        coreference.reason === "ambiguous-reference" ||
        coreference.reason === "reference-unavailable" ||
        coreference.reason === "entity-unavailable"
      ) return unavailable("context-ambiguous");
      if (coreference.reason === "stale-context") return unavailable("context-stale");
      if (coreference.reason === "invalid-progress") return unavailable("invalid-progress");
      if (coreference.reason === "invalid-question") return unavailable("invalid-request");
      return unavailable("context-unavailable");
    }
    if (
      coreference.status === "resolved" &&
      (
        coreference.progressRevision !== requestedProgress.revision ||
        coreference.progressFingerprint !== requestedProgress.fingerprint
      )
    ) return unavailable("invalid-progress");

    const relationshipQuestion = isHoidRelationshipQuestion(request.question);
    if (
      coreference.status === "resolved" &&
      relationshipQuestion &&
      coreference.context.entityIds.length !== 2
    ) return unavailable("context-ambiguous");

    const followUp = coreference.status === "resolved"
      ? relationshipQuestion
        ? Object.freeze({ status: "resolved" as const, entityIds: coreference.context.entityIds })
        : Object.freeze({ status: "not-follow-up" as const })
      : resolveHoidConversationFollowUp(
          request.question,
          request.context,
          requestedProgress,
        );
    if (followUp.status === "unavailable") {
      if (followUp.reason === "ambiguous-reference") return unavailable("context-ambiguous");
      if (followUp.reason === "stale-context") return unavailable("context-stale");
      if (followUp.reason === "invalid-progress") return unavailable("invalid-progress");
      if (followUp.reason === "invalid-question") return unavailable("invalid-request");
      return unavailable("context-unavailable");
    }

    // Every recognized group follow-up is constrained to the exact work set
    // established by the preceding authorized answer, even in automatic UI mode.
    if (followUp.status === "resolved") {
      const followUpScope = resolveFollowUpScope(request, request.progress);
      if (followUpScope.status !== "ready") return unavailable(followUpScope.reason);
      const effectiveBookScope = followUpScope.scope;
      let answer: HoidEvidenceAnswer;
      try {
        const invocation = await this.invokeWithProgressWatch(
          requestedProgress,
          options,
          runtimeOptions => this.config.runtime.answer({
            question: request.question,
            progress: request.progress,
            intent: request.intent,
            selectionBudget: request.selectionBudget,
            entityIds: followUp.entityIds,
            bookScope: effectiveBookScope,
          }, runtimeOptions),
        );
        if (invocation.status === "cancelled") return unavailable("cancelled");
        if (invocation.status === "unavailable") return unavailable("invalid-progress");
        if (invocation.status === "failed") {
          return unavailable(invocation.progressChanged ? "progress-changed" : "runtime-failed");
        }
        if (invocation.progressChanged) return unavailable("progress-changed");
        answer = invocation.value;
      } catch {
        return unavailable("runtime-failed");
      }

      let currentAfterScopedFollowUp: unknown;
      try {
        currentAfterScopedFollowUp = await readCurrentProgress(this.config);
      } catch {
        return unavailable("invalid-progress");
      }
      if (callerAborted(options)) return unavailable("cancelled");
      const afterScopedIdentity = progressIdentity(currentAfterScopedFollowUp);
      if (!afterScopedIdentity) return unavailable("invalid-progress");
      if (!sameProgress(requestedProgress, afterScopedIdentity)) return unavailable("progress-changed");

      const scopeBinding = createHoidConversationScopeBinding(answer, request.progress, effectiveBookScope) ?? inheritedScopeBinding;
      const conversationContext = scopeBinding
        ? createHoidConversationContext(followUp.entityIds, requestedProgress)
        : null;
      const resolveEntityIds = this.config.resolveEntityIds ?? resolveProductionHoidEntityIds;
      const typedConversationContext = scopeBinding
        ? buildTypedContextFromIds(
            request.progress,
            followUp.entityIds,
            requestedProgress,
            resolveEntityIds,
          )
        : null;
      return Object.freeze({
        status: "ready",
        answer,
        depth: request.depth,
        ...(conversationContext ? { conversationContext } : {}),
        ...(typedConversationContext ? { typedConversationContext } : {}),
        ...(scopeBinding ? { conversationScopeBinding: scopeBinding } : {}),
        progressRevision: requestedProgress.revision,
        progressFingerprint: requestedProgress.fingerprint,
      });
    }

    // A new, explicitly named relationship question may use the local reviewed
    // graph when no scope was selected. Recognized follow-ups have already returned
    // through the evidence-bound runtime path above and cannot reach this shortcut.
    if (relationshipQuestion && !activeBookScope) {
      const relationshipGateway = this.config.relationshipGateway;
      if (!relationshipGateway) return unavailable("entity-unavailable");

      let relationshipResult: HoidRelationshipGatewayResult;
      try {
        relationshipResult = relationshipGateway.answer({
          question: request.question,
          progress: request.progress,
        });
      } catch {
        return unavailable("entity-unavailable");
      }

      if (relationshipResult.status === "unavailable") {
        if (relationshipResult.reason === "progress-changed") return unavailable("progress-changed");
        if (relationshipResult.reason === "invalid-progress") return unavailable("invalid-progress");
        if (relationshipResult.reason === "entity-blocked") return unavailable("entity-blocked");
        if (relationshipResult.reason === "entity-ambiguous") return unavailable("entity-ambiguous");
        return unavailable("entity-unavailable");
      }
      if (relationshipResult.status === "no-path") return unavailable("entity-unavailable");
      if (
        relationshipResult.progressRevision !== requestedProgress.revision ||
        relationshipResult.progressFingerprint !== requestedProgress.fingerprint
      ) return unavailable("invalid-progress");

      const relationshipAnswer = createHoidEvidenceAnswerFromRelationshipResult(
        {
          status: relationshipResult.status,
          explanation: relationshipResult.explanation,
          progressRevision: relationshipResult.progressRevision,
          progressFingerprint: relationshipResult.progressFingerprint,
        },
        request.progress,
      );
      if (!relationshipAnswer) return unavailable("entity-unavailable");

      let currentAfterRelationship: unknown;
      try {
        currentAfterRelationship = await readCurrentProgress(this.config);
      } catch {
        return unavailable("invalid-progress");
      }
      if (callerAborted(options)) return unavailable("cancelled");
      const afterRelationshipIdentity = progressIdentity(currentAfterRelationship);
      if (!afterRelationshipIdentity) return unavailable("invalid-progress");
      if (!sameProgress(requestedProgress, afterRelationshipIdentity)) {
        return unavailable("progress-changed");
      }

      const scopeBinding = createHoidConversationScopeBinding(relationshipAnswer, request.progress);
      const conversationContext = scopeBinding
        ? createHoidConversationContext(relationshipResult.entityIds, requestedProgress)
        : null;
      const resolveEntityIds = this.config.resolveEntityIds ?? resolveProductionHoidEntityIds;
      const typedConversationContext = scopeBinding
        ? buildTypedContextFromIds(
            request.progress,
            relationshipResult.entityIds,
            requestedProgress,
            resolveEntityIds,
          )
        : null;

      return Object.freeze({
        status: "ready",
        answer: relationshipAnswer,
        depth: request.depth,
        ...(conversationContext ? { conversationContext } : {}),
        ...(typedConversationContext ? { typedConversationContext } : {}),
        ...(scopeBinding ? { conversationScopeBinding: scopeBinding } : {}),
        progressRevision: requestedProgress.revision,
        progressFingerprint: requestedProgress.fingerprint,
      });
    }

    if (coreference.status === "resolved") {
      const followUpScope = resolveFollowUpScope(request, request.progress);
      if (followUpScope.status !== "ready") return unavailable(followUpScope.reason);
      const effectiveBookScope = followUpScope.scope;
      let answer: HoidEvidenceAnswer;
      try {
        // Preserve the original question but constrain evidence retrieval to
        // the exact works authorized by the previous answer.
        const invocation = await this.invokeWithProgressWatch(
          requestedProgress,
          options,
          runtimeOptions => this.config.runtime.answer({
            question: request.question,
            progress: request.progress,
            intent: request.intent,
            selectionBudget: request.selectionBudget,
            entityIds: [coreference.entityId],
            bookScope: effectiveBookScope,
          }, runtimeOptions),
        );
        if (invocation.status === "cancelled") return unavailable("cancelled");
        if (invocation.status === "unavailable") return unavailable("invalid-progress");
        if (invocation.status === "failed") {
          return unavailable(invocation.progressChanged ? "progress-changed" : "runtime-failed");
        }
        if (invocation.progressChanged) return unavailable("progress-changed");
        answer = invocation.value;
      } catch {
        return unavailable("runtime-failed");
      }

      let currentAfterCoreference: unknown;
      try {
        currentAfterCoreference = await readCurrentProgress(this.config);
      } catch {
        return unavailable("invalid-progress");
      }
      if (callerAborted(options)) return unavailable("cancelled");
      const afterCoreferenceIdentity = progressIdentity(currentAfterCoreference);
      if (!afterCoreferenceIdentity) return unavailable("invalid-progress");
      if (!sameProgress(requestedProgress, afterCoreferenceIdentity)) {
        return unavailable("progress-changed");
      }

      const scopeBinding = createHoidConversationScopeBinding(answer, request.progress, effectiveBookScope) ?? inheritedScopeBinding;
      const resolveEntityIds = this.config.resolveEntityIds ?? resolveProductionHoidEntityIds;
      const typedConversationContext = scopeBinding
        ? buildTypedContextFromIds(
            request.progress,
            coreference.context.entityIds,
            requestedProgress,
            resolveEntityIds,
          )
        : null;
      return Object.freeze({
        status: "ready",
        answer,
        depth: request.depth,
        ...(scopeBinding ? {
          conversationContext: coreference.context,
          conversationScopeBinding: scopeBinding,
        } : {}),
        ...(typedConversationContext ? { typedConversationContext } : {}),
        progressRevision: requestedProgress.revision,
        progressFingerprint: requestedProgress.fingerprint,
      });
    }

    // Resolve every known alias mentioned in the natural-language question
    // before the evidence runtime can select claims. A known but locked alias,
    // or an alias without its own approved disclosure record, blocks the whole
    // question with an opaque result. Unknown text remains indistinguishable
    // from an absent alias and cannot create knowledge.
    let entityResolution: HoidEntityMentionResolutionResult;
    try {
      entityResolution = (this.config.resolveEntities ?? resolveProductionHoidEntityMentions)(
        request.progress,
        request.question,
      );
    } catch {
      return unavailable("entity-unavailable");
    }
    if (entityResolution.status === "unavailable") {
      return unavailable("entity-unavailable");
    }
    if (entityResolution.status === "blocked") {
      return unavailable("entity-blocked");
    }
    if (entityResolution.resolution === "ambiguous") {
      return unavailable("entity-ambiguous");
    }
    if (
      entityResolution.progressRevision !== requestedProgress.revision ||
      entityResolution.progressFingerprint !== requestedProgress.fingerprint
    ) {
      return unavailable("invalid-progress");
    }
    const resolvedEntityIds = canonicalMatchedEntityIds(entityResolution);
    if (!resolvedEntityIds) return unavailable("entity-unavailable");
    const entityIds = resolvedEntityIds.length > 0 ? resolvedEntityIds : undefined;

    let answer: HoidEvidenceAnswer;
    try {
      const invocation = await this.invokeWithProgressWatch(
          requestedProgress,
          options,
          runtimeOptions => this.config.runtime.answer({
        question: request.question,
        progress: request.progress,
        intent: request.intent,
        selectionBudget: request.selectionBudget,
        ...(entityIds === undefined ? {} : { entityIds }),
        ...(activeBookScope ? { bookScope: activeBookScope } : {}),
      }, runtimeOptions),
        );
        if (invocation.status === "cancelled") return unavailable("cancelled");
        if (invocation.status === "unavailable") return unavailable("invalid-progress");
        if (invocation.status === "failed") {
          return unavailable(invocation.progressChanged ? "progress-changed" : "runtime-failed");
        }
        if (invocation.progressChanged) return unavailable("progress-changed");
        answer = invocation.value;
    } catch {
      return unavailable("runtime-failed");
    }

    let currentAfter: unknown;
    try {
      currentAfter = await readCurrentProgress(this.config);
    } catch {
      return unavailable("invalid-progress");
    }

    if (callerAborted(options)) return unavailable("cancelled");
    const afterIdentity = progressIdentity(currentAfter);
    if (!afterIdentity) return unavailable("invalid-progress");
    if (!sameProgress(requestedProgress, afterIdentity)) {
      return unavailable("progress-changed");
    }

    const scopeBinding = createHoidConversationScopeBinding(answer, request.progress, activeBookScope) ?? inheritedScopeBinding;
    const conversationContext = scopeBinding && entityIds && entityIds.length >= 2 && entityIds.length <= 4
      ? createHoidConversationContext(entityIds, requestedProgress)
      : null;
    const resolveEntityIds = this.config.resolveEntityIds ?? resolveProductionHoidEntityIds;
    const typedConversationContext = scopeBinding && entityIds && entityIds.length >= 2 && entityIds.length <= 4
      ? buildTypedContextFromIds(request.progress, entityIds, requestedProgress, resolveEntityIds)
      : null;
    return Object.freeze({
      status: "ready",
      answer,
      depth: request.depth,
      ...(conversationContext ? { conversationContext } : {}),
      ...(typedConversationContext ? { typedConversationContext } : {}),
      ...(scopeBinding ? { conversationScopeBinding: scopeBinding } : {}),
      progressRevision: requestedProgress.revision,
      progressFingerprint: requestedProgress.fingerprint,
    });
  }

  async readingContext(input: unknown): Promise<HoidConversationReadingContextResult> {
    const request = canonicalContextRequest(input);
    if (!request) return unavailableReadingContext("invalid-request");

    const requestedProgress = progressIdentity(request.progress);
    if (!requestedProgress) return unavailableReadingContext("invalid-progress");

    let currentBefore: unknown;
    try {
      currentBefore = await readCurrentProgress(this.config);
    } catch {
      return unavailableReadingContext("invalid-progress");
    }
    const beforeIdentity = progressIdentity(currentBefore);
    if (!beforeIdentity) return unavailableReadingContext("invalid-progress");
    if (!sameProgress(requestedProgress, beforeIdentity)) {
      return unavailableReadingContext("progress-changed");
    }

    const built = buildHoidCursorReadingContext(request.progress);
    if (built.status !== "ready") {
      return unavailableReadingContext("invalid-progress");
    }

    let currentAfter: unknown;
    try {
      currentAfter = await readCurrentProgress(this.config);
    } catch {
      return unavailableReadingContext("invalid-progress");
    }
    const afterIdentity = progressIdentity(currentAfter);
    if (!afterIdentity) return unavailableReadingContext("invalid-progress");
    if (!sameProgress(requestedProgress, afterIdentity)) {
      return unavailableReadingContext("progress-changed");
    }

    return Object.freeze({
      status: "ready",
      context: built.context,
      progressRevision: requestedProgress.revision,
      progressFingerprint: requestedProgress.fingerprint,
    });
  }

  async recommend(input: unknown, options?: HoidRuntimeCallOptions): Promise<HoidConversationRecommendationResult> {
    if (callerAborted(options)) return unavailableRecommendation("cancelled");
    const request = canonicalRecommendationRequest(input);
    if (!request) return unavailableRecommendation("invalid-request");

    const requestProjection = projectHoidCursorProgressSnapshot(request.progress);
    if (requestProjection.status !== "ready") {
      return unavailableRecommendation("invalid-progress");
    }
    const readingContext = buildHoidCursorReadingContext(request.progress);
    if (readingContext.status !== "ready") {
      return unavailableRecommendation("invalid-progress");
    }
    const requestedProgress = Object.freeze({
      revision: requestProjection.revision,
      fingerprint: fingerprintHoidCursorProgressProjection(requestProjection),
    });

    let currentBefore: unknown;
    try {
      currentBefore = await readCurrentProgress(this.config);
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

    const invocation = await this.invokeWithProgressWatch(
      requestedProgress,
      options,
      runtimeOptions => recommend.call(this.config.runtime, request.progress, request.limit, runtimeOptions),
    );
    if (invocation.status === "cancelled") return unavailableRecommendation("cancelled");
    if (invocation.status === "unavailable") return unavailableRecommendation("invalid-progress");
    if (invocation.status === "failed") {
      return unavailableRecommendation(invocation.progressChanged ? "progress-changed" : "runtime-failed");
    }
    if (invocation.progressChanged) return unavailableRecommendation("progress-changed");
    const rawResult = invocation.value;

    let currentAfter: unknown;
    try {
      currentAfter = await readCurrentProgress(this.config);
    } catch {
      return unavailableRecommendation("invalid-progress");
    }
    if (callerAborted(options)) return unavailableRecommendation("cancelled");
    const afterIdentity = progressIdentity(currentAfter);
    if (!afterIdentity) return unavailableRecommendation("invalid-progress");
    if (!sameProgress(requestedProgress, afterIdentity)) {
      return unavailableRecommendation("progress-changed");
    }

    const parsed = canonicalRecommendationResult(
      rawResult,
      request.limit,
      readingContext.context,
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
    typeof config.getCurrentProgress !== "function" ||
    (config.refreshCurrentProgress !== undefined && typeof config.refreshCurrentProgress !== "function") ||
    (config.subscribeToProgressChanges !== undefined && typeof config.subscribeToProgressChanges !== "function")
  ) return null;
  const relationshipGateway = config.relationshipGateway === undefined
    ? (() => {
        const explanationGateway = createProductionHoidExplanationGateway(config.getCurrentProgress);
        return explanationGateway
          ? createHoidRelationshipGateway({
              getCurrentProgress: config.getCurrentProgress,
              explanationGateway,
              ...(config.resolveEntities ? { resolveEntities: config.resolveEntities } : {}),
            })
          : null;
      })()
    : config.relationshipGateway;
  return new HoidConversationGateway({ ...config, relationshipGateway });
}
