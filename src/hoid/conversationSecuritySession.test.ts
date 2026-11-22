import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { createHoidTestNativeSecurityTrustPort } from "./conversationProviderTrustRegistry.testFixtures";
import {
  HOID_NATIVE_SECURITY_ATTESTATION_KIND,
  HOID_NATIVE_SECURITY_ATTESTATION_SCHEMA_VERSION,
} from "./conversationSecurityAttestation";
import {
  HOID_CONVERSATION_STORAGE_RECORD_KIND,
  HOID_CONVERSATION_STORAGE_SCHEMA_VERSION,
  type HoidConversationHistoryStorePort,
} from "./conversationHistoryStorePort";
import { createHoidConversationHistorySnapshot } from "./conversationHistoryHydration";
import {
  createHoidConversationSecuritySession,
  isHoidConversationSecuritySessionUsable,
  loadHoidConversationHistoryWithSecuritySession,
  revokeHoidConversationSecuritySession,
  saveHoidConversationHistoryWithSecuritySession,
  type HoidConversationSecuritySession,
} from "./conversationSecuritySession";

const PROVIDER_ID = "atlas.hoid.native";
const KEY_ID = "atlas-native-root-2026";
const APP_IDENTIFIER = "com.tfg.atlascosmere";
const APP_BUILD_ID = "2026.11.22.1";
const NOW = "2026-11-22T03:00:30.000Z";
const CHALLENGE = "ab".repeat(32);
const SEED = bytesFromHex("4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb");
const PUBLIC_KEY_HEX = hexFromBytes(ed25519.getPublicKey(SEED));
const scope = Object.freeze({ revision: 21, fingerprint: "a".repeat(64) });
const key = Object.freeze({
  principalId: "hlp1_" + "c".repeat(48),
  conversationId: "conversation-1",
});
let monotonicTime = 1_000;

function bytesFromHex(value: string): Uint8Array {
  return new Uint8Array(value.match(/.{2}/g)?.map(part => Number.parseInt(part, 16)) ?? []);
}

function hexFromBytes(value: Uint8Array): string {
  return Array.from(value, byte => byte.toString(16).padStart(2, "0")).join("");
}

function capabilities(platform: "ios" | "android") {
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

function signedStatement(value: Record<string, unknown>): string {
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

function makeAttestation(challengeHex: string, platform: "ios" | "android") {
  const unsigned: Record<string, unknown> = {
    schemaVersion: HOID_NATIVE_SECURITY_ATTESTATION_SCHEMA_VERSION,
    kind: HOID_NATIVE_SECURITY_ATTESTATION_KIND,
    keyId: KEY_ID,
    providerId: PROVIDER_ID,
    platform,
    appIdentifier: APP_IDENTIFIER,
    appBuildId: APP_BUILD_ID,
    challengeHex,
    issuedAt: "2026-11-22T03:00:00.000Z",
    expiresAt: "2026-11-22T03:02:00.000Z",
    capabilitiesJson: JSON.stringify(capabilities(platform)),
  };
  return {
    ...unsigned,
    signatureHex: hexFromBytes(
      ed25519.sign(new TextEncoder().encode(signedStatement(unsigned)), SEED),
    ),
  };
}

function request(platform: "ios" | "android" = "ios") {
  let consumed = false;
  return {
    challengePort: Object.freeze({
      issue: async () => CHALLENGE,
      consumeIssued: async (value: string) => {
        if (consumed || value !== CHALLENGE) return false;
        consumed = true;
        return true;
      },
    }),
    attestationPort: Object.freeze({
      attest: async (value: string) => makeAttestation(value, platform),
    }),
    trustPort: createHoidTestNativeSecurityTrustPort({
      entry: {
        keyId: KEY_ID,
        providerId: PROVIDER_ID,
        platform,
        appIdentifier: APP_IDENTIFIER,
        publicKeyHex: PUBLIC_KEY_HEX,
      },
    }),
    runtime: {
      platform,
      nativeBuild: true,
      secureStorageAvailable: true,
      sqliteTransactionMode: "exclusive",
    },
    expectedAppIdentifier: APP_IDENTIFIER,
    expectedAppBuildId: APP_BUILD_ID,
  };
}

function context(platform: "ios" | "android" = "ios") {
  return Object.freeze({
    appIdentifier: APP_IDENTIFIER,
    appBuildId: APP_BUILD_ID,
    platform,
  });
}

async function createSession(platform: "ios" | "android" = "ios") {
  return createHoidConversationSecuritySession(request(platform));
}

function snapshot() {
  const result = createHoidConversationHistorySnapshot([
    { id: "user-1", emisor: "usuario" as const, texto: "¿Qué he leído?" },
  ], scope);
  if (result.status !== "ready") throw new Error("test snapshot invalid");
  return result.snapshot;
}

function storedRecord() {
  return Object.freeze({
    schemaVersion: HOID_CONVERSATION_STORAGE_SCHEMA_VERSION,
    kind: HOID_CONVERSATION_STORAGE_RECORD_KIND,
    principalId: key.principalId,
    conversationId: key.conversationId,
    storageRevision: 1,
    snapshot: snapshot(),
  });
}

function store(
  read: HoidConversationHistoryStorePort["read"] = async () => storedRecord(),
  compareAndSwap: HoidConversationHistoryStorePort["compareAndSwap"] = async () => "saved",
): HoidConversationHistoryStorePort {
  return Object.freeze({ read, compareAndSwap });
}

describe("Hoid verified conversation security sessions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    monotonicTime = 1_000;
    vi.stubGlobal("performance", { now: () => monotonicTime });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("issues a process-local session only after a valid iOS attestation", async () => {
    const result = await createSession();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.providerId).toBe(PROVIDER_ID);
    expect(result.platform).toBe("ios");
    expect(result.algorithm).toBe("AES-256-GCM");
    expect(isHoidConversationSecuritySessionUsable(result.session, context())).toBe(true);
    expect(Reflect.ownKeys(result.session)).toEqual([]);
  });

  it("issues a process-local session for a valid Android attestation", async () => {
    const result = await createSession("android");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(isHoidConversationSecuritySessionUsable(result.session, context("android"))).toBe(true);
  });

  it("does not issue a session when the provider attestation is invalid", async () => {
    const input = request();
    const invalid = Object.freeze({
      ...input,
      attestationPort: Object.freeze({ attest: async () => ({ malformed: true }) }),
    });
    const result = await createHoidConversationSecuritySession(invalid);
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") expect(result.reason).toBe("verification-failed");
  });

  it("rejects malformed requests before contacting the provider", async () => {
    const result = await createHoidConversationSecuritySession({
      ...request(),
      unexpected: true,
    });
    expect(result).toEqual({ status: "blocked", reason: "invalid-request" });
  });

  it("cannot be forged by copying the public result shape", async () => {
    const result = await createSession();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const forged = Object.freeze(Object.create(null)) as HoidConversationSecuritySession;
    expect(isHoidConversationSecuritySessionUsable(forged, context())).toBe(false);
  });

  it("rejects a session bound to another application build", async () => {
    const result = await createSession();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(isHoidConversationSecuritySessionUsable(result.session, {
      ...context(),
      appBuildId: "different-build",
    })).toBe(false);
  });

  it("rejects a session bound to another platform", async () => {
    const result = await createSession();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(isHoidConversationSecuritySessionUsable(result.session, context("android"))).toBe(false);
  });

  it("expires the session at the signed attestation expiry", async () => {
    const result = await createSession();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    vi.setSystemTime(new Date("2026-11-22T03:02:00.000Z"));
    expect(isHoidConversationSecuritySessionUsable(result.session, context())).toBe(false);
  });

  it("does not extend a session when the device wall clock is rolled back", async () => {
    const result = await createSession();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    vi.setSystemTime(new Date("2026-11-22T02:59:30.000Z"));
    monotonicTime += 90_000;
    expect(Date.now()).toBe(Date.parse("2026-11-22T02:59:30.000Z"));
    expect(isHoidConversationSecuritySessionUsable(result.session, context())).toBe(false);
  });

  it("revokes a session and rejects all subsequent checks", async () => {
    const result = await createSession();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(revokeHoidConversationSecuritySession(result.session)).toBe(true);
    expect(isHoidConversationSecuritySessionUsable(result.session, context())).toBe(false);
    expect(revokeHoidConversationSecuritySession(result.session)).toBe(false);
  });

  it("loads messages only while the verified session remains current", async () => {
    const result = await createSession();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const loaded = await loadHoidConversationHistoryWithSecuritySession(
      result.session,
      context(),
      store(),
      key,
      scope,
    );
    expect(loaded.status).toBe("ready");
    if (loaded.status === "ready") expect(loaded.messages).toHaveLength(1);
  });

  it("discards loaded messages if the session expires during the asynchronous read", async () => {
    const result = await createSession();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const delayedStore = store(async () => {
      vi.setSystemTime(new Date("2026-11-22T03:02:01.000Z"));
      return storedRecord();
    });
    const loaded = await loadHoidConversationHistoryWithSecuritySession(
      result.session,
      context(),
      delayedStore,
      key,
      scope,
    );
    expect(loaded).toEqual({ status: "security-blocked", reason: "session-expired" });
  });

  it("does not call the store when the session is forged", async () => {
    let reads = 0;
    const guardedStore = store(async () => {
      reads += 1;
      return storedRecord();
    });
    const loaded = await loadHoidConversationHistoryWithSecuritySession(
      Object.freeze({}),
      context(),
      guardedStore,
      key,
      scope,
    );
    expect(loaded).toEqual({ status: "security-blocked", reason: "invalid-session" });
    expect(reads).toBe(0);
  });

  it("does not write when the session has been revoked", async () => {
    const result = await createSession();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    revokeHoidConversationSecuritySession(result.session);
    let writes = 0;
    const guardedStore = store(undefined, async () => {
      writes += 1;
      return "saved";
    });
    const saved = await saveHoidConversationHistoryWithSecuritySession(
      result.session,
      context(),
      guardedStore,
      key,
      null,
      snapshot(),
      scope,
    );
    expect(saved).toEqual({ status: "security-blocked", reason: "invalid-session" });
    expect(writes).toBe(0);
  });

  it("saves through the existing progress-bound CAS path while the session is current", async () => {
    const result = await createSession();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    let writes = 0;
    const guardedStore = store(undefined, async () => {
      writes += 1;
      return "saved";
    });
    const saved = await saveHoidConversationHistoryWithSecuritySession(
      result.session,
      context(),
      guardedStore,
      key,
      null,
      snapshot(),
      scope,
    );
    expect(saved).toEqual({ status: "saved", storageRevision: 1 });
    expect(writes).toBe(1);
  });

  it("blocks storage operations when the caller's runtime identity is malformed", async () => {
    const result = await createSession();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const loaded = await loadHoidConversationHistoryWithSecuritySession(
      result.session,
      { ...context(), extra: true },
      store(),
      key,
      scope,
    );
    expect(loaded).toEqual({ status: "security-blocked", reason: "runtime-mismatch" });
  });
});
