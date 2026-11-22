import {
  evaluateHoidConversationSecurityReadiness,
  type HoidConversationSecurityReadinessReason,
  type HoidConversationSecurityAlgorithm,
} from "./conversationSecurityReadiness";
import { createHoidNobleEd25519VerificationPort } from "./nobleEd25519VerificationAdapter";
import { sha256Hex } from "./sha256";
import { isHoidNativeSecurityProviderTrustRegistryPort } from "./conversationProviderTrustRegistry";

const signatureVerifier = createHoidNobleEd25519VerificationPort();

export const HOID_NATIVE_SECURITY_ATTESTATION_SCHEMA_VERSION = 1 as const;
export const HOID_NATIVE_SECURITY_ATTESTATION_KIND =
  "hoid-native-conversation-security-attestation" as const;

const MAX_ATTESTATION_AGE_MS = 120_000;
const MAX_ATTESTATION_LIFETIME_MS = 120_000;
const MAX_CAPABILITIES_JSON_LENGTH = 32_768;
const CHALLENGE_PATTERN = /^[a-f0-9]{64}$/u;
const KEY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,126}$/u;
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9.-]{2,63}$/u;
const APP_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]{2,127}$/u;
const APP_BUILD_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/u;
const HEX_32_PATTERN = /^[a-f0-9]{64}$/u;
const HEX_64_PATTERN = /^[a-f0-9]{128}$/u;

type DataRecord = Record<string, unknown>;
type NativePlatform = "ios" | "android";

export type HoidNativeSecurityChallengePort = Readonly<{
  /** Creates and records a fresh, one-use 256-bit challenge using a CSPRNG. */
  issue(): Promise<unknown>;
  /** Atomically consumes a previously issued challenge; false means absent or replayed. */
  consumeIssued(challengeHex: string): Promise<unknown>;
}>;

export type HoidNativeSecurityAttestationPort = Readonly<{
  /** Requests a provider-signed statement for the supplied one-use challenge. */
  attest(challengeHex: string): Promise<unknown>;
}>;

export type HoidNativeSecurityProviderTrustPort = Readonly<{
  /** Reads a provider public key pinned by the host outside the attestation payload. */
  readPinnedProviderKey(providerId: string, platform: NativePlatform, keyId: string): Promise<unknown>;
}>;

export type HoidNativeSecurityPinnedProviderKey = Readonly<{
  keyId: string;
  providerId: string;
  platform: NativePlatform;
  appIdentifier: string;
  publicKeyHex: string;
}>;

export type HoidNativeSecurityAttestation = Readonly<{
  schemaVersion: typeof HOID_NATIVE_SECURITY_ATTESTATION_SCHEMA_VERSION;
  kind: typeof HOID_NATIVE_SECURITY_ATTESTATION_KIND;
  keyId: string;
  providerId: string;
  platform: NativePlatform;
  appIdentifier: string;
  appBuildId: string;
  challengeHex: string;
  issuedAt: string;
  expiresAt: string;
  capabilitiesJson: string;
  signatureHex: string;
}>;

export type HoidNativeSecurityAttestationVerification =
  | Readonly<{
      status: "verified";
      providerId: string;
      platform: NativePlatform;
      algorithm: HoidConversationSecurityAlgorithm;
      capabilitiesFingerprint: string;
      attestationFingerprint: string;
      expiresAt: string;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "invalid-request"
        | "challenge-unavailable"
        | "challenge-invalid"
        | "attestation-unavailable"
        | "challenge-store-unavailable"
        | "challenge-replayed"
        | "invalid-attestation"
        | "challenge-mismatch"
        | "application-mismatch"
        | "build-mismatch"
        | "attestation-not-current"
        | "capability-payload-invalid"
        | "trust-unavailable"
        | "trust-key-mismatch"
        | "signature-invalid"
        | "readiness-blocked";
      readinessReasons?: readonly HoidConversationSecurityReadinessReason[];
    }>;

type CanonicalAttestation = Omit<HoidNativeSecurityAttestation, "signatureHex"> & {
  signatureHex: string;
};

type CanonicalPinnedKey = HoidNativeSecurityPinnedProviderKey;

type CanonicalPorts = Readonly<{
  challenge: HoidNativeSecurityChallengePort;
  attestation: HoidNativeSecurityAttestationPort;
  trust: HoidNativeSecurityProviderTrustPort;
}>;

type CanonicalRequest = Readonly<{
  challengePort: unknown;
  attestationPort: unknown;
  trustPort: unknown;
  runtime: unknown;
  expectedAppIdentifier: string;
  expectedAppBuildId: string;
  now: string;
}>;

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

function canonicalRequest(value: unknown): CanonicalRequest | null {
  const record = exactRecord(value, [
    "challengePort",
    "attestationPort",
    "trustPort",
    "runtime",
    "expectedAppIdentifier",
    "expectedAppBuildId",
    "now",
  ]);
  if (
    !record ||
    typeof record.expectedAppIdentifier !== "string" ||
    !APP_IDENTIFIER_PATTERN.test(record.expectedAppIdentifier) ||
    typeof record.expectedAppBuildId !== "string" ||
    !APP_BUILD_PATTERN.test(record.expectedAppBuildId) ||
    !isCanonicalIsoTimestamp(record.now)
  ) return null;

  return Object.freeze({
    challengePort: record.challengePort,
    attestationPort: record.attestationPort,
    trustPort: record.trustPort,
    runtime: record.runtime,
    expectedAppIdentifier: record.expectedAppIdentifier,
    expectedAppBuildId: record.expectedAppBuildId,
    now: record.now,
  });
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  try {
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
  } catch {
    return false;
  }
}

function canonicalMethodPort(
  value: unknown,
  methodNames: readonly string[],
): readonly ((...args: never[]) => unknown)[] | null {
  try {
    const record = exactRecord(value, methodNames);
    if (!record) return null;
    const methods: ((...args: never[]) => unknown)[] = [];
    for (const name of methodNames) {
      const method = record[name];
      if (typeof method !== "function") return null;
      methods.push(method as (...args: never[]) => unknown);
    }
    return Object.freeze(methods);
  } catch {
    return null;
  }
}

function canonicalPorts(request: CanonicalRequest): CanonicalPorts | null {
  const challengeMethods = canonicalMethodPort(request.challengePort, [
    "issue",
    "consumeIssued",
  ]);
  const attestationMethods = canonicalMethodPort(request.attestationPort, ["attest"]);
  if (!isHoidNativeSecurityProviderTrustRegistryPort(request.trustPort)) return null;
  const trustMethods = canonicalMethodPort(request.trustPort, ["readPinnedProviderKey"]);
  if (!challengeMethods || !attestationMethods || !trustMethods) {
    return null;
  }

  const challengeTarget = request.challengePort as object;
  const attestationTarget = request.attestationPort as object;
  const trustTarget = request.trustPort as object;

  return Object.freeze({
    challenge: Object.freeze({
      issue: () => (challengeMethods[0] as () => Promise<unknown>).call(challengeTarget),
      consumeIssued: (challengeHex: string) =>
        (challengeMethods[1] as (value: string) => Promise<unknown>).call(
          challengeTarget,
          challengeHex,
        ),
    }),
    attestation: Object.freeze({
      attest: (challengeHex: string) =>
        (attestationMethods[0] as (value: string) => Promise<unknown>).call(
          attestationTarget,
          challengeHex,
        ),
    }),
    trust: Object.freeze({
      readPinnedProviderKey: (providerId: string, platform: NativePlatform, keyId: string) =>
        (
          trustMethods[0] as (
            provider: string,
            targetPlatform: NativePlatform,
            providerKeyId: string,
          ) => Promise<unknown>
        ).call(trustTarget, providerId, platform, keyId),
    }),
  });
}

function canonicalAttestation(value: unknown): CanonicalAttestation | null {
  const record = exactRecord(value, [
    "schemaVersion",
    "kind",
    "keyId",
    "providerId",
    "platform",
    "appIdentifier",
    "appBuildId",
    "challengeHex",
    "issuedAt",
    "expiresAt",
    "capabilitiesJson",
    "signatureHex",
  ]);
  if (
    !record ||
    record.schemaVersion !== HOID_NATIVE_SECURITY_ATTESTATION_SCHEMA_VERSION ||
    record.kind !== HOID_NATIVE_SECURITY_ATTESTATION_KIND ||
    typeof record.keyId !== "string" ||
    !KEY_ID_PATTERN.test(record.keyId) ||
    typeof record.providerId !== "string" ||
    !PROVIDER_ID_PATTERN.test(record.providerId) ||
    (record.platform !== "ios" && record.platform !== "android") ||
    typeof record.appIdentifier !== "string" ||
    !APP_IDENTIFIER_PATTERN.test(record.appIdentifier) ||
    typeof record.appBuildId !== "string" ||
    !APP_BUILD_PATTERN.test(record.appBuildId) ||
    typeof record.challengeHex !== "string" ||
    !CHALLENGE_PATTERN.test(record.challengeHex) ||
    /^0+$/u.test(record.challengeHex) ||
    !isCanonicalIsoTimestamp(record.issuedAt) ||
    !isCanonicalIsoTimestamp(record.expiresAt) ||
    typeof record.capabilitiesJson !== "string" ||
    record.capabilitiesJson.length === 0 ||
    record.capabilitiesJson.length > MAX_CAPABILITIES_JSON_LENGTH ||
    typeof record.signatureHex !== "string" ||
    !HEX_64_PATTERN.test(record.signatureHex)
  ) return null;

  return Object.freeze({
    schemaVersion: HOID_NATIVE_SECURITY_ATTESTATION_SCHEMA_VERSION,
    kind: HOID_NATIVE_SECURITY_ATTESTATION_KIND,
    keyId: record.keyId,
    providerId: record.providerId,
    platform: record.platform,
    appIdentifier: record.appIdentifier,
    appBuildId: record.appBuildId,
    challengeHex: record.challengeHex,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    capabilitiesJson: record.capabilitiesJson,
    signatureHex: record.signatureHex,
  });
}

function canonicalPinnedKey(value: unknown): CanonicalPinnedKey | null {
  const record = exactRecord(value, [
    "keyId",
    "providerId",
    "platform",
    "appIdentifier",
    "publicKeyHex",
  ]);
  if (
    !record ||
    typeof record.keyId !== "string" ||
    !KEY_ID_PATTERN.test(record.keyId) ||
    typeof record.providerId !== "string" ||
    !PROVIDER_ID_PATTERN.test(record.providerId) ||
    (record.platform !== "ios" && record.platform !== "android") ||
    typeof record.appIdentifier !== "string" ||
    !APP_IDENTIFIER_PATTERN.test(record.appIdentifier) ||
    typeof record.publicKeyHex !== "string" ||
    !HEX_32_PATTERN.test(record.publicKeyHex)
  ) return null;

  return Object.freeze({
    keyId: record.keyId,
    providerId: record.providerId,
    platform: record.platform,
    appIdentifier: record.appIdentifier,
    publicKeyHex: record.publicKeyHex,
  });
}

function attestationStatement(attestation: CanonicalAttestation): string {
  return JSON.stringify([
    "hoid-native-conversation-security-attestation-v1",
    attestation.schemaVersion,
    attestation.kind,
    attestation.keyId,
    attestation.providerId,
    attestation.platform,
    attestation.appIdentifier,
    attestation.appBuildId,
    attestation.challengeHex,
    attestation.issuedAt,
    attestation.expiresAt,
    attestation.capabilitiesJson,
  ]);
}

function parseCanonicalCapabilities(value: string): unknown | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      JSON.stringify(parsed) !== value
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}

function validAttestationWindow(attestation: CanonicalAttestation, now: string): boolean {
  const issuedAt = Date.parse(attestation.issuedAt);
  const expiresAt = Date.parse(attestation.expiresAt);
  const current = Date.parse(now);
  return (
    issuedAt <= current &&
    expiresAt > current &&
    expiresAt > issuedAt &&
    current - issuedAt <= MAX_ATTESTATION_AGE_MS &&
    expiresAt - issuedAt <= MAX_ATTESTATION_LIFETIME_MS
  );
}

function blocked(
  reason: Extract<
    HoidNativeSecurityAttestationVerification,
    { status: "blocked" }
  >["reason"],
  readinessReasons?: readonly HoidConversationSecurityReadinessReason[],
): HoidNativeSecurityAttestationVerification {
  return readinessReasons
    ? Object.freeze({ status: "blocked", reason, readinessReasons: Object.freeze([...readinessReasons]) })
    : Object.freeze({ status: "blocked", reason });
}

/**
 * Verifies a fresh, one-use, provider-signed capability statement against a
 * public key pinned by the host out of band. This prevents arbitrary JavaScript
 * capability objects from being treated as sufficient evidence of provider
 * identity. It is still not hardware attestation: the native implementation,
 * pinned key provisioning and platform security claims require independent
 * review and real-device conformance testing.
 */
export async function verifyHoidNativeConversationSecurityProvider(
  requestInput: unknown,
): Promise<HoidNativeSecurityAttestationVerification> {
  const request = canonicalRequest(requestInput);
  if (!request) return blocked("invalid-request");

  const ports = canonicalPorts(request);
  if (!ports) return blocked("invalid-request");

  let issuedChallenge: string | null = null;
  let consumeAttempted = false;

  const consumeChallenge = async (): Promise<boolean | null> => {
    if (issuedChallenge === null || consumeAttempted) return null;
    consumeAttempted = true;
    try {
      return (await ports.challenge.consumeIssued(issuedChallenge)) === true;
    } catch {
      return null;
    }
  };

  try {
    let challengeValue: unknown;
    try {
      challengeValue = await ports.challenge.issue();
    } catch {
      return blocked("challenge-unavailable");
    }
    if (typeof challengeValue === "string") issuedChallenge = challengeValue;
    if (
      typeof challengeValue !== "string" ||
      !CHALLENGE_PATTERN.test(challengeValue) ||
      /^0+$/u.test(challengeValue)
    ) {
      if (issuedChallenge !== null) await consumeChallenge();
      return blocked("challenge-invalid");
    }

    let attestationValue: unknown;
    try {
      attestationValue = await ports.attestation.attest(challengeValue);
    } catch {
      await consumeChallenge();
      return blocked("attestation-unavailable");
    }

    const consumed = await consumeChallenge();
    if (consumed === null) return blocked("challenge-store-unavailable");
    if (!consumed) return blocked("challenge-replayed");

    const attestation = canonicalAttestation(attestationValue);
    if (!attestation) return blocked("invalid-attestation");
    if (attestation.challengeHex !== challengeValue) return blocked("challenge-mismatch");
    if (attestation.appIdentifier !== request.expectedAppIdentifier) {
      return blocked("application-mismatch");
    }
    if (attestation.appBuildId !== request.expectedAppBuildId) {
      return blocked("build-mismatch");
    }
    if (!validAttestationWindow(attestation, request.now)) {
      return blocked("attestation-not-current");
    }

    const capabilities = parseCanonicalCapabilities(attestation.capabilitiesJson);
    if (capabilities === null) return blocked("capability-payload-invalid");

    let pinnedKeyValue: unknown;
    try {
      pinnedKeyValue = await ports.trust.readPinnedProviderKey(
        attestation.providerId,
        attestation.platform,
        attestation.keyId,
      );
    } catch {
      return blocked("trust-unavailable");
    }
    const pinnedKey = canonicalPinnedKey(pinnedKeyValue);
    if (
      !pinnedKey ||
      pinnedKey.keyId !== attestation.keyId ||
      pinnedKey.providerId !== attestation.providerId ||
      pinnedKey.platform !== attestation.platform ||
      pinnedKey.appIdentifier !== attestation.appIdentifier
    ) return blocked("trust-key-mismatch");

    let signatureValid = false;
    try {
      signatureValid = await signatureVerifier.verify({
        publicKeyHex: pinnedKey.publicKeyHex,
        message: attestationStatement(attestation),
        signatureHex: attestation.signatureHex,
      });
    } catch {
      return blocked("signature-invalid");
    }
    if (signatureValid !== true) return blocked("signature-invalid");

    const readiness = evaluateHoidConversationSecurityReadiness(
      capabilities,
      request.runtime,
    );
    if (readiness.status !== "ready") {
      return blocked("readiness-blocked", readiness.reasons);
    }
    if (
      readiness.providerId !== attestation.providerId ||
      readiness.platform !== attestation.platform
    ) return blocked("readiness-blocked", ["provider-mismatch"]);

    return Object.freeze({
      status: "verified",
      providerId: attestation.providerId,
      platform: attestation.platform,
      algorithm: readiness.algorithm,
      capabilitiesFingerprint: sha256Hex(attestation.capabilitiesJson),
      attestationFingerprint: sha256Hex(attestationStatement(attestation)),
      expiresAt: attestation.expiresAt,
    });
  } catch {
    if (issuedChallenge !== null && !consumeAttempted) await consumeChallenge();
    return blocked("attestation-unavailable");
  }
}
