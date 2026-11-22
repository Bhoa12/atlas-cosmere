import { describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { createHoidNobleEd25519VerificationPort } from "./nobleEd25519VerificationAdapter";
import {
  HOID_NATIVE_SECURITY_ATTESTATION_KIND,
  HOID_NATIVE_SECURITY_ATTESTATION_SCHEMA_VERSION,
  verifyHoidNativeConversationSecurityProvider,
} from "./conversationSecurityAttestation";

const PROVIDER_ID = "atlas.hoid.native";
const KEY_ID = "atlas-native-root-2026";
const APP_IDENTIFIER = "com.tfg.atlascosmere";
const APP_BUILD_ID = "2026.11.22.1";
const NOW = "2026-11-22T03:00:30.000Z";
const CHALLENGE = "ab".repeat(32);
const SEED = bytesFromHex("4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb");
const PUBLIC_KEY_HEX = hexFromBytes(ed25519.getPublicKey(SEED));

type MutableRecord = Record<string, unknown>;

function bytesFromHex(value: string): Uint8Array {
  return new Uint8Array(value.match(/.{2}/g)?.map(part => Number.parseInt(part, 16)) ?? []);
}

function hexFromBytes(value: Uint8Array): string {
  return Array.from(value, byte => byte.toString(16).padStart(2, "0")).join("");
}

function capabilities(platform: "ios" | "android" = "ios"): MutableRecord {
  return {
    schemaVersion: 1,
    kind: "hoid-conversation-native-security-capabilities",
    providerId: PROVIDER_ID,
    platform,
    keyVault: {
      providerId: PROVIDER_ID,
      storage: platform === "ios" ? "ios-keychain" : "android-keystore",
      keyMaterial: "non-exportable",
      keyCreation: "native-secure-random",
      retainsPreviousOnRotation: true,
    },
    cipher: {
      providerId: PROVIDER_ID,
      authenticatedEncryption: true,
      keyHandlesOnly: true,
      nonceSource: "native-csprng",
      nonceUniqueness: "enforced-per-key",
      algorithms: ["AES-256-GCM", "CHACHA20-POLY1305"],
    },
    sqlite: {
      sharedConnection: true,
      transactionMode: "exclusive",
    },
  };
}

function statement(value: MutableRecord): string {
  return JSON.stringify([
    "hoid-native-conversation-security-attestation-v1",
    value.schemaVersion,
    value.kind,
    value.keyId,
    value.providerId,
    value.platform,
    value.appIdentifier,
    value.appBuildId,
    value.challengeHex,
    value.issuedAt,
    value.expiresAt,
    value.capabilitiesJson,
  ]);
}

function signedAttestation(
  challengeHex: string,
  overrides: MutableRecord = {},
): MutableRecord {
  const unsigned: MutableRecord = {
    schemaVersion: HOID_NATIVE_SECURITY_ATTESTATION_SCHEMA_VERSION,
    kind: HOID_NATIVE_SECURITY_ATTESTATION_KIND,
    keyId: KEY_ID,
    providerId: PROVIDER_ID,
    platform: "ios",
    appIdentifier: APP_IDENTIFIER,
    appBuildId: APP_BUILD_ID,
    challengeHex,
    issuedAt: "2026-11-22T03:00:00.000Z",
    expiresAt: "2026-11-22T03:01:00.000Z",
    capabilitiesJson: JSON.stringify(capabilities()),
    ...overrides,
  };
  const signature = ed25519.sign(
    new TextEncoder().encode(statement(unsigned)),
    SEED,
  );
  return {
    ...unsigned,
    signatureHex: typeof overrides.signatureHex === "string"
      ? overrides.signatureHex
      : hexFromBytes(signature),
  };
}

type HarnessOptions = Readonly<{
  platform?: "ios" | "android";
  challengeValue?: unknown;
  consumeResult?: boolean;
  consumeThrows?: boolean;
  attestationThrows?: boolean;
  attestationOverrides?: MutableRecord;
  attestationValue?: unknown;
  trustValue?: unknown;
  trustThrows?: boolean;
  verifierResult?: boolean;
  runtimeOverrides?: MutableRecord;
  expectedAppIdentifier?: string;
  expectedAppBuildId?: string;
  now?: string;
}>;

function harness(options: HarnessOptions = {}) {
  const platform = options.platform ?? "ios";
  const expectedChallenge = typeof options.challengeValue === "string"
    ? options.challengeValue
    : CHALLENGE;
  let consumed = false;
  let consumeCalls = 0;

  const challengePort = Object.freeze({
    issue: async () => options.challengeValue ?? CHALLENGE,
    consumeIssued: async (value: string) => {
      consumeCalls += 1;
      if (options.consumeThrows) throw new Error("challenge store unavailable");
      if (options.consumeResult === false || consumed || value !== expectedChallenge) {
        return false;
      }
      consumed = true;
      return true;
    },
  });

  const attestationPort = Object.freeze({
    attest: async (challengeHex: string) => {
      if (options.attestationThrows) throw new Error("native module unavailable");
      return options.attestationValue ??
        signedAttestation(challengeHex, {
          platform,
          ...options.attestationOverrides,
        });
    },
  });

  const trustValue = options.trustValue ?? {
    keyId: KEY_ID,
    providerId: PROVIDER_ID,
    platform,
    appIdentifier: APP_IDENTIFIER,
    publicKeyHex: PUBLIC_KEY_HEX,
  };
  const trustPort = Object.freeze({
    readPinnedProviderKey: async () => {
      if (options.trustThrows) throw new Error("trust anchor unavailable");
      return trustValue;
    },
  });

  const verifier = Object.freeze({
    verify: async request => {
      if (options.verifierResult === false) return false;
      return createHoidNobleEd25519VerificationPort().verify(request);
    },
  });

  const runtime = {
    platform,
    nativeBuild: true,
    secureStorageAvailable: true,
    sqliteTransactionMode: "exclusive",
    ...options.runtimeOverrides,
  };

  const request = {
    challengePort,
    attestationPort,
    trustPort,
    verifier,
    runtime,
    expectedAppIdentifier: options.expectedAppIdentifier ?? APP_IDENTIFIER,
    expectedAppBuildId: options.expectedAppBuildId ?? APP_BUILD_ID,
    now: options.now ?? NOW,
  };

  return {
    request,
    wasConsumed: () => consumed,
    consumeCalls: () => consumeCalls,
  };
}

function reason(result: Awaited<ReturnType<typeof verifyHoidNativeConversationSecurityProvider>>) {
  return result.status === "blocked" ? result.reason : null;
}

describe("Hoid native conversation security attestation", () => {
  it("verifies a fresh iOS provider statement against its pinned Ed25519 key", async () => {
    const test = harness();
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(result.status).toBe("verified");
    if (result.status === "verified") {
      expect(result.providerId).toBe(PROVIDER_ID);
      expect(result.platform).toBe("ios");
      expect(result.algorithm).toBe("AES-256-GCM");
      expect(result.capabilitiesFingerprint).toMatch(/^[a-f0-9]{64}$/u);
      expect(result.attestationFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    }
    expect(test.wasConsumed()).toBe(true);
    expect(test.consumeCalls()).toBe(1);
  });

  it("verifies a fresh Android provider statement", async () => {
    const test = harness({ platform: "android" });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(result.status).toBe("verified");
    if (result.status === "verified") expect(result.platform).toBe("android");
  });

  it("consumes each issued challenge exactly once", async () => {
    const test = harness();
    await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(test.consumeCalls()).toBe(1);
  });

  it("rejects an attestation that answers a different challenge", async () => {
    const test = harness({
      attestationOverrides: { challengeHex: "cd".repeat(32) },
    });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("challenge-mismatch");
    expect(test.wasConsumed()).toBe(true);
  });

  it("rejects a challenge already consumed by another verification", async () => {
    const test = harness({ consumeResult: false });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("challenge-replayed");
  });

  it("fails closed when challenge consumption is unavailable", async () => {
    const test = harness({ consumeThrows: true });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("challenge-store-unavailable");
  });

  it("consumes a challenge when the native attestation call fails", async () => {
    const test = harness({ attestationThrows: true });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("attestation-unavailable");
    expect(test.consumeCalls()).toBe(1);
  });

  it("rejects an invalid challenge and consumes it when it was issued as a string", async () => {
    const test = harness({ challengeValue: "not-a-challenge" });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("challenge-invalid");
    expect(test.consumeCalls()).toBe(1);
  });

  it("rejects malformed attestation objects", async () => {
    const test = harness({ attestationValue: { ...signedAttestation(CHALLENGE), extra: true } });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("invalid-attestation");
  });

  it("rejects invalid Ed25519 signatures", async () => {
    const test = harness({
      attestationOverrides: { signatureHex: "00".repeat(64) },
    });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("signature-invalid");
  });

  it("rejects a pinned key with a different key identifier", async () => {
    const test = harness({
      trustValue: {
        keyId: "another-root",
        providerId: PROVIDER_ID,
        platform: "ios",
        appIdentifier: APP_IDENTIFIER,
        publicKeyHex: PUBLIC_KEY_HEX,
      },
    });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("trust-key-mismatch");
  });

  it("rejects a provider key that is not pinned for the attested application", async () => {
    const test = harness({
      trustValue: {
        keyId: KEY_ID,
        providerId: PROVIDER_ID,
        platform: "ios",
        appIdentifier: "com.example.other",
        publicKeyHex: PUBLIC_KEY_HEX,
      },
    });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("trust-key-mismatch");
  });

  it("rejects a statement for another application identifier", async () => {
    const test = harness({
      attestationOverrides: { appIdentifier: "com.example.other" },
    });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("application-mismatch");
  });

  it("rejects a statement for another native build", async () => {
    const test = harness({ expectedAppBuildId: "2026.11.22.2" });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("build-mismatch");
  });

  it("rejects expired, future-dated and overlong statements", async () => {
    const expired = harness({
      attestationOverrides: {
        issuedAt: "2026-11-22T02:00:00.000Z",
        expiresAt: "2026-11-22T02:01:00.000Z",
      },
    });
    const future = harness({
      attestationOverrides: {
        issuedAt: "2026-11-22T03:01:00.000Z",
        expiresAt: "2026-11-22T03:02:00.000Z",
      },
    });
    const overlong = harness({
      attestationOverrides: {
        issuedAt: "2026-11-22T02:55:00.000Z",
        expiresAt: "2026-11-22T03:05:00.000Z",
      },
    });

    expect(reason(await verifyHoidNativeConversationSecurityProvider(expired.request))).toBe("attestation-not-current");
    expect(reason(await verifyHoidNativeConversationSecurityProvider(future.request))).toBe("attestation-not-current");
    expect(reason(await verifyHoidNativeConversationSecurityProvider(overlong.request))).toBe("attestation-not-current");
  });

  it("rejects non-canonical JSON and duplicate keys in the signed capability payload", async () => {
    const test = harness({
      attestationOverrides: {
        capabilitiesJson: "{\"schemaVersion\":1, \"schemaVersion\":1}",
      },
    });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("capability-payload-invalid");
  });

  it("rejects capability payloads that fail the readiness gate", async () => {
    const unsafe = capabilities();
    (unsafe.keyVault as MutableRecord).keyMaterial = "exportable";
    const test = harness({
      attestationOverrides: { capabilitiesJson: JSON.stringify(unsafe) },
    });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("readiness-blocked");
    if (result.status === "blocked") {
      expect(result.readinessReasons).toContain("exportable-key-material");
    }
  });

  it("rejects a runtime platform that differs from the signed provider platform", async () => {
    const test = harness({ runtimeOverrides: { platform: "android" } });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("readiness-blocked");
  });

  it("rejects an unavailable pinned trust root", async () => {
    const test = harness({ trustThrows: true });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("trust-unavailable");
  });

  it("rejects a verifier that cannot validate the signature", async () => {
    const test = harness({ verifierResult: false });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("signature-invalid");
  });

  it("rejects malformed request objects and extra properties", async () => {
    const test = harness();
    const result = await verifyHoidNativeConversationSecurityProvider({
      ...test.request,
      unexpected: true,
    });
    expect(reason(result)).toBe("invalid-request");
  });

  it("does not execute accessor properties on a hostile challenge port", async () => {
    let invoked = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, "issue", {
      enumerable: true,
      get() {
        invoked = true;
        return async () => CHALLENGE;
      },
    });
    Object.defineProperty(hostile, "consumeIssued", {
      enumerable: true,
      value: async () => true,
    });
    const test = harness();
    const result = await verifyHoidNativeConversationSecurityProvider({
      ...test.request,
      challengePort: hostile,
    });
    expect(reason(result)).toBe("invalid-request");
    expect(invoked).toBe(false);
  });

  it("rejects malformed pinned keys without exposing provider errors", async () => {
    const test = harness({
      trustValue: {
        keyId: KEY_ID,
        providerId: PROVIDER_ID,
        platform: "ios",
        appIdentifier: APP_IDENTIFIER,
        publicKeyHex: "not-a-public-key",
      },
    });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("trust-key-mismatch");
  });

  it("does not claim readiness when the signed capability provider identity differs", async () => {
    const test = harness({
      attestationOverrides: { providerId: "atlas.hoid.other" },
    });
    const result = await verifyHoidNativeConversationSecurityProvider(test.request);
    expect(reason(result)).toBe("trust-key-mismatch");
  });
});
