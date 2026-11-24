import {
  createHoidExactUnitSelectionAdapter,
  type HoidExactUnitSelectionTransport,
} from "./exactUnitProviderAdapter";
import type {
  HoidApprovedClaimReviewSignatureContext,
  HoidEd25519VerificationPort,
  HoidReviewerTrustRootKey,
} from "./editorialReviewSignatures";
import {
  createHoidTrustedExactUnitAnswerHost,
  type HoidReviewerTrustCheckpointStore,
  type HoidReviewerTrustRegistrySource,
  type HoidSignedClaimPackageSource,
  type HoidTrustedClock,
  type HoidTrustedExactUnitAnswerHost,
  type HoidTrustedProgressInvalidationPort,
} from "./trustedExactUnitAnswerHost";
import {
  createHoidTrustedConversationGatewayV3,
  type HoidConversationAnswerSinkV3,
  type HoidConversationProgressInvalidationPortV3,
  type HoidTrustedConversationGatewayV3,
  type HoidTrustedConversationSessionV3,
} from "./trustedConversationGatewayV3";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";

type DataRecord = Record<string, unknown>;

const CONFIG_KEYS = [
  "coordinator",
  "progressInvalidation",
  "transport",
  "packageSource",
  "registrySource",
  "checkpointStore",
  "clock",
  "context",
  "rootKey",
  "verifier",
  "providerTimeoutMs",
  "maxRegistryAgeMs",
] as const;
const REQUIRED_CONFIG_KEYS = CONFIG_KEYS.slice(0, 10);
const SESSION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/u;

function exactDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): DataRecord | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))) return null;

    const result = Object.create(null) as DataRecord;
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
    if (requiredKeys.some(key => !Object.prototype.hasOwnProperty.call(result, key))) return null;
    return result;
  } catch {
    return null;
  }
}

function hasCallableMethod(value: unknown, name: string): boolean {
  try {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) return false;
    let current: object | null = value as object;
    while (current !== null) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        return Object.prototype.hasOwnProperty.call(descriptor, "value") &&
          typeof descriptor.value === "function";
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return false;
  } catch {
    return false;
  }
}

export type HoidTrustedConversationSessionCreation =
  | Readonly<{ status: "created"; session: HoidTrustedConversationSessionV3 }>
  | Readonly<{ status: "invalid-session" | "invalid-sink" | "duplicate-session" | "disposed" }>;

export type HoidTrustedConversationCompositionResult =
  | Readonly<{
      status: "composed";
      composition: HoidTrustedConversationComposition;
    }>
  | Readonly<{
      status: "blocked";
      reason: "invalid-composition-config" | "trusted-host-unavailable" | "conversation-gateway-unavailable";
    }>;

/**
 * Owns one exact-unit host and its v3 conversation sessions.
 *
 * "composed" means that the dependency graph was constructed. It does not
 * mean that editorial trust is provisioned: every turn still revalidates the
 * signed registry, package bundle, anti-rollback checkpoint and live progress.
 */
export class HoidTrustedConversationComposition {
  private readonly sessions = new Map<string, HoidTrustedConversationSessionV3>();
  private disposed = false;

  private constructor(
    private readonly host: HoidTrustedExactUnitAnswerHost,
    private readonly gateway: HoidTrustedConversationGatewayV3,
  ) {}

  createSession(
    sessionIdInput: unknown,
    sinkInput: unknown,
  ): HoidTrustedConversationSessionCreation {
    if (this.disposed) return Object.freeze({ status: "disposed" });
    if (typeof sessionIdInput !== "string" || !SESSION_ID_PATTERN.test(sessionIdInput)) {
      return Object.freeze({ status: "invalid-session" });
    }
    if (this.sessions.has(sessionIdInput)) return Object.freeze({ status: "duplicate-session" });
    if (!hasCallableMethod(sinkInput, "present") || !hasCallableMethod(sinkInput, "clear")) {
      return Object.freeze({ status: "invalid-sink" });
    }

    const session = this.gateway.createSession(
      sessionIdInput,
      sinkInput as HoidConversationAnswerSinkV3,
    );
    if (!session) return Object.freeze({ status: "invalid-session" });

    this.sessions.set(sessionIdInput, session);
    return Object.freeze({ status: "created", session });
  }

  closeSession(sessionIdInput: unknown): boolean {
    if (typeof sessionIdInput !== "string") return false;
    const session = this.sessions.get(sessionIdInput);
    if (!session) return false;
    this.sessions.delete(sessionIdInput);
    session.dispose();
    return true;
  }

  get activeSessionCount(): number {
    return this.sessions.size;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const session of this.sessions.values()) session.dispose();
    this.sessions.clear();
    this.host.dispose();
  }
}

/**
 * Production composition root for the provider-neutral exact-unit selector,
 * signed answer host and v3 conversation gateway.
 *
 * Native trust, persistence, clock and progress ports must be supplied by the
 * application host. No root key, reviewer key, API key or editorial bundle is
 * embedded here. Missing or malformed dependencies fail closed.
 */
export function createHoidTrustedConversationComposition(
  input: unknown,
): HoidTrustedConversationCompositionResult {
  const config = exactDataRecord(input, CONFIG_KEYS, REQUIRED_CONFIG_KEYS);
  if (
    !config ||
    !(config.coordinator instanceof HoidUnitProgressCoordinator) ||
    !hasCallableMethod(config.progressInvalidation, "subscribe") ||
    typeof config.transport !== "function"
  ) {
    return Object.freeze({ status: "blocked", reason: "invalid-composition-config" });
  }

  const selector = createHoidExactUnitSelectionAdapter(
    config.transport as HoidExactUnitSelectionTransport,
  );
  const hostConfig = Object.freeze({
    coordinator: config.coordinator,
    packageSource: config.packageSource,
    registrySource: config.registrySource,
    checkpointStore: config.checkpointStore,
    progressInvalidation: config.progressInvalidation as HoidTrustedProgressInvalidationPort,
    clock: config.clock as HoidTrustedClock,
    context: config.context as HoidApprovedClaimReviewSignatureContext,
    rootKey: config.rootKey as HoidReviewerTrustRootKey,
    verifier: config.verifier as HoidEd25519VerificationPort,
    selector,
    ...(config.providerTimeoutMs !== undefined ? { providerTimeoutMs: config.providerTimeoutMs } : {}),
    ...(config.maxRegistryAgeMs !== undefined ? { maxRegistryAgeMs: config.maxRegistryAgeMs } : {}),
  });

  let host: HoidTrustedExactUnitAnswerHost | null;
  try {
    host = createHoidTrustedExactUnitAnswerHost(hostConfig);
  } catch {
    host = null;
  }
  if (!host) return Object.freeze({ status: "blocked", reason: "trusted-host-unavailable" });

  const gateway = createHoidTrustedConversationGatewayV3({
    host,
    coordinator: config.coordinator,
    progressInvalidation: config.progressInvalidation as HoidConversationProgressInvalidationPortV3,
  });
  if (!gateway) {
    host.dispose();
    return Object.freeze({ status: "blocked", reason: "conversation-gateway-unavailable" });
  }

  return Object.freeze({
    status: "composed",
    composition: new HoidTrustedConversationComposition(host, gateway),
  });
}
