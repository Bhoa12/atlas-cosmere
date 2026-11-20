import type { HoidClaimSelectionRequest } from "./selectionProtocol";

/**
 * Minimal transport context passed to provider-specific HTTP/SDK code.
 * It deliberately contains no reading progress, permissions or narrative state.
 */
export type HoidClaimSelectionTransportContext = Readonly<{
  signal: AbortSignal;
}>;

export type HoidClaimSelectionTransport = (
  request: HoidClaimSelectionRequest,
  context: HoidClaimSelectionTransportContext,
) => Promise<unknown>;

export interface HoidClaimSelectorAdapter {
  selectClaims(
    request: HoidClaimSelectionRequest,
    context: HoidClaimSelectionTransportContext,
  ): Promise<unknown>;
}

const REQUEST_KEYS = [
  "schemaVersion",
  "requestFingerprint",
  "question",
  "intent",
  "candidates",
  "selectionBudget",
] as const;

const BUDGET_KEYS = [
  "maxClaims",
  "maxEvidence",
  "maxWorks",
  "maxCharacters",
  "minimumWorks",
  "requireSegmentProvenance",
  "requireCrossWorkSegment",
] as const;

const CANDIDATE_KEYS = ["id", "text", "evidenceIds"] as const;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const CLAIM_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const MAX_QUESTION_LENGTH = 4_000;
const MAX_CANDIDATES = 32;
const MAX_CLAIM_TEXT_LENGTH = 4_000;
const MAX_CANDIDATE_EVIDENCE_IDS = 32;

function hasExactFrozenDataProperties(
  value: unknown,
  expectedKeys: readonly string[],
): value is Record<string, unknown> {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      !Object.isFrozen(value)
    ) return false;

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== expectedKeys.length) return false;

    for (const key of keys) {
      if (typeof key !== "string" || !expectedKeys.includes(key)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return false;
    }

    for (const key of expectedKeys) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isFrozenDenseStringArray(value: unknown): value is readonly string[] {
  try {
    if (
      !Array.isArray(value) ||
      !Object.isFrozen(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return false;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return false;

    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string"
      ) return false;
    }

    for (const key of keys) {
      if (key === "length") continue;
      if (
        typeof key !== "string" ||
        !/^(0|[1-9][0-9]*)$/.test(key) ||
        Number(key) >= value.length
      ) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Only protocol-factory snapshots may cross this adapter boundary.
 * Exact keys prevent raw reading/progress fields from being forwarded.
 */
export function isHoidProviderSelectionSnapshot(
  value: unknown,
): value is HoidClaimSelectionRequest {
  if (!hasExactFrozenDataProperties(value, REQUEST_KEYS)) return false;

  const request = value;
  if (
    request.schemaVersion !== 1 ||
    typeof request.requestFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(request.requestFingerprint) ||
    typeof request.question !== "string" ||
    request.question.length < 1 ||
    request.question.length > MAX_QUESTION_LENGTH ||
    request.question !== request.question.trim() ||
    /[\\u0000-\\u001F\\u007F\\p{Cf}]/u.test(request.question) ||
    typeof request.intent !== "string" ||
    !hasExactFrozenDataProperties(request.selectionBudget, BUDGET_KEYS)
  ) return false;

  const budget = request.selectionBudget;
  if (
    typeof budget.maxClaims !== "number" ||
    !Number.isSafeInteger(budget.maxClaims) ||
    budget.maxClaims < 1 ||
    budget.maxClaims > 12 ||
    typeof budget.maxEvidence !== "number" ||
    !Number.isSafeInteger(budget.maxEvidence) ||
    budget.maxEvidence < 1 ||
    budget.maxEvidence > 16 ||
    typeof budget.maxWorks !== "number" ||
    !Number.isSafeInteger(budget.maxWorks) ||
    budget.maxWorks < 1 ||
    budget.maxWorks > 4 ||
    typeof budget.maxCharacters !== "number" ||
    !Number.isSafeInteger(budget.maxCharacters) ||
    budget.maxCharacters < 1 ||
    budget.maxCharacters > 32_000 ||
    typeof budget.minimumWorks !== "number" ||
    !Number.isSafeInteger(budget.minimumWorks) ||
    budget.minimumWorks < 1 ||
    budget.minimumWorks > budget.maxWorks ||
    typeof budget.requireSegmentProvenance !== "boolean" ||
    typeof budget.requireCrossWorkSegment !== "boolean" ||
    (budget.requireCrossWorkSegment && !budget.requireSegmentProvenance)
  ) return false;

  const candidates = request.candidates;
  if (
    !Array.isArray(candidates) ||
    candidates.length < 1 ||
    candidates.length > MAX_CANDIDATES ||
    !Object.isFrozen(candidates) ||
    Object.getPrototypeOf(candidates) !== Array.prototype
  ) return false;

  const candidateKeys = Reflect.ownKeys(candidates);
  if (candidateKeys.length !== candidates.length + 1 || !candidateKeys.includes("length")) return false;

  const seen = new Set<string>();
  for (let index = 0; index < candidates.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(candidates, String(index));
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) return false;
    const candidate = descriptor.value;
    if (!hasExactFrozenDataProperties(candidate, CANDIDATE_KEYS)) return false;

    if (
      typeof candidate.id !== "string" ||
      !CLAIM_ID_PATTERN.test(candidate.id) ||
      seen.has(candidate.id) ||
      typeof candidate.text !== "string" ||
      candidate.text.length < 1 ||
      candidate.text.length > MAX_CLAIM_TEXT_LENGTH ||
      !isFrozenDenseUniqueEvidenceArray(candidate.evidenceIds)
    ) return false;
    seen.add(candidate.id);
  }

  for (const key of candidateKeys) {
    if (key === "length") continue;
    if (
      typeof key !== "string" ||
      !/^(0|[1-9][0-9]*)$/.test(key) ||
      Number(key) >= candidates.length
    ) return false;
  }

  return true;
}

function isFrozenDenseUniqueEvidenceArray(value: unknown): value is readonly string[] {
  if (!isFrozenDenseStringArray(value) || value.length < 1 || value.length > MAX_CANDIDATE_EVIDENCE_IDS) {
    return false;
  }
  const seen = new Set<string>();
  for (const id of value) {
    if (!CLAIM_ID_PATTERN.test(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}

function createAbortError(): Error {
  const error = new Error("Hoid provider dispatch was cancelled.");
  error.name = "AbortError";
  return error;
}

/**
 * Provider-neutral adapter factory.
 *
 * It validates the immutable, closed selection snapshot and re-checks the
 * invocation signal in the dispatch microtask. Provider-specific transports
 * receive only that snapshot plus the per-call AbortSignal.
 */
export function createHoidClaimSelectorAdapter(
  transport: HoidClaimSelectionTransport,
): HoidClaimSelectorAdapter {
  if (typeof transport !== "function") {
    throw new TypeError("A Hoid claim-selection transport is required.");
  }

  return Object.freeze({
    selectClaims(
      request: HoidClaimSelectionRequest,
      context: HoidClaimSelectionTransportContext,
    ): Promise<unknown> {
      return Promise.resolve().then(() => {
        if (
          context === null ||
          typeof context !== "object" ||
          context.signal === null ||
          typeof context.signal !== "object" ||
          typeof context.signal.aborted !== "boolean" ||
          typeof context.signal.addEventListener !== "function"
        ) {
          throw new TypeError("A valid AbortSignal is required for provider invocation.");
        }

        if (context.signal.aborted) throw createAbortError();
        if (!isHoidProviderSelectionSnapshot(request)) {
          throw new TypeError("Only immutable Hoid selection snapshots may cross the provider boundary.");
        }

        const transportContext = Object.freeze({ signal: context.signal });
        return transport(request, transportContext);
      });
    },
  });
}
