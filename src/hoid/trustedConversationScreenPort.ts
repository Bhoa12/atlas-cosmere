import type { HoidConversationTurnInputV3, HoidTrustedConversationResultV3 } from "./trustedConversationGatewayV3";
import type { HoidExactEvidenceAnswer, HoidExactRuntimeCallOptions } from "./exactUnitEvidenceRuntime";
import type { HoidTrustedAnswerBlockReason, HoidTrustedPresentationPermit } from "./trustedExactUnitAnswerHost";
import {
  projectHoidExactUnitAnswerForDisplay,
  summarizeHoidExactUnitCrossBookDisplay,
  type HoidAnswerDisplayProjection,
  type HoidDisplayCrossBookEvidenceSummary,
} from "./answerDisplayProjection";
import { isHoidTrustedConversationComposition } from "./trustedConversationComposition";
import { canonicalizeHoidAnswerBookScope, type HoidAnswerBookScope } from "./answerScope";

type DataRecord = Record<string, unknown>;

const SESSION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_PENDING_DELIVERIES = 8;

type CapturedDelivery = Readonly<{
  answer: HoidExactEvidenceAnswer;
  permit: HoidTrustedPresentationPermit;
}>;

type ReadyResult = Readonly<{
  status: "ready";
  presentation: HoidAnswerDisplayProjection;
  crossBookEvidence: HoidDisplayCrossBookEvidenceSummary | null;
  turnId: string;
  registryRevision: number;
  progressRevision: number;
  progressFingerprint: string;
  context: Readonly<{ claimCount: number; entityCount: number; workCount: number }>;
}>;

type AdditionalBlockedReason =
  | "invalid-session"
  | "session-unavailable"
  | "presentation-not-delivered"
  | "invalid-permit"
  | "invalid-answer"
  | "disposed";

export type HoidTrustedConversationScreenResult =
  | ReadyResult
  | Exclude<HoidTrustedConversationResultV3, { status: "presented" }>
  | Readonly<{
      status: "blocked";
      reason: AdditionalBlockedReason;
      hostReason?: HoidTrustedAnswerBlockReason;
    }>;

export type HoidTrustedConversationScreenPort = Readonly<{
  send(
    input: HoidConversationTurnInputV3,
    options?: HoidExactRuntimeCallOptions,
  ): Promise<HoidTrustedConversationScreenResult>;
  dispose(): void;
}>;

const TRUSTED_SCREEN_PORTS = new WeakSet<object>();

export function isHoidTrustedConversationScreenPort(
  value: unknown,
): value is HoidTrustedConversationScreenPort {
  return value !== null &&
    typeof value === "object" &&
    TRUSTED_SCREEN_PORTS.has(value as object);
}

function exactRecord(value: unknown, expectedKeys: readonly string[]): DataRecord | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some(key => typeof key !== "string" || !expectedKeys.includes(key))
    ) return null;
    const result = Object.create(null) as DataRecord;
    for (const key of expectedKeys) {
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

function ownDataValue(value: unknown, key: string): unknown {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) return undefined;
    return descriptor.value;
  } catch {
    return undefined;
  }
}

function resolveMethod(
  value: unknown,
  name: string,
): ((...args: unknown[]) => unknown) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 5; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as (...args: unknown[]) => unknown).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

function canonicalPermit(value: unknown): HoidTrustedPresentationPermit | null {
  const record = exactRecord(value, [
    "registryRevision",
    "registryFingerprint",
    "progressRevision",
    "progressFingerprint",
  ]);
  if (
    !record ||
    typeof record.registryRevision !== "number" ||
    !Number.isSafeInteger(record.registryRevision) ||
    record.registryRevision < 1 ||
    typeof record.registryFingerprint !== "string" ||
    !SHA256_PATTERN.test(record.registryFingerprint) ||
    typeof record.progressRevision !== "number" ||
    !Number.isSafeInteger(record.progressRevision) ||
    record.progressRevision < 0 ||
    typeof record.progressFingerprint !== "string" ||
    !SHA256_PATTERN.test(record.progressFingerprint)
  ) return null;
  return Object.freeze({
    registryRevision: record.registryRevision,
    registryFingerprint: record.registryFingerprint,
    progressRevision: record.progressRevision,
    progressFingerprint: record.progressFingerprint,
  });
}

function validContext(value: unknown): ReadyResult["context"] | null {
  const record = exactRecord(value, ["claimCount", "entityCount", "workCount"]);
  if (
    !record ||
    typeof record.claimCount !== "number" ||
    !Number.isSafeInteger(record.claimCount) ||
    record.claimCount < 0 ||
    typeof record.entityCount !== "number" ||
    !Number.isSafeInteger(record.entityCount) ||
    record.entityCount < 0 ||
    typeof record.workCount !== "number" ||
    !Number.isSafeInteger(record.workCount) ||
    record.workCount < 0 ||
    record.workCount > 4
  ) return null;
  return Object.freeze({
    claimCount: record.claimCount,
    entityCount: record.entityCount,
    workCount: record.workCount,
  });
}

function snapshotBookScope(input: unknown): Readonly<{
  status: "valid";
  scope?: HoidAnswerBookScope;
}> | Readonly<{ status: "invalid" }> {
  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      return Object.freeze({ status: "invalid" });
    }
    const descriptor = Object.getOwnPropertyDescriptor(input, "bookScope");
    if (!descriptor) return Object.freeze({ status: "valid" });
    if (
      !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      descriptor.enumerable !== true
    ) return Object.freeze({ status: "invalid" });
    const scope = canonicalizeHoidAnswerBookScope(descriptor.value);
    return scope
      ? Object.freeze({ status: "valid", scope })
      : Object.freeze({ status: "invalid" });
  } catch {
    return Object.freeze({ status: "invalid" });
  }
}

function presentationMatchesScope(
  presentation: HoidAnswerDisplayProjection,
  scope: HoidAnswerBookScope | undefined,
): boolean {
  if (!scope) return true;
  const actual = [...new Set(presentation.citations.map(citation => citation.sourceBookId))].sort();
  if (scope.mode === "single-work") {
    return scope.bookIds.length === 1 && actual.length === 1 && actual[0] === scope.bookIds[0];
  }
  return scope.bookIds.length >= 2 &&
    actual.length === scope.bookIds.length &&
    actual.every((bookId, index) => bookId === scope.bookIds[index]);
}

/**
 * Bridges the signed v3 conversation composition to a UI-safe display port.
 *
 * The provider never receives progress or chapter locators. The adapter only
 * returns a display projection after the v3 session has delivered an answer
 * with a matching presentation permit. Raw claim/evidence IDs and chapter
 * identity fingerprints are discarded before the result crosses into React.
 */
export function createHoidTrustedConversationScreenPort(
  compositionInput: unknown,
  sessionIdInput: unknown,
): HoidTrustedConversationScreenPort | null {
  if (!isHoidTrustedConversationComposition(compositionInput)) return null;
  if (typeof sessionIdInput !== "string" || !SESSION_ID_PATTERN.test(sessionIdInput)) return null;

  const createSession = resolveMethod(compositionInput, "createSession");
  const closeSession = resolveMethod(compositionInput, "closeSession");
  if (!createSession || !closeSession) return null;

  const deliveries = new Map<string, CapturedDelivery>();
  const invalidDeliveries = new Set<string>();
  const sink = Object.freeze({
    present(turnId: string, answer: HoidExactEvidenceAnswer, permitInput: HoidTrustedPresentationPermit): void {
      if (
        typeof turnId !== "string" ||
        turnId.length < 1 ||
        answer === null ||
        typeof answer !== "object"
      ) {
        if (typeof turnId === "string") invalidDeliveries.add(turnId);
        return;
      }
      if (deliveries.has(turnId)) {
        deliveries.delete(turnId);
        invalidDeliveries.add(turnId);
        return;
      }
      const permit = canonicalPermit(permitInput);
      if (!permit) {
        invalidDeliveries.add(turnId);
        return;
      }
      if (deliveries.size >= MAX_PENDING_DELIVERIES) {
        deliveries.clear();
        invalidDeliveries.add(turnId);
        return;
      }
      deliveries.set(turnId, Object.freeze({ answer, permit }));
    },
    clear(turnId: string, _reason: HoidTrustedAnswerBlockReason): void {
      deliveries.delete(turnId);
    },
  });

  let creation: unknown;
  try {
    creation = createSession(sessionIdInput, sink);
  } catch {
    return null;
  }
  const created = exactRecord(creation, ["status", "session"]);
  if (!created || created.status !== "created") return null;
  const sendSession = resolveMethod(created.session, "send");
  if (!sendSession) {
    try { closeSession(sessionIdInput); } catch { /* best-effort cleanup */ }
    return null;
  }

  let disposed = false;
  let generation = 0;
  const port: HoidTrustedConversationScreenPort = Object.freeze({
    async send(
      input: HoidConversationTurnInputV3,
      options: HoidExactRuntimeCallOptions = {},
    ): Promise<HoidTrustedConversationScreenResult> {
      if (disposed) return Object.freeze({ status: "blocked", reason: "disposed" });
      const scopeSnapshot = snapshotBookScope(input);
      if (scopeSnapshot.status !== "valid") {
        return Object.freeze({ status: "blocked", reason: "invalid-request" });
      }
      const currentGeneration = ++generation;
      deliveries.clear();
      invalidDeliveries.clear();

      let rawResult: unknown;
      try {
        rawResult = await Promise.resolve(sendSession(input, options));
      } catch {
        return Object.freeze({
          status: "blocked",
          reason: "host-blocked",
          hostReason: "answer-unavailable",
        });
      }

      if (disposed || currentGeneration !== generation) {
        const turnId = ownDataValue(rawResult, "turnId");
        return Object.freeze({
          status: "cancelled",
          turnId: typeof turnId === "string" ? turnId : sessionIdInput + ":cancelled",
        });
      }

      const status = ownDataValue(rawResult, "status");
      if (status !== "presented") {
        if (
          rawResult !== null &&
          typeof rawResult === "object" &&
          (status === "blocked" || status === "needs-clarification" || status === "cancelled")
        ) return rawResult as Exclude<HoidTrustedConversationResultV3, { status: "presented" }>;
        return Object.freeze({ status: "blocked", reason: "presentation-not-delivered" });
      }

      const result = rawResult as Extract<HoidTrustedConversationResultV3, { status: "presented" }>;
      const delivery = deliveries.get(result.turnId);
      deliveries.delete(result.turnId);
      if (!delivery) {
        return Object.freeze({
          status: "blocked",
          reason: invalidDeliveries.has(result.turnId) ? "invalid-permit" : "presentation-not-delivered",
        });
      }
      if (
        delivery.permit.registryRevision !== result.registryRevision ||
        delivery.permit.progressRevision !== result.progressRevision
      ) {
        return Object.freeze({ status: "blocked", reason: "invalid-permit" });
      }

      const context = validContext(result.context);
      if (!context) return Object.freeze({ status: "blocked", reason: "presentation-not-delivered" });

      const presentation = projectHoidExactUnitAnswerForDisplay(delivery.answer);
      if (!presentation || !presentationMatchesScope(presentation, scopeSnapshot.scope)) {
        return Object.freeze({ status: "blocked", reason: "invalid-answer" });
      }

      return Object.freeze({
        status: "ready",
        presentation,
        crossBookEvidence: summarizeHoidExactUnitCrossBookDisplay(presentation),
        turnId: result.turnId,
        registryRevision: result.registryRevision,
        progressRevision: result.progressRevision,
        progressFingerprint: delivery.permit.progressFingerprint,
        context,
      });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      generation += 1;
      deliveries.clear();
      invalidDeliveries.clear();
      try { closeSession(sessionIdInput); } catch { /* best-effort cleanup */ }
    },
  });
  TRUSTED_SCREEN_PORTS.add(port as object);
  return port;
}
