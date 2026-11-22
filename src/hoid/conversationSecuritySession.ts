import {
  verifyHoidNativeConversationSecurityProvider,
  type HoidNativeSecurityAttestationVerification,
} from "./conversationSecurityAttestation";
import {
  loadHoidConversationHistory,
  saveHoidConversationHistory,
  type HoidConversationHistoryLoadResult,
  type HoidConversationHistorySaveResult,
} from "./conversationHistoryStorePort";

declare const hoidConversationSecuritySessionBrand: unique symbol;

/**
 * Process-local capability issued only after native-provider attestation.
 * The runtime WeakMap is authoritative; this TypeScript brand is not security.
 */
export type HoidConversationSecuritySession = Readonly<{
  readonly [hoidConversationSecuritySessionBrand]: true;
}>;

export type HoidConversationSecuritySessionContext = Readonly<{
  appIdentifier: string;
  appBuildId: string;
  platform: "ios" | "android";
}>;

type SessionRequest = Readonly<{
  challengePort: unknown;
  attestationPort: unknown;
  trustPort: unknown;
  runtime: unknown;
  expectedAppIdentifier: string;
  expectedAppBuildId: string;
}>;

type SessionRecord = Readonly<{
  appIdentifier: string;
  appBuildId: string;
  providerId: string;
  platform: "ios" | "android";
  algorithm: string;
  expiresAt: string;
  expiresAtMs: number;
  issuedAtMonotonicMs: number;
  maxDurationMs: number;
  capabilitiesFingerprint: string;
  attestationFingerprint: string;
}>;

type SessionBlockedReason =
  | "invalid-request"
  | "verification-failed"
  | "invalid-session"
  | "session-expired"
  | "runtime-mismatch"
  | "clock-unavailable";

type SessionState =
  | Readonly<{ status: "ready"; record: SessionRecord }>
  | Readonly<{ status: "blocked"; reason: Exclude<SessionBlockedReason, "invalid-request" | "verification-failed"> }>;

export type HoidConversationSecuritySessionResult =
  | Readonly<{
      status: "ready";
      session: HoidConversationSecuritySession;
      providerId: string;
      platform: "ios" | "android";
      algorithm: string;
      expiresAt: string;
      capabilitiesFingerprint: string;
      attestationFingerprint: string;
    }>
  | Readonly<{
      status: "blocked";
      reason: "invalid-request" | "verification-failed" | "clock-unavailable";
      verificationReason?: Extract<
        HoidNativeSecurityAttestationVerification,
        { status: "blocked" }
      >["reason"];
    }>;

export type HoidConversationSecuritySessionSaveResult =
  | HoidConversationHistorySaveResult
  | Readonly<{ status: "security-blocked"; reason: SessionBlockedReason }>;

export type HoidConversationSecuritySessionLoadResult =
  | HoidConversationHistoryLoadResult
  | Readonly<{ status: "security-blocked"; reason: SessionBlockedReason }>;

type DataRecord = Record<string, unknown>;

const sessions = new WeakMap<object, SessionRecord>();
const REQUEST_KEYS = [
  "challengePort",
  "attestationPort",
  "trustPort",
  "runtime",
  "expectedAppIdentifier",
  "expectedAppBuildId",
] as const;
const CONTEXT_KEYS = ["appIdentifier", "appBuildId", "platform"] as const;
const MAX_SESSION_DURATION_MS = 120_000;

function readMonotonicNow(): number | null {
  try {
    const clock = (globalThis as unknown as {
      performance?: { now?: unknown };
    }).performance;
    if (!clock || typeof clock.now !== "function") return null;
    const value = clock.now.call(clock) as unknown;
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : null;
  } catch {
    return null;
  }
}

function exactRecord(value: unknown, allowedKeys: readonly string[]): DataRecord | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== allowedKeys.length ||
      keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))
    ) return null;

    const result = Object.create(null) as DataRecord;
    for (const key of allowedKeys) {
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

function canonicalRequest(value: unknown): SessionRequest | null {
  const record = exactRecord(value, REQUEST_KEYS);
  if (
    !record ||
    typeof record.expectedAppIdentifier !== "string" ||
    typeof record.expectedAppBuildId !== "string"
  ) return null;

  return Object.freeze({
    challengePort: record.challengePort,
    attestationPort: record.attestationPort,
    trustPort: record.trustPort,
    runtime: record.runtime,
    expectedAppIdentifier: record.expectedAppIdentifier,
    expectedAppBuildId: record.expectedAppBuildId,
  });
}

function canonicalContext(value: unknown): HoidConversationSecuritySessionContext | null {
  const record = exactRecord(value, CONTEXT_KEYS);
  if (
    !record ||
    typeof record.appIdentifier !== "string" ||
    typeof record.appBuildId !== "string" ||
    (record.platform !== "ios" && record.platform !== "android")
  ) return null;

  return Object.freeze({
    appIdentifier: record.appIdentifier,
    appBuildId: record.appBuildId,
    platform: record.platform,
  });
}

function sessionState(
  sessionInput: unknown,
  contextInput: unknown,
): SessionState {
  if (
    sessionInput === null ||
    typeof sessionInput !== "object" ||
    Array.isArray(sessionInput)
  ) return Object.freeze({ status: "blocked", reason: "invalid-session" });

  const record = sessions.get(sessionInput);
  if (!record) return Object.freeze({ status: "blocked", reason: "invalid-session" });

  const monotonicNow = readMonotonicNow();
  if (
    monotonicNow === null ||
    monotonicNow < record.issuedAtMonotonicMs ||
    monotonicNow - record.issuedAtMonotonicMs >= record.maxDurationMs ||
    Date.now() >= record.expiresAtMs
  ) {
    sessions.delete(sessionInput);
    return Object.freeze({ status: "blocked", reason: "session-expired" });
  }

  const context = canonicalContext(contextInput);
  if (!context) return Object.freeze({ status: "blocked", reason: "runtime-mismatch" });
  if (
    context.appIdentifier !== record.appIdentifier ||
    context.appBuildId !== record.appBuildId ||
    context.platform !== record.platform
  ) return Object.freeze({ status: "blocked", reason: "runtime-mismatch" });

  return Object.freeze({ status: "ready", record });
}

/**
 * Establishes a short-lived, non-serializable persistence capability.
 * The host must supply ports created from its trusted native composition root.
 * The current wall clock is read here rather than accepted from the caller.
 */
export async function createHoidConversationSecuritySession(
  requestInput: unknown,
): Promise<HoidConversationSecuritySessionResult> {
  const request = canonicalRequest(requestInput);
  if (!request) return Object.freeze({ status: "blocked", reason: "invalid-request" });

  try {
    const startedAtMs = Date.now();
    const startedAtMonotonicMs = readMonotonicNow();
    if (startedAtMonotonicMs === null) {
      return Object.freeze({ status: "blocked", reason: "clock-unavailable" });
    }
    const now = new Date(startedAtMs).toISOString();
    const verification = await verifyHoidNativeConversationSecurityProvider({
      ...request,
      now,
    });
    if (verification.status !== "verified") {
      return Object.freeze({
        status: "blocked",
        reason: "verification-failed",
        verificationReason: verification.reason,
      });
    }

    const expiresAtMs = Date.parse(verification.expiresAt);
    const maxDurationMs = Math.min(
      expiresAtMs - startedAtMs,
      MAX_SESSION_DURATION_MS,
    );
    const completedAtMonotonicMs = readMonotonicNow();
    if (
      !Number.isFinite(expiresAtMs) ||
      !Number.isFinite(maxDurationMs) ||
      maxDurationMs <= 0 ||
      completedAtMonotonicMs === null ||
      completedAtMonotonicMs < startedAtMonotonicMs ||
      completedAtMonotonicMs - startedAtMonotonicMs >= maxDurationMs ||
      expiresAtMs <= Date.now()
    ) {
      return Object.freeze({
        status: "blocked",
        reason: "verification-failed",
        verificationReason: "attestation-not-current",
      });
    }

    const session = Object.freeze(Object.create(null)) as HoidConversationSecuritySession;
    const record: SessionRecord = Object.freeze({
      appIdentifier: request.expectedAppIdentifier,
      appBuildId: request.expectedAppBuildId,
      providerId: verification.providerId,
      platform: verification.platform,
      algorithm: verification.algorithm,
      expiresAt: verification.expiresAt,
      expiresAtMs,
      issuedAtMonotonicMs: startedAtMonotonicMs,
      maxDurationMs,
      capabilitiesFingerprint: verification.capabilitiesFingerprint,
      attestationFingerprint: verification.attestationFingerprint,
    });
    sessions.set(session, record);

    return Object.freeze({
      status: "ready",
      session,
      providerId: record.providerId,
      platform: record.platform,
      algorithm: record.algorithm,
      expiresAt: record.expiresAt,
      capabilitiesFingerprint: record.capabilitiesFingerprint,
      attestationFingerprint: record.attestationFingerprint,
    });
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "verification-failed",
      verificationReason: "attestation-unavailable",
    });
  }
}

/** Checks a session against the host's current app/build/platform identity. */
export function isHoidConversationSecuritySessionUsable(
  sessionInput: unknown,
  contextInput: unknown,
): boolean {
  return sessionState(sessionInput, contextInput).status === "ready";
}

/** Revocation affects subsequent operations; it does not cancel an in-flight SQLite transaction. */
export function revokeHoidConversationSecuritySession(sessionInput: unknown): boolean {
  if (
    sessionInput === null ||
    typeof sessionInput !== "object" ||
    Array.isArray(sessionInput)
  ) return false;
  return sessions.delete(sessionInput);
}

/**
 * A session is checked before loading and again after the asynchronous read.
 * If it expires or is revoked during I/O, no conversation messages are returned.
 */
export async function loadHoidConversationHistoryWithSecuritySession(
  sessionInput: unknown,
  contextInput: unknown,
  storeInput: unknown,
  keyInput: unknown,
  currentProgressScopeInput: unknown,
): Promise<HoidConversationSecuritySessionLoadResult> {
  const before = sessionState(sessionInput, contextInput);
  if (before.status !== "ready") {
    return Object.freeze({ status: "security-blocked", reason: before.reason });
  }

  let result: HoidConversationHistoryLoadResult;
  try {
    result = await loadHoidConversationHistory(
      storeInput,
      keyInput,
      currentProgressScopeInput,
    );
  } catch {
    return Object.freeze({ status: "unavailable" });
  }

  const after = sessionState(sessionInput, contextInput);
  if (after.status !== "ready") {
    return Object.freeze({ status: "security-blocked", reason: after.reason });
  }
  return result;
}

/**
 * A save is admitted only while the session is current and the host identity
 * matches. The underlying store still has to be the host-created encrypted
 * SQLite adapter; this gate does not certify an arbitrary StorePort instance.
 */
export async function saveHoidConversationHistoryWithSecuritySession(
  sessionInput: unknown,
  contextInput: unknown,
  storeInput: unknown,
  keyInput: unknown,
  expectedStorageRevisionInput: unknown,
  snapshotInput: unknown,
  currentProgressScopeInput: unknown,
): Promise<HoidConversationSecuritySessionSaveResult> {
  const state = sessionState(sessionInput, contextInput);
  if (state.status !== "ready") {
    return Object.freeze({ status: "security-blocked", reason: state.reason });
  }

  try {
    return await saveHoidConversationHistory(
      storeInput,
      keyInput,
      expectedStorageRevisionInput,
      snapshotInput,
      currentProgressScopeInput,
    );
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
}
