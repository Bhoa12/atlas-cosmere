import { canonicalizeHoidAnswerBookScope, type HoidAnswerBookScope } from "./answerScope";
import { isKnownHoidSource } from "./bibliography";
import type { HoidChapterReference } from "./chapterReference";
import { isHoidExplanationDepth, type HoidExplanationDepth } from "./explanationDepth";
import type { HoidExactEvidenceAnswer, HoidExactRuntimeCallOptions } from "./exactUnitEvidenceRuntime";
import { validHoidQuestion } from "./requestValidation";
import { sha256Hex } from "./sha256";
import type {
  HoidPreparedExactUnitAnswer,
  HoidTrustedAnswerBlockReason,
  HoidTrustedAnswerPrepareResult,
  HoidTrustedAnswerPresentationResult,
  HoidTrustedPresentationPermit,
  HoidTrustedScreenAnswerPort,
} from "./trustedExactUnitAnswerHost";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";
import { validateHoidUnitProgressSnapshot, type HoidUnitProgressSnapshot } from "./unitProgressLedger";

export type HoidConversationIntentV3 = "explain" | "recommend" | "context";
export type HoidConversationTurnInputV3 = Readonly<{
  question: string;
  intent: HoidConversationIntentV3;
  depth?: HoidExplanationDepth;
  entityIds?: readonly string[];
  bookScope?: HoidAnswerBookScope;
}>;
export type HoidConversationAnswerSinkV3 = Readonly<{
  present(turnId: string, answer: HoidExactEvidenceAnswer, permit: HoidTrustedPresentationPermit): void;
  clear(turnId: string, reason: HoidTrustedAnswerBlockReason): void;
}>;

export interface HoidTrustedConversationHostPortV3 {
  prepare(request: unknown, options?: HoidExactRuntimeCallOptions): Promise<HoidTrustedAnswerPrepareResult>;
  present(prepared: HoidPreparedExactUnitAnswer, sink: HoidTrustedScreenAnswerPort): Promise<HoidTrustedAnswerPresentationResult>;
  cancel(prepared: HoidPreparedExactUnitAnswer): void;
  clearSink(sink: HoidTrustedScreenAnswerPort, reason?: HoidTrustedAnswerBlockReason): void;
}
export interface HoidConversationProgressInvalidationPortV3 {
  subscribe(listener: () => void): () => void;
}
export type HoidConversationReadingPositionV3 =
  | Readonly<{ bookId: string; status: "reading"; chapterNumber: number; ordinal: number; unitId: string; identityFingerprint: string }>
  | Readonly<{ bookId: string; status: "completed" }>;
export type HoidConversationSourceReferenceV3 = Readonly<{
  evidenceId: string;
  source: HoidChapterReference;
  firstSafeAppearance: HoidChapterReference;
  unlock: HoidChapterReference;
}>;

/** Local-only context. Exact chapter references and progress stamps never reach provider egress. */
export type HoidConversationLocalContextV3 = Readonly<{
  turnId: string;
  lastQuestion: string;
  intent: HoidConversationIntentV3;
  depth: HoidExplanationDepth;
  progressRevision: number;
  progressFingerprint: string;
  claimIds: readonly string[];
  evidenceIds: readonly string[];
  entityIds: readonly string[];
  bookIds: readonly string[];
  sourceReferences: readonly HoidConversationSourceReferenceV3[];
  readingPositions: readonly HoidConversationReadingPositionV3[];
}>;

export type HoidTrustedConversationResultV3 =
  | Readonly<{ status: "presented"; turnId: string; registryRevision: number; progressRevision: number;
      context: Readonly<{ claimCount: number; entityCount: number; workCount: number }> }>
  | Readonly<{ status: "blocked"; reason: "invalid-session" | "invalid-request" | "progress-unavailable" | "progress-changed" | "host-blocked";
      hostReason?: HoidTrustedAnswerBlockReason }>
  | Readonly<{ status: "needs-clarification"; reason: "ambiguous-entity" | "missing-follow-up-context" }>
  | Readonly<{ status: "cancelled"; turnId: string }>;

type CanonicalTurn = Readonly<{
  question: string; intent: HoidConversationIntentV3; depth: HoidExplanationDepth;
  entityIds: readonly string[]; bookScope?: HoidAnswerBookScope;
}>;
type ProgressRead = Readonly<{ snapshot: HoidUnitProgressSnapshot; fingerprint: string }>;
type ReferenceResolution =
  | Readonly<{ status: "resolved"; entityIds: readonly string[]; bookScope?: HoidAnswerBookScope; usePreviousContext: boolean }>
  | Readonly<{ status: "ambiguous"; reason: "ambiguous-entity" | "missing-follow-up-context" }>;
type SessionConfig = Readonly<{
  sessionId: string;
  host: HoidTrustedConversationHostPortV3;
  coordinator: HoidUnitProgressCoordinator;
  progressInvalidation: HoidConversationProgressInvalidationPortV3;
  sink: HoidConversationAnswerSinkV3;
}>;

const SESSION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/u;
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const INTENTS = new Set<HoidConversationIntentV3>(["explain", "recommend", "context"]);
const INPUT_KEYS = new Set(["question", "intent", "depth", "entityIds", "bookScope"]);
const MAX_ENTITY_IDS = 8;
const MAX_CONTEXT_BOOKS = 4;
const MAX_CONTEXT_CLAIMS = 12;

function exactRecord(value: unknown, allowed: ReadonlySet<string>, required: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    if (required.some(key => !Object.prototype.hasOwnProperty.call(result, key))) return null;
    return result;
  } catch { return null; }
}
function canonicalIds(value: unknown, maximum: number): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const ids: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true || typeof descriptor.value !== "string") return null;
      const id = descriptor.value;
      if (id !== id.trim() || id.length > 128 || !ID_PATTERN.test(id) || seen.has(id)) return null;
      seen.add(id);
      ids.push(id);
    }
    return Object.freeze(ids.sort());
  } catch { return null; }
}
function canonicalTurn(value: unknown): CanonicalTurn | null {
  const record = exactRecord(value, INPUT_KEYS, ["question", "intent"]);
  if (!record) return null;
  const question = validHoidQuestion(record.question);
  if (!question || typeof record.intent !== "string" || !INTENTS.has(record.intent as HoidConversationIntentV3)) return null;
  const depth = record.depth === undefined ? "brief" : record.depth;
  if (!isHoidExplanationDepth(depth)) return null;
  let entityIds: readonly string[] = Object.freeze([]);
  if (Object.prototype.hasOwnProperty.call(record, "entityIds")) {
    const parsed = canonicalIds(record.entityIds, MAX_ENTITY_IDS);
    if (!parsed) return null;
    entityIds = parsed;
  }
  let bookScope: HoidAnswerBookScope | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "bookScope")) {
    const parsed = canonicalizeHoidAnswerBookScope(record.bookScope);
    if (!parsed) return null;
    bookScope = parsed;
  }
  return Object.freeze({ question, intent: record.intent as HoidConversationIntentV3, depth, entityIds,
    ...(bookScope ? { bookScope } : {}) });
}
function isFollowUpQuestion(question: string): boolean {
  const normalized = question.normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
  return /^(?:y\b|ademas\b|tambien\b|entonces\b|¿?por que\b|¿?como\b|¿?que relacion\b|¿?y si\b)/u.test(normalized) ||
    /\b(ella|ellos|ellas|eso|esa persona|ese personaje|ese concepto|aquello|lo anterior|la anterior|sus motivos|su decision|con el|con ella|he|she|they|them|it|that|those)\b/u.test(normalized);
}
function scopeFromBookIds(bookIds: readonly string[]): HoidAnswerBookScope | undefined {
  const unique = [...new Set(bookIds)].sort();
  if (unique.length < 1 || unique.length > MAX_CONTEXT_BOOKS || !unique.every(isKnownHoidSource)) return undefined;
  return canonicalizeHoidAnswerBookScope({ mode: unique.length === 1 ? "single-work" : "cross-work", bookIds: unique }) ?? undefined;
}
function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
function readingPositions(snapshot: HoidUnitProgressSnapshot): readonly HoidConversationReadingPositionV3[] {
  return Object.freeze(snapshot.positions.map(position => {
    if ("completed" in position) return Object.freeze({ bookId: position.bookId, status: "completed" as const });
    const ref = position.cursor.reference;
    return Object.freeze({ bookId: position.bookId, status: "reading" as const,
      chapterNumber: ref.chapterNumber, ordinal: ref.ordinal, unitId: ref.unitId,
      identityFingerprint: ref.identityFingerprint });
  }));
}
function sourceReferences(answer: HoidExactEvidenceAnswer): readonly HoidConversationSourceReferenceV3[] {
  return Object.freeze(answer.sources.map(item => Object.freeze({
    evidenceId: item.evidenceId, source: item.source,
    firstSafeAppearance: item.firstSafeAppearance, unlock: item.unlock,
  })));
}
function answerBookIds(answer: HoidExactEvidenceAnswer): readonly string[] {
  return Object.freeze([...new Set(answer.sources.flatMap(item => [
    item.source.bookId, item.firstSafeAppearance.bookId, item.unlock.bookId,
  ]))].sort());
}
function progressRead(snapshot: HoidUnitProgressSnapshot): ProgressRead {
  return Object.freeze({ snapshot, fingerprint: sha256Hex(JSON.stringify(snapshot)) });
}

export class HoidTrustedConversationSessionV3 {
  private memory: HoidConversationLocalContextV3 | null = null;
  private activeController: AbortController | null = null;
  private generation = 0;
  private turnSequence = 0;
  private disposed = false;
  private readonly turnSinks = new Set<HoidTrustedScreenAnswerPort>();
  private readonly unsubscribeLocal: () => void;
  private readonly unsubscribeExternal: () => void;

  private constructor(private readonly config: SessionConfig) {
    this.unsubscribeLocal = config.coordinator.subscribe(() => this.invalidate("progress-changed"));
    this.unsubscribeExternal = config.progressInvalidation.subscribe(() => this.invalidate("progress-changed"));
  }
  static create(config: SessionConfig): HoidTrustedConversationSessionV3 | null {
    if (!SESSION_ID_PATTERN.test(config.sessionId) ||
      typeof config.host?.prepare !== "function" || typeof config.host?.present !== "function" ||
      typeof config.host?.cancel !== "function" || typeof config.host?.clearSink !== "function" ||
      typeof config.coordinator?.refresh !== "function" ||
      typeof config.progressInvalidation?.subscribe !== "function" ||
      typeof config.sink?.present !== "function" || typeof config.sink?.clear !== "function") return null;
    try { return new HoidTrustedConversationSessionV3(config); } catch { return null; }
  }
  getContextSnapshot(): HoidConversationLocalContextV3 | null { return this.memory; }
  resetContext(): void { this.memory = null; }

  private invalidate(reason: HoidTrustedAnswerBlockReason): void {
    if (this.disposed) return;
    this.generation += 1;
    this.memory = null;
    this.activeController?.abort();
    this.activeController = null;
    for (const sink of [...this.turnSinks]) this.config.host.clearSink(sink, reason);
    this.turnSinks.clear();
  }
  private async readProgress(): Promise<ProgressRead | null> {
    try {
      const refreshed = await this.config.coordinator.refresh();
      if (refreshed.status !== "ready") return null;
      const validation = validateHoidUnitProgressSnapshot(refreshed.snapshot);
      return validation.status === "valid" ? progressRead(validation.snapshot) : null;
    } catch { return null; }
  }
  private resolveReferences(turn: CanonicalTurn, previous: HoidConversationLocalContextV3 | null): ReferenceResolution {
    if (turn.entityIds.length > 0) {
      const samePreviousEntities = previous !== null && sameIds(turn.entityIds, previous.entityIds);
      return Object.freeze({
        status: "resolved", entityIds: turn.entityIds,
        ...(turn.bookScope ? { bookScope: turn.bookScope } :
          samePreviousEntities ? { bookScope: scopeFromBookIds(previous!.bookIds) } : {}),
        usePreviousContext: samePreviousEntities && previous!.claimIds.length > 0,
      });
    }
    if (turn.bookScope && !isFollowUpQuestion(turn.question)) {
      return Object.freeze({ status: "resolved", entityIds: Object.freeze([]), bookScope: turn.bookScope, usePreviousContext: false });
    }
    if (!isFollowUpQuestion(turn.question)) {
      return Object.freeze({ status: "resolved", entityIds: Object.freeze([]), usePreviousContext: false });
    }
    if (!previous || previous.claimIds.length === 0) {
      return Object.freeze({ status: "ambiguous", reason: "missing-follow-up-context" });
    }
    if (previous.entityIds.length > 1) return Object.freeze({ status: "ambiguous", reason: "ambiguous-entity" });
    const inheritedScope = turn.bookScope ?? scopeFromBookIds(previous.bookIds);
    if (previous.bookIds.length > 0 && !inheritedScope) {
      return Object.freeze({ status: "ambiguous", reason: "missing-follow-up-context" });
    }
    return Object.freeze({ status: "resolved", entityIds: previous.entityIds,
      ...(inheritedScope ? { bookScope: inheritedScope } : {}), usePreviousContext: true });
  }

  async send(input: unknown, options: HoidExactRuntimeCallOptions = {}): Promise<HoidTrustedConversationResultV3> {
    if (this.disposed) return Object.freeze({ status: "blocked", reason: "invalid-session" });
    const turn = canonicalTurn(input);
    if (!turn) return Object.freeze({ status: "blocked", reason: "invalid-request" });
    this.activeController?.abort();
    const controller = new AbortController();
    this.activeController = controller;
    const generation = ++this.generation;
    const onCallerAbort = () => controller.abort();
    if (options.signal?.aborted) controller.abort();
    options.signal?.addEventListener("abort", onCallerAbort, { once: true });
    let prepared: HoidPreparedExactUnitAnswer | null = null;
    try {
      const before = await this.readProgress();
      if (!before) return Object.freeze({ status: "blocked", reason: "progress-unavailable" });
      if (generation !== this.generation || controller.signal.aborted) {
        return Object.freeze({ status: "cancelled", turnId: `${this.config.sessionId}:${this.turnSequence + 1}` });
      }
      if (this.memory && (this.memory.progressRevision !== before.snapshot.revision ||
        this.memory.progressFingerprint !== before.fingerprint)) this.memory = null;
      const resolved = this.resolveReferences(turn, this.memory);
      if (resolved.status === "ambiguous") return Object.freeze({ status: "needs-clarification", reason: resolved.reason });
      const previous = resolved.usePreviousContext ? this.memory : null;
      const contextualBookIds = previous
        ? previous.bookIds.filter(id => !resolved.bookScope || resolved.bookScope.bookIds.includes(id))
        : [];
      const conversationContext = previous ? Object.freeze({
        schemaVersion: 1 as const,
        priorClaimIds: previous.claimIds.slice(0, MAX_CONTEXT_CLAIMS),
        entityIds: resolved.entityIds,
        bookIds: Object.freeze(contextualBookIds),
      }) : undefined;
      const request = Object.freeze({
        question: turn.question, intent: turn.intent, depth: turn.depth,
        ...(resolved.entityIds.length > 0 ? { entityIds: resolved.entityIds } : {}),
        ...(resolved.bookScope ? { bookScope: resolved.bookScope } : {}),
        ...(conversationContext ? { conversationContext } : {}),
      });
      const preparation = await this.config.host.prepare(request, { signal: controller.signal });
      if (preparation.status !== "prepared") {
        if (generation !== this.generation || controller.signal.aborted) {
          return Object.freeze({ status: "cancelled", turnId: `${this.config.sessionId}:${this.turnSequence + 1}` });
        }
        return Object.freeze({ status: "blocked", reason: "host-blocked", hostReason: preparation.reason });
      }
      prepared = preparation.prepared;
      if (generation !== this.generation || controller.signal.aborted) {
        this.config.host.cancel(prepared);
        return Object.freeze({ status: "cancelled", turnId: `${this.config.sessionId}:${this.turnSequence + 1}` });
      }
      const turnId = `${this.config.sessionId}:${++this.turnSequence}`;
      let delivered: HoidExactEvidenceAnswer | null = null;
      let turnSink: HoidTrustedScreenAnswerPort;
      turnSink = Object.freeze({
        present: (answer: HoidExactEvidenceAnswer, permit: HoidTrustedPresentationPermit) => {
          if (this.disposed || generation !== this.generation || controller.signal.aborted) throw new Error("Stale conversation turn");
          this.config.sink.present(turnId, answer, permit);
          delivered = answer;
        },
        clear: (reason: HoidTrustedAnswerBlockReason) => {
          try { this.config.sink.clear(turnId, reason); }
          finally {
            this.turnSinks.delete(turnSink);
            if (this.memory?.turnId === turnId) this.memory = null;
          }
        },
      });
      this.turnSinks.add(turnSink);
      const presentation = await this.config.host.present(prepared, turnSink);
      prepared = null;
      if (presentation.status !== "presented") {
        this.config.host.clearSink(turnSink, presentation.reason);
        return Object.freeze({ status: "blocked", reason: "host-blocked", hostReason: presentation.reason });
      }
      if (!delivered || generation !== this.generation || controller.signal.aborted) {
        this.config.host.clearSink(turnSink, "progress-changed");
        return Object.freeze({ status: "cancelled", turnId });
      }
      const after = await this.readProgress();
      if (generation !== this.generation || controller.signal.aborted) {
        this.config.host.clearSink(turnSink, "progress-changed");
        return Object.freeze({ status: "cancelled", turnId });
      }
      if (!after || after.snapshot.revision !== before.snapshot.revision || after.fingerprint !== before.fingerprint) {
        this.config.host.clearSink(turnSink, "progress-changed");
        return Object.freeze({ status: "blocked", reason: "progress-changed" });
      }
      const nextMemory: HoidConversationLocalContextV3 = Object.freeze({
        turnId, lastQuestion: turn.question, intent: turn.intent, depth: turn.depth,
        progressRevision: after.snapshot.revision, progressFingerprint: after.fingerprint,
        claimIds: Object.freeze([...delivered.claimIds]),
        evidenceIds: Object.freeze([...delivered.evidenceIds]),
        entityIds: Object.freeze([...delivered.entityIds]),
        bookIds: answerBookIds(delivered),
        sourceReferences: sourceReferences(delivered),
        readingPositions: readingPositions(after.snapshot),
      });
      this.memory = nextMemory;
      return Object.freeze({
        status: "presented", turnId, registryRevision: presentation.registryRevision,
        progressRevision: presentation.progressRevision,
        context: Object.freeze({ claimCount: nextMemory.claimIds.length,
          entityCount: nextMemory.entityIds.length, workCount: nextMemory.bookIds.length }),
      });
    } catch {
      if (prepared) this.config.host.cancel(prepared);
      return controller.signal.aborted
        ? Object.freeze({ status: "cancelled", turnId: `${this.config.sessionId}:${this.turnSequence + 1}` })
        : Object.freeze({ status: "blocked", reason: "host-blocked", hostReason: "answer-unavailable" });
    } finally {
      options.signal?.removeEventListener("abort", onCallerAbort);
      if (this.activeController === controller) this.activeController = null;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.activeController?.abort();
    this.activeController = null;
    this.memory = null;
    this.unsubscribeLocal();
    this.unsubscribeExternal();
    for (const sink of [...this.turnSinks]) this.config.host.clearSink(sink, "invalid-host");
    this.turnSinks.clear();
  }
}

export type HoidTrustedConversationGatewayConfigV3 = Readonly<{
  host: HoidTrustedConversationHostPortV3;
  coordinator: HoidUnitProgressCoordinator;
  progressInvalidation: HoidConversationProgressInvalidationPortV3;
}>;

export class HoidTrustedConversationGatewayV3 {
  constructor(private readonly config: HoidTrustedConversationGatewayConfigV3) {}
  createSession(sessionId: string, sink: HoidConversationAnswerSinkV3): HoidTrustedConversationSessionV3 | null {
    return HoidTrustedConversationSessionV3.create({ ...this.config, sessionId, sink });
  }
}

export function createHoidTrustedConversationGatewayV3(
  config: HoidTrustedConversationGatewayConfigV3,
): HoidTrustedConversationGatewayV3 | null {
  if (!config || typeof config.host?.prepare !== "function" ||
    typeof config.host?.present !== "function" || typeof config.host?.cancel !== "function" ||
    typeof config.host?.clearSink !== "function" ||
    typeof config.coordinator?.refresh !== "function" ||
    typeof config.progressInvalidation?.subscribe !== "function") return null;
  return new HoidTrustedConversationGatewayV3(config);
}
