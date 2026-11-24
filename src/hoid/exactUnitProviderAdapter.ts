import type {
  HoidExactClaimSelectionContext,
  HoidExactClaimSelectionRequest,
  HoidExactClaimSelector,
} from "./exactUnitEvidenceRuntime";
import { isKnownHoidSource } from "./bibliography";

export type HoidExactUnitSelectionTransport = (
  request: HoidExactClaimSelectionRequest,
  context: HoidExactClaimSelectionContext,
) => Promise<unknown>;

export interface HoidExactUnitSelectionAdapter extends HoidExactClaimSelector {}

export type HoidExactProviderSnapshotIssue =
  | "request-shape"
  | "request-version"
  | "request-fields"
  | "request-values"
  | "budget-shape"
  | "budget-values"
  | "candidate-array"
  | "candidate-shape"
  | "candidate-values"
  | "candidate-order"
  | "conversation-context-shape"
  | "conversation-context-values"
  | "conversation-context-order";

export type HoidExactProviderInvocationInspection =
  | Readonly<{ status: "valid"; signal: AbortSignal; aborted: boolean }>
  | Readonly<{ status: "invalid"; issue: "context-shape" | "signal-invalid" }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const REQUEST_V2_KEYS = [
  "schemaVersion", "requestFingerprint", "question", "intent", "candidates", "selectionBudget",
] as const;
const REQUEST_V3_KEYS = [...REQUEST_V2_KEYS, "conversationContext"] as const;
const CANDIDATE_KEYS = ["id", "text", "evidenceIds"] as const;
const BUDGET_KEYS = [
  "maxClaims", "maxEvidence", "maxWorks", "maxCharacters", "minimumWorks",
  "requireSegmentProvenance", "requireCrossWorkSegment",
] as const;
const CONTEXT_KEYS = ["schemaVersion", "priorClaimIds", "entityIds", "bookIds"] as const;
const INTENTS = new Set(["explain", "recommend", "context"]);
const MAX_QUESTION_LENGTH = 4_000;
const MAX_CANDIDATES = 32;
const MAX_CANDIDATE_TEXT_LENGTH = 4_000;
const MAX_EVIDENCE_IDS_PER_CANDIDATE = 16;

type DataRecord = Record<string, unknown>;

function exactFrozenRecord(
  value: unknown,
  expectedKeys: readonly string[],
): DataRecord | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value) || !Object.isFrozen(value)) {
      return null;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== expectedKeys.length) return null;
    const result = Object.create(null) as DataRecord;
    for (const key of keys) {
      if (typeof key !== "string" || !expectedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    if (expectedKeys.some(key => !Object.prototype.hasOwnProperty.call(result, key))) return null;
    return result;
  } catch {
    return null;
  }
}

function frozenDenseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype || !Object.isFrozen(value)) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true) return null;
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function inspectIds(
  value: unknown,
  minimum: number,
  maximum: number,
  requireSorted: boolean,
): "invalid" | "order" | readonly string[] {
  const values = frozenDenseArray(value, minimum, maximum);
  if (!values) return "invalid";
  const ids: string[] = [];
  const seen = new Set<string>();
  let previous: string | null = null;
  for (const item of values) {
    if (typeof item !== "string" || item !== item.trim() || item.length < 1 ||
      item.length > 128 || !ID_PATTERN.test(item) || seen.has(item)) return "invalid";
    if (requireSorted && previous !== null && previous >= item) return "order";
    previous = item;
    seen.add(item);
    ids.push(item);
  }
  return Object.freeze(ids);
}

function validBudget(value: unknown): boolean {
  const budget = exactFrozenRecord(value, BUDGET_KEYS);
  if (!budget) return false;
  return typeof budget.maxClaims === "number" && Number.isSafeInteger(budget.maxClaims) &&
    budget.maxClaims >= 1 && budget.maxClaims <= 12 &&
    typeof budget.maxEvidence === "number" && Number.isSafeInteger(budget.maxEvidence) &&
    budget.maxEvidence >= 1 && budget.maxEvidence <= 16 &&
    typeof budget.maxWorks === "number" && Number.isSafeInteger(budget.maxWorks) &&
    budget.maxWorks >= 1 && budget.maxWorks <= 4 &&
    typeof budget.maxCharacters === "number" && Number.isSafeInteger(budget.maxCharacters) &&
    budget.maxCharacters >= 1 && budget.maxCharacters <= 32_000 &&
    typeof budget.minimumWorks === "number" && Number.isSafeInteger(budget.minimumWorks) &&
    budget.minimumWorks >= 1 && budget.minimumWorks <= budget.maxWorks &&
    typeof budget.requireSegmentProvenance === "boolean" &&
    typeof budget.requireCrossWorkSegment === "boolean" &&
    (!budget.requireCrossWorkSegment ||
      (budget.requireSegmentProvenance && budget.minimumWorks >= 2));
}

function inspectConversationContext(value: unknown): HoidExactProviderSnapshotIssue | null {
  const context = exactFrozenRecord(value, CONTEXT_KEYS);
  if (!context) return "conversation-context-shape";
  if (context.schemaVersion !== 1) return "conversation-context-values";
  const priorClaimIds = inspectIds(context.priorClaimIds, 1, 12, true);
  const entityIds = inspectIds(context.entityIds, 0, 8, true);
  const bookIds = inspectIds(context.bookIds, 0, 4, true);
  if (priorClaimIds === "order" || entityIds === "order" || bookIds === "order") {
    return "conversation-context-order";
  }
  if (priorClaimIds === "invalid" || entityIds === "invalid" || bookIds === "invalid") {
    return "conversation-context-values";
  }
  if (!(bookIds as readonly string[]).every(isKnownHoidSource)) return "conversation-context-values";
  return null;
}

/**
 * Validate the closed, immutable v2/v3 selector snapshot before provider egress.
 * This is a conformance barrier, not an authorization decision: the runtime
 * still validates the returned claim IDs against its local candidate set.
 */
export function inspectHoidExactProviderSelectionSnapshot(
  value: unknown,
): HoidExactProviderSnapshotIssue | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value) || !Object.isFrozen(value)) {
      return "request-shape";
    }
    const versionDescriptor = Object.getOwnPropertyDescriptor(value, "schemaVersion");
    if (!versionDescriptor || !Object.prototype.hasOwnProperty.call(versionDescriptor, "value") ||
      versionDescriptor.enumerable !== true) return "request-shape";
    const version = versionDescriptor.value;
    if (version !== 2 && version !== 3) return "request-version";
    const request = exactFrozenRecord(value, version === 2 ? REQUEST_V2_KEYS : REQUEST_V3_KEYS);
    if (!request) return "request-fields";
    if (typeof request.requestFingerprint !== "string" ||
      !FINGERPRINT_PATTERN.test(request.requestFingerprint) ||
      typeof request.question !== "string" || request.question.length < 1 ||
      request.question.length > MAX_QUESTION_LENGTH || request.question !== request.question.trim() ||
      /[\u0000-\u001f\u007f\p{Cf}]/u.test(request.question) ||
      typeof request.intent !== "string" || !INTENTS.has(request.intent)) return "request-values";
    if (!exactFrozenRecord(request.selectionBudget, BUDGET_KEYS)) return "budget-shape";
    if (!validBudget(request.selectionBudget)) return "budget-values";

    const candidates = frozenDenseArray(request.candidates, 1, MAX_CANDIDATES);
    if (!candidates) return "candidate-array";
    let previousCandidateId: string | null = null;
    const candidateIds = new Set<string>();
    for (const candidateValue of candidates) {
      const candidate = exactFrozenRecord(candidateValue, CANDIDATE_KEYS);
      if (!candidate) return "candidate-shape";
      if (typeof candidate.id !== "string" || candidate.id !== candidate.id.trim() ||
        candidate.id.length < 1 || candidate.id.length > 128 || !ID_PATTERN.test(candidate.id) ||
        candidateIds.has(candidate.id) ||
        typeof candidate.text !== "string" || candidate.text.length < 1 ||
        candidate.text.length > MAX_CANDIDATE_TEXT_LENGTH || candidate.text !== candidate.text.trim() ||
        /[\u0000-\u001f\u007f]/u.test(candidate.text)) return "candidate-values";
      if (previousCandidateId !== null && previousCandidateId >= candidate.id) return "candidate-order";
      previousCandidateId = candidate.id;
      candidateIds.add(candidate.id);
      const evidenceIds = inspectIds(candidate.evidenceIds, 1, MAX_EVIDENCE_IDS_PER_CANDIDATE, false);
      if (evidenceIds === "invalid" || evidenceIds === "order") return "candidate-values";
    }

    if (version === 3) {
      const issue = inspectConversationContext(request.conversationContext);
      if (issue) return issue;
    }
    return null;
  } catch {
    return "request-shape";
  }
}

export function isHoidExactProviderSelectionSnapshot(
  value: unknown,
): value is HoidExactClaimSelectionRequest {
  return inspectHoidExactProviderSelectionSnapshot(value) === null;
}

/** Inspect a frozen invocation record without evaluating caller-defined getters. */
export function inspectHoidExactProviderInvocationContext(
  value: unknown,
): HoidExactProviderInvocationInspection {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value) || !Object.isFrozen(value)) {
      return Object.freeze({ status: "invalid", issue: "context-shape" });
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return Object.freeze({ status: "invalid", issue: "context-shape" });
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 1 || keys[0] !== "signal") {
      return Object.freeze({ status: "invalid", issue: "context-shape" });
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, "signal");
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      descriptor.enumerable !== true) {
      return Object.freeze({ status: "invalid", issue: "context-shape" });
    }
    if (typeof AbortSignal === "undefined") {
      return Object.freeze({ status: "invalid", issue: "signal-invalid" });
    }
    const abortedGetter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")?.get;
    if (typeof abortedGetter !== "function") {
      return Object.freeze({ status: "invalid", issue: "signal-invalid" });
    }
    const aborted = abortedGetter.call(descriptor.value);
    if (typeof aborted !== "boolean") {
      return Object.freeze({ status: "invalid", issue: "signal-invalid" });
    }
    return Object.freeze({
      status: "valid",
      signal: descriptor.value as AbortSignal,
      aborted,
    });
  } catch {
    return Object.freeze({ status: "invalid", issue: "signal-invalid" });
  }
}

function createAbortError(): Error {
  const error = new Error("Hoid exact-unit provider dispatch was cancelled.");
  error.name = "AbortError";
  return error;
}

/**
 * Provider-neutral selector adapter for exact-unit protocol v2/v3.
 * It forwards one immutable snapshot and one per-invocation AbortSignal;
 * it never retries and never interprets provider output as narrative authority.
 */
export function createHoidExactUnitSelectionAdapter(
  transport: HoidExactUnitSelectionTransport,
): HoidExactUnitSelectionAdapter {
  if (typeof transport !== "function") {
    throw new TypeError("A Hoid exact-unit selection transport is required.");
  }
  return Object.freeze({
    selectClaims(
      request: HoidExactClaimSelectionRequest,
      context: HoidExactClaimSelectionContext,
    ): Promise<unknown> {
      return Promise.resolve().then(() => {
        const invocation = inspectHoidExactProviderInvocationContext(context);
        if (invocation.status !== "valid") {
          throw new TypeError("A frozen invocation context with a genuine AbortSignal is required (" +
            invocation.issue + ").");
        }
        if (invocation.aborted) throw createAbortError();
        const issue = inspectHoidExactProviderSelectionSnapshot(request);
        if (issue !== null) {
          throw new TypeError("Only immutable Hoid exact-unit selection snapshots may cross provider egress (" +
            issue + ").");
        }
        return transport(request, Object.freeze({ signal: invocation.signal }));
      });
    },
  });
}
