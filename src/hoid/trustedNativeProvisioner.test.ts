import { describe, expect, it, vi } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  createHoidTrustedNativeProvisioner,
  HoidNativeProvisioningError,
  isHoidTrustedNativeProvisioner,
} from "./trustedNativeProvisioner";
import {
  HOID_NATIVE_SECURITY_ATTESTATION_KIND,
  HOID_NATIVE_SECURITY_ATTESTATION_SCHEMA_VERSION,
} from "./conversationSecurityAttestation";
import {
  createSignedHoidTestTrustRegistry,
  HOID_TEST_TRUST_ROOT_PIN,
  type TestProviderTrustEntry,
} from "./conversationProviderTrustRegistry.testFixtures";

const PROVIDER_ID = "atlas.hoid.native";
const KEY_ID = "atlas-native-root-2026";
const APP_IDENTIFIER = HOID_TEST_TRUST_ROOT_PIN.appIdentifier;
const APP_BUILD_ID = "2026.11.25.1";
const NOW = "2026-11-25T17:00:30.000Z";
const CHALLENGE = "ab".repeat(32);
const PROVIDER_SEED = bytesFromHex("4ccd089b28ff96da9db6c346ec114e0f8b8a319f35aba624da8cf6ed4fb8a6fb");
const PROVIDER_PUBLIC_KEY = hexFromBytes(ed25519.getPublicKey(PROVIDER_SEED));

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

function attestationStatement(value: MutableRecord): string {
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

function signedAttestation(challengeHex: string, overrides: MutableRecord = {}): MutableRecord {
  const unsigned: MutableRecord = {
    schemaVersion: HOID_NATIVE_SECURITY_ATTESTATION_SCHEMA_VERSION,
    kind: HOID_NATIVE_SECURITY_ATTESTATION_KIND,
    keyId: KEY_ID,
    providerId: PROVIDER_ID,
    platform: "ios",
    appIdentifier: APP_IDENTIFIER,
    appBuildId: APP_BUILD_ID,
    challengeHex,
    issuedAt: "2026-11-25T17:00:00.000Z",
    expiresAt: "2026-11-25T17:01:00.000Z",
    capabilitiesJson: JSON.stringify(capabilities()),
    ...overrides,
  };
  const signature = ed25519.sign(
    new TextEncoder().encode(attestationStatement(unsigned)),
    PROVIDER_SEED,
  );
  return {
    ...unsigned,
    signatureHex: typeof overrides.signatureHex === "string"
      ? overrides.signatureHex
      : hexFromBytes(signature),
  };
}

function trustOptions(options: {
  state?: "active" | "revoked";
  sourceThrows?: boolean;
  revisionThrows?: boolean;
} = {}) {
  const entry: TestProviderTrustEntry = {
    keyId: KEY_ID,
    providerId: PROVIDER_ID,
    platform: "ios",
    appIdentifier: APP_IDENTIFIER,
    publicKeyHex: PROVIDER_PUBLIC_KEY,
    state: options.state ?? "active",
  };
  const source = Object.freeze({
    readSignedRegistry: async () => {
      if (options.sourceThrows) throw new Error("registry unavailable");
      return createSignedHoidTestTrustRegistry([entry], 1);
    },
  });
  const revisionStore = Object.freeze({
    readMinimumRevision: async () => {
      if (options.revisionThrows) throw new Error("revision witness unavailable");
      return 1;
    },
    compareAndSetMinimumRevision: async () => true,
  });
  return Object.freeze({ rootPin: HOID_TEST_TRUST_ROOT_PIN, source, revisionStore });
}

function reviewContext() {
  return Object.freeze({
    schemaVersion: 1,
    repositoryFullName: "Bhoa12/atlas-cosmere",
    pullRequestNumber: 315,
    baseRef: "feat/hoid-ia-core-run314",
    baseSha: "4ce052f9872c8e6262f0fe97431bf45e4243c181",
    headRef: "feat/hoid-ia-core-run315",
    headSha: "5".repeat(40),
    promotionManifestPath: "docs/hoid/promotion-manifest.json",
    promotionPlanFingerprint: "a".repeat(64),
    reviewBundleFingerprint: "b".repeat(64),
  });
}

function compositionConfig(
  bindings: { clock: unknown; rootKey: unknown; context: unknown; verifier: unknown },
  overrides: MutableRecord = {},
): MutableRecord {
  return {
    transport: async () => Object.freeze({ selectedClaimIds: [] }),
    packageSource: Object.freeze({ load: async () => null, subscribe: () => () => {} }),
    registrySource: Object.freeze({ load: async () => null }),
    checkpointStore: Object.freeze({
      read: async () => null,
      compareAndSwap: async () => false,
      subscribe: () => () => {},
    }),
    clock: bindings.clock,
    context: bindings.context,
    rootKey: bindings.rootKey,
    verifier: bindings.verifier,
    ...overrides,
  };
}

function harness(options: {
  attestationOverrides?: MutableRecord;
  runtimeOverrides?: MutableRecord;
  trust?: ReturnType<typeof trustOptions>;
  challengeValue?: unknown;
  consumeResult?: boolean;
  abortDuringAttestation?: AbortController;
  abortDuringConfig?: AbortController;
  configOverrides?: MutableRecord;
  clockValue?: string;
} = {}) {
  let consumed = false;
  const challengePort = Object.freeze({
    issue: vi.fn(async () => options.challengeValue ?? CHALLENGE),
    consumeIssued: vi.fn(async (value: string) => {
      if (options.consumeResult === false || consumed || value !== CHALLENGE) return false;
      consumed = true;
      return true;
    }),
  });
  const attestationPort = Object.freeze({
    attest: vi.fn(async (challengeHex: string) => {
      options.abortDuringAttestation?.abort();
      return signedAttestation(challengeHex, options.attestationOverrides);
    }),
  });
  const clock = Object.freeze({ nowIso: () => options.clockValue ?? NOW });
  const rootKey = Object.freeze({ keyId: "editorial-root-2026", publicKeyHex: "c".repeat(64) });
  const context = reviewContext();
  const loadCompositionConfig = vi.fn(async (
    _signal: AbortSignal,
    bindings: { clock: unknown; rootKey: unknown; context: unknown; verifier: unknown },
  ) => {
    options.abortDuringConfig?.abort();
    return compositionConfig(bindings, options.configOverrides);
  });
  const runtime = Object.freeze({
    platform: "ios",
    nativeBuild: true,
    secureStorageAvailable: true,
    sqliteTransactionMode: "exclusive",
    ...options.runtimeOverrides,
  });
  const provisioner = createHoidTrustedNativeProvisioner({
    trustRegistryOptions: options.trust ?? trustOptions(),
    challengePort,
    attestationPort,
    runtime,
    expectedAppIdentifier: APP_IDENTIFIER,
    expectedAppBuildId: APP_BUILD_ID,
    clock,
    rootKey,
    context,
    loadCompositionConfig,
  });
  return {
    provisioner,
    challengePort,
    attestationPort,
    loadCompositionConfig,
    consumed: () => consumed,
  };
}

describe("Hoid trusted native composition provisioner", () => {
  it("creates a branded provisioner and exposes a one-key Expo adapter", () => {
    const test = harness();
    expect(test.provisioner).not.toBeNull();
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    expect(isHoidTrustedNativeProvisioner(test.provisioner)).toBe(true);
    expect(Reflect.ownKeys(test.provisioner.expoProvisioner)).toEqual(["loadCompositionConfig"]);
    expect(Object.isFrozen(test.provisioner.expoProvisioner)).toBe(true);
  });

  it("verifies native attestation before the editorial loader is called", async () => {
    const test = harness();
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    const result = await test.provisioner.preflight(new AbortController().signal);
    expect(result.status).toBe("verified");
    expect(test.loadCompositionConfig).not.toHaveBeenCalled();
    expect(test.consumed()).toBe(true);
  });

  it("returns composition config only after a fresh native attestation", async () => {
    const test = harness();
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    const config = await test.provisioner.expoProvisioner.loadCompositionConfig(
      new AbortController().signal,
    ) as MutableRecord;
    expect(config.clock).toBeDefined();
    expect(config.rootKey).toBeDefined();
    expect(config.context).toBeDefined();
    expect(config.verifier).toBeDefined();
    expect(test.loadCompositionConfig).toHaveBeenCalledTimes(1);
  });

  it("does not call the editorial loader when the provider signature is invalid", async () => {
    const test = harness({ attestationOverrides: { signatureHex: "00".repeat(64) } });
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    const result = await test.provisioner.preflight(new AbortController().signal);
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") expect(result.verification?.reason).toBe("signature-invalid");
    expect(test.loadCompositionConfig).not.toHaveBeenCalled();
  });

  it("rejects a replayed one-use native challenge", async () => {
    const test = harness({ consumeResult: false });
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    const result = await test.provisioner.preflight(new AbortController().signal);
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") expect(result.verification?.reason).toBe("challenge-replayed");
    expect(test.loadCompositionConfig).not.toHaveBeenCalled();
  });

  it("rejects a revoked native provider key", async () => {
    const test = harness({ trust: trustOptions({ state: "revoked" }) });
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    const result = await test.provisioner.preflight(new AbortController().signal);
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") expect(result.verification?.reason).toBe("trust-key-mismatch");
  });

  it("rejects an unavailable monotonic revision witness", async () => {
    const test = harness({ trust: trustOptions({ revisionThrows: true }) });
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    const result = await test.provisioner.preflight(new AbortController().signal);
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") expect(result.verification?.reason).toBe("trust-unavailable");
  });

  it("rejects native capabilities that fail the secure-storage readiness gate", async () => {
    const unsafe = capabilities();
    (unsafe.keyVault as MutableRecord).keyMaterial = "exportable";
    const test = harness({
      attestationOverrides: { capabilitiesJson: JSON.stringify(unsafe) },
    });
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    const result = await test.provisioner.preflight(new AbortController().signal);
    expect(result.status).toBe("blocked");
    if (result.status === "blocked" && result.verification?.reason === "readiness-blocked") {
      expect(result.verification.readinessReasons).toContain("exportable-key-material");
    } else {
      throw new Error("Expected readiness-blocked");
    }
  });

  it("rejects an attestation for a different application build", async () => {
    const test = harness({ attestationOverrides: { appBuildId: "2026.11.24.1" } });
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    const result = await test.provisioner.preflight(new AbortController().signal);
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") expect(result.verification?.reason).toBe("build-mismatch");
  });

  it("does not issue a challenge after caller cancellation", async () => {
    const test = harness();
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    const controller = new AbortController();
    controller.abort();
    expect(await test.provisioner.preflight(controller.signal)).toEqual({
      status: "blocked",
      reason: "aborted",
    });
    expect(test.challengePort.issue).not.toHaveBeenCalled();
  });

  it("does not load editorial sources when cancellation arrives during attestation", async () => {
    const controller = new AbortController();
    const test = harness({ abortDuringAttestation: controller });
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    expect(await test.provisioner.preflight(controller.signal)).toEqual({
      status: "blocked",
      reason: "aborted",
    });
    expect(test.loadCompositionConfig).not.toHaveBeenCalled();
  });

  it("rejects a non-canonical clock before issuing a challenge", async () => {
    const test = harness({ clockValue: "not-a-date" });
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    expect(await test.provisioner.preflight(new AbortController().signal)).toEqual({
      status: "blocked",
      reason: "clock-unavailable",
    });
    expect(test.challengePort.issue).not.toHaveBeenCalled();
  });

  it("rejects a composition config that substitutes the build-pinned root key", async () => {
    const test = harness({
      configOverrides: {
        rootKey: Object.freeze({ keyId: "attacker-root", publicKeyHex: "d".repeat(64) }),
      },
    });
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    await expect(test.provisioner.expoProvisioner.loadCompositionConfig(
      new AbortController().signal,
    )).rejects.toMatchObject({ reason: "invalid-composition-config" });
  });

  it("rejects a composition config that substitutes the verifier", async () => {
    const test = harness({
      configOverrides: { verifier: Object.freeze({ verify: async () => true }) },
    });
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    await expect(test.provisioner.expoProvisioner.loadCompositionConfig(
      new AbortController().signal,
    )).rejects.toBeInstanceOf(HoidNativeProvisioningError);
  });

  it("rejects unexpected properties and accessors without executing getters", async () => {
    const test = harness({ configOverrides: { unexpected: true } });
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    await expect(test.provisioner.expoProvisioner.loadCompositionConfig(
      new AbortController().signal,
    )).rejects.toMatchObject({ reason: "invalid-composition-config" });

    let getterCalled = false;
    const accessorTest = harness();
    if (!accessorTest.provisioner) throw new Error("Provisioner unavailable");
    accessorTest.loadCompositionConfig.mockImplementation(async (_signal, bindings) => {
      const value = compositionConfig(bindings);
      Object.defineProperty(value, "unexpected", {
        enumerable: true,
        get() {
          getterCalled = true;
          return true;
        },
      });
      return value;
    });
    await expect(accessorTest.provisioner.expoProvisioner.loadCompositionConfig(
      new AbortController().signal,
    )).rejects.toMatchObject({ reason: "invalid-composition-config" });
    expect(getterCalled).toBe(false);
  });

  it("aborts if cancellation occurs while editorial sources are loading", async () => {
    const controller = new AbortController();
    const test = harness({ abortDuringConfig: controller });
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    await expect(test.provisioner.expoProvisioner.loadCompositionConfig(controller.signal))
      .rejects.toMatchObject({ reason: "aborted" });
  });

  it("requires the native trust root application identifier to match the build", () => {
    const test = harness();
    if (!test.provisioner) throw new Error("Provisioner unavailable");
    const invalid = createHoidTrustedNativeProvisioner({
      trustRegistryOptions: trustOptions(),
      challengePort: test.challengePort,
      attestationPort: test.attestationPort,
      runtime: {
        platform: "ios",
        nativeBuild: true,
        secureStorageAvailable: true,
        sqliteTransactionMode: "exclusive",
      },
      expectedAppIdentifier: "com.other.application",
      expectedAppBuildId: APP_BUILD_ID,
      clock: Object.freeze({ nowIso: () => NOW }),
      rootKey: Object.freeze({ keyId: "editorial-root-2026", publicKeyHex: "c".repeat(64) }),
      context: reviewContext(),
      loadCompositionConfig: async () => ({}),
    });
    expect(invalid).toBeNull();
  });
});
