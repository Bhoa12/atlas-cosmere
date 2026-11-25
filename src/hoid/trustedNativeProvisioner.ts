import {
  createHoidNativeSecurityProviderTrustRegistryPort,
  type HoidNativeSecurityTrustRegistryOptions,
} from "./conversationProviderTrustRegistry";
import {
  verifyHoidNativeConversationSecurityProvider,
  type HoidNativeSecurityAttestationVerification,
} from "./conversationSecurityAttestation";
import { createHoidNobleEd25519VerificationPort } from "./nobleEd25519VerificationAdapter";
import type {
  HoidApprovedClaimReviewSignatureContext,
  HoidReviewerTrustRootKey,
} from "./editorialReviewSignatures";
import type { HoidTrustedClock } from "./trustedExactUnitAnswerHost";

const INPUT_KEYS = [
  "trustRegistryOptions", "challengePort", "attestationPort", "runtime",
  "expectedAppIdentifier", "expectedAppBuildId", "clock", "rootKey", "context",
  "loadCompositionConfig",
] as const;
const TRUST_OPTIONS_KEYS = ["rootPin", "source", "revisionStore"] as const;
const ROOT_PIN_KEYS = ["trustDomainId", "rootKeyId", "appIdentifier", "publicKeyHex", "minimumRevision"] as const;
const ROOT_KEY_KEYS = ["keyId", "publicKeyHex"] as const;
const CONTEXT_KEYS = [
  "schemaVersion", "repositoryFullName", "pullRequestNumber", "baseRef", "baseSha",
  "headRef", "headSha", "promotionManifestPath", "promotionPlanFingerprint", "reviewBundleFingerprint",
] as const;
const RUNTIME_KEYS = ["platform", "nativeBuild", "secureStorageAvailable", "sqliteTransactionMode"] as const;
const COMPOSITION_KEYS = [
  "transport", "packageSource", "registrySource", "checkpointStore", "clock",
  "context", "rootKey", "verifier", "providerTimeoutMs", "maxRegistryAgeMs",
] as const;
const REQUIRED_COMPOSITION_KEYS = COMPOSITION_KEYS.slice(0, 8);
const APP_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]{2,127}$/u;
const APP_BUILD_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/u;
const KEY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,126}$/iu;
const PUBLIC_KEY_PATTERN = /^[a-f0-9]{64}$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const COMMIT_PATTERN = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const REF_PATTERN = /^[A-Za-z0-9_./-]{1,255}$/u;
const PATH_PATTERN = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]{1,240}$/u;

type DataRecord = Record<string, unknown>;
type NativeBlockedReason =
  | "aborted"
  | "invalid-signal"
  | "clock-unavailable"
  | "native-security-blocked"
  | "composition-unavailable"
  | "invalid-composition-config";

export type HoidTrustedNativeProvisioningPreflight =
  | Readonly<{
      status: "verified";
      verification: Extract<HoidNativeSecurityAttestationVerification, { status: "verified" }>;
    }>
  | Readonly<{
      status: "blocked";
      reason: NativeBlockedReason;
      verification?: Extract<HoidNativeSecurityAttestationVerification, { status: "blocked" }>;
    }>;

export type HoidTrustedNativeProvisioningBindings = Readonly<{
  clock: HoidTrustedClock;
  rootKey: HoidReviewerTrustRootKey;
  context: HoidApprovedClaimReviewSignatureContext;
  verifier: ReturnType<typeof createHoidNobleEd25519VerificationPort>;
}>;

export type HoidTrustedNativeCompositionConfigLoader = (
  signal: AbortSignal,
  bindings: HoidTrustedNativeProvisioningBindings,
) => Promise<unknown>;

export type HoidExpoNativeCompositionProvisioner = Readonly<{
  loadCompositionConfig(signal: AbortSignal): Promise<unknown>;
}>;

export type HoidTrustedNativeProvisioner = Readonly<{
  preflight(signal: AbortSignal): Promise<HoidTrustedNativeProvisioningPreflight>;
  expoProvisioner: HoidExpoNativeCompositionProvisioner;
}>;

export class HoidNativeProvisioningError extends Error {
  readonly reason: NativeBlockedReason;
  readonly verification?: Extract<HoidNativeSecurityAttestationVerification, { status: "blocked" }>;

  constructor(
    reason: NativeBlockedReason,
    verification?: Extract<HoidNativeSecurityAttestationVerification, { status: "blocked" }>,
  ) {
    super("Hoid native trusted provisioning is blocked: " + reason);
    this.name = "HoidNativeProvisioningError";
    this.reason = reason;
    this.verification = verification;
  }
}

const trustedProvisioners = new WeakSet<object>();

function exactDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = allowedKeys,
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
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    if (requiredKeys.some(key => !Object.prototype.hasOwnProperty.call(result, key))) return null;
    return result;
  } catch {
    return null;
  }
}

function captureDataMethod(value: unknown, name: string): ((...args: unknown[]) => unknown) | null {
  try {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) return null;
    let current: object | null = value as object;
    while (current !== null) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (!Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function") return null;
        const method = descriptor.value as (...args: unknown[]) => unknown;
        return (...args: unknown[]) => method.apply(value, args);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

function captureExactAsyncPort(
  value: unknown,
  methodNames: readonly string[],
): Readonly<Record<string, (...args: unknown[]) => Promise<unknown>>> | null {
  const record = exactDataRecord(value, methodNames, methodNames);
  if (!record) return null;
  const methods: Record<string, (...args: unknown[]) => Promise<unknown>> = Object.create(null) as Record<
    string,
    (...args: unknown[]) => Promise<unknown>
  >;
  for (const name of methodNames) {
    if (typeof record[name] !== "function") return null;
    const method = record[name] as (...args: unknown[]) => unknown;
    methods[name] = (...args: unknown[]) => Promise.resolve(method.apply(value, args));
  }
  return Object.freeze(methods);
}

function canonicalRootPin(value: unknown): DataRecord | null {
  const record = exactDataRecord(value, ROOT_PIN_KEYS);
  if (
    !record ||
    typeof record.trustDomainId !== "string" ||
    !/^[a-z0-9][a-z0-9._:-]{0,127}$/u.test(record.trustDomainId) ||
    typeof record.rootKeyId !== "string" ||
    !KEY_ID_PATTERN.test(record.rootKeyId) ||
    typeof record.appIdentifier !== "string" ||
    !APP_IDENTIFIER_PATTERN.test(record.appIdentifier) ||
    typeof record.publicKeyHex !== "string" ||
    !PUBLIC_KEY_PATTERN.test(record.publicKeyHex) ||
    typeof record.minimumRevision !== "number" ||
    !Number.isSafeInteger(record.minimumRevision) ||
    record.minimumRevision < 1
  ) return null;
  return Object.freeze(record);
}

function canonicalRootKey(value: unknown): HoidReviewerTrustRootKey | null {
  const record = exactDataRecord(value, ROOT_KEY_KEYS);
  if (!record || typeof record.keyId !== "string" || !KEY_ID_PATTERN.test(record.keyId) ||
    typeof record.publicKeyHex !== "string" || !PUBLIC_KEY_PATTERN.test(record.publicKeyHex)) return null;
  return Object.freeze({ keyId: record.keyId, publicKeyHex: record.publicKeyHex });
}

function canonicalContext(value: unknown): HoidApprovedClaimReviewSignatureContext | null {
  const record = exactDataRecord(value, CONTEXT_KEYS);
  if (
    !record ||
    record.schemaVersion !== 1 ||
    typeof record.repositoryFullName !== "string" ||
    !REPOSITORY_PATTERN.test(record.repositoryFullName) ||
    typeof record.pullRequestNumber !== "number" ||
    !Number.isSafeInteger(record.pullRequestNumber) ||
    record.pullRequestNumber < 1 ||
    typeof record.baseRef !== "string" ||
    !REF_PATTERN.test(record.baseRef) ||
    typeof record.baseSha !== "string" ||
    !COMMIT_PATTERN.test(record.baseSha) ||
    typeof record.headRef !== "string" ||
    !REF_PATTERN.test(record.headRef) ||
    typeof record.headSha !== "string" ||
    !COMMIT_PATTERN.test(record.headSha) ||
    typeof record.promotionManifestPath !== "string" ||
    !PATH_PATTERN.test(record.promotionManifestPath) ||
    typeof record.promotionPlanFingerprint !== "string" ||
    !SHA_PATTERN.test(record.promotionPlanFingerprint) ||
    typeof record.reviewBundleFingerprint !== "string" ||
    !SHA_PATTERN.test(record.reviewBundleFingerprint)
  ) return null;

  return Object.freeze({
    schemaVersion: 1,
    repositoryFullName: record.repositoryFullName,
    pullRequestNumber: record.pullRequestNumber,
    baseRef: record.baseRef,
    baseSha: record.baseSha,
    headRef: record.headRef,
    headSha: record.headSha,
    promotionManifestPath: record.promotionManifestPath,
    promotionPlanFingerprint: record.promotionPlanFingerprint,
    reviewBundleFingerprint: record.reviewBundleFingerprint,
  });
}

function canonicalRuntime(value: unknown): DataRecord | null {
  const record = exactDataRecord(value, RUNTIME_KEYS);
  if (!record ||
    (record.platform !== "ios" && record.platform !== "android" && record.platform !== "web") ||
    typeof record.nativeBuild !== "boolean" ||
    typeof record.secureStorageAvailable !== "boolean" ||
    (record.sqliteTransactionMode !== "exclusive" &&
      record.sqliteTransactionMode !== "deferred" &&
      record.sqliteTransactionMode !== "unavailable")) return null;
  return Object.freeze(record);
}

function canonicalIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  try {
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
  } catch {
    return false;
  }
}

function signalState(value: unknown): "aborted" | "active" | "invalid" {
  if (typeof AbortSignal === "undefined") return "invalid";
  const getter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, "aborted")?.get;
  if (typeof getter !== "function") return "invalid";
  try {
    const aborted = getter.call(value);
    if (typeof aborted !== "boolean") return "invalid";
    return aborted ? "aborted" : "active";
  } catch {
    return "invalid";
  }
}

function canonicalCompositionConfig(
  value: unknown,
  bindings: HoidTrustedNativeProvisioningBindings,
): Readonly<Record<string, unknown>> | null {
  const record = exactDataRecord(value, COMPOSITION_KEYS, REQUIRED_COMPOSITION_KEYS);
  if (
    !record ||
    typeof record.transport !== "function" ||
    record.packageSource === null ||
    typeof record.packageSource !== "object" ||
    Array.isArray(record.packageSource) ||
    record.registrySource === null ||
    typeof record.registrySource !== "object" ||
    Array.isArray(record.registrySource) ||
    record.checkpointStore === null ||
    typeof record.checkpointStore !== "object" ||
    Array.isArray(record.checkpointStore) ||
    record.clock !== bindings.clock ||
    record.rootKey !== bindings.rootKey ||
    record.context !== bindings.context ||
    record.verifier !== bindings.verifier
  ) return null;

  if (record.providerTimeoutMs !== undefined &&
    (typeof record.providerTimeoutMs !== "number" ||
      !Number.isSafeInteger(record.providerTimeoutMs) ||
      record.providerTimeoutMs < 1 || record.providerTimeoutMs > 120_000)) return null;

  if (record.maxRegistryAgeMs !== undefined &&
    (typeof record.maxRegistryAgeMs !== "number" ||
      !Number.isSafeInteger(record.maxRegistryAgeMs) ||
      record.maxRegistryAgeMs < 1 ||
      record.maxRegistryAgeMs > 30 * 24 * 60 * 60 * 1000)) return null;

  return Object.freeze(record);
}

/**
 * The attested provider is the native storage/cryptography provider, not the
 * LLM inference provider. The LLM transport remains a separate function in
 * the editorial composition config.
 *
 * Root pins, application identity and editorial review bindings are supplied
 * by the trusted application build. This factory creates no keys, signatures,
 * durable checkpoints, native capabilities or editorial packages.
 */
export function createHoidTrustedNativeProvisioner(
  input: unknown,
): HoidTrustedNativeProvisioner | null {
  const options = exactDataRecord(input, INPUT_KEYS);
  if (!options) return null;

  const expectedAppIdentifier = options.expectedAppIdentifier;
  const expectedAppBuildId = options.expectedAppBuildId;
  if (
    typeof expectedAppIdentifier !== "string" ||
    !APP_IDENTIFIER_PATTERN.test(expectedAppIdentifier) ||
    typeof expectedAppBuildId !== "string" ||
    !APP_BUILD_PATTERN.test(expectedAppBuildId)
  ) return null;

  const trustOptions = exactDataRecord(options.trustRegistryOptions, TRUST_OPTIONS_KEYS);
  const rootPin = trustOptions ? canonicalRootPin(trustOptions.rootPin) : null;
  if (!trustOptions || !rootPin || rootPin.appIdentifier !== expectedAppIdentifier) return null;

  let trustPort: ReturnType<typeof createHoidNativeSecurityProviderTrustRegistryPort>;
  try {
    trustPort = createHoidNativeSecurityProviderTrustRegistryPort(
      options.trustRegistryOptions as HoidNativeSecurityTrustRegistryOptions,
    );
  } catch {
    return null;
  }

  const challenge = captureExactAsyncPort(options.challengePort, ["issue", "consumeIssued"]);
  const attestation = captureExactAsyncPort(options.attestationPort, ["attest"]);
  const runtime = canonicalRuntime(options.runtime);
  const nowIsoMethod = captureDataMethod(options.clock, "nowIso");
  const rootKey = canonicalRootKey(options.rootKey);
  const context = canonicalContext(options.context);
  const loadConfig = options.loadCompositionConfig;
  if (!challenge || !attestation || !runtime || !nowIsoMethod || !rootKey ||
    !context || typeof loadConfig !== "function") return null;

  const clock: HoidTrustedClock = Object.freeze({
    nowIso(): string {
      const value = nowIsoMethod();
      if (!canonicalIso(value)) throw new TypeError("Hoid trusted clock returned a non-canonical timestamp");
      return value;
    },
  });
  const verifier = createHoidNobleEd25519VerificationPort();
  const bindings: HoidTrustedNativeProvisioningBindings = Object.freeze({
    clock,
    rootKey,
    context,
    verifier,
  });

  const preflight = async (
    signalInput: AbortSignal,
  ): Promise<HoidTrustedNativeProvisioningPreflight> => {
    const initialSignal = signalState(signalInput);
    if (initialSignal === "invalid") return Object.freeze({ status: "blocked", reason: "invalid-signal" });
    if (initialSignal === "aborted") return Object.freeze({ status: "blocked", reason: "aborted" });

    let now: string;
    try {
      now = clock.nowIso();
    } catch {
      return Object.freeze({ status: "blocked", reason: "clock-unavailable" });
    }

    let verification: HoidNativeSecurityAttestationVerification;
    try {
      verification = await verifyHoidNativeConversationSecurityProvider({
        challengePort: challenge,
        attestationPort: attestation,
        trustPort,
        runtime,
        expectedAppIdentifier,
        expectedAppBuildId,
        now,
      });
    } catch {
      return Object.freeze({ status: "blocked", reason: "native-security-blocked" });
    }

    if (signalState(signalInput) === "aborted") {
      return Object.freeze({ status: "blocked", reason: "aborted" });
    }
    if (verification.status !== "verified") {
      return Object.freeze({
        status: "blocked",
        reason: "native-security-blocked",
        verification,
      });
    }
    return Object.freeze({ status: "verified", verification });
  };

  const expoProvisioner: HoidExpoNativeCompositionProvisioner = Object.freeze({
    async loadCompositionConfig(signal: AbortSignal): Promise<unknown> {
      const checked = await preflight(signal);
      if (checked.status !== "verified") {
        throw new HoidNativeProvisioningError(
          checked.reason,
          checked.status === "blocked" ? checked.verification : undefined,
        );
      }
      if (signalState(signal) !== "active") throw new HoidNativeProvisioningError("aborted");

      let rawConfig: unknown;
      try {
        rawConfig = await (loadConfig as HoidTrustedNativeCompositionConfigLoader)(signal, bindings);
      } catch {
        throw new HoidNativeProvisioningError(
          signalState(signal) === "aborted" ? "aborted" : "composition-unavailable",
        );
      }

      if (signalState(signal) !== "active") throw new HoidNativeProvisioningError("aborted");
      const config = canonicalCompositionConfig(rawConfig, bindings);
      if (!config) throw new HoidNativeProvisioningError("invalid-composition-config");
      return config;
    },
  });

  const provisioner: HoidTrustedNativeProvisioner = Object.freeze({
    preflight,
    expoProvisioner,
  });
  trustedProvisioners.add(provisioner as object);
  return provisioner;
}

export function isHoidTrustedNativeProvisioner(
  value: unknown,
): value is HoidTrustedNativeProvisioner {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) && trustedProvisioners.has(value);
}
