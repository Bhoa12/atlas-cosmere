import { describe, expect, it } from "vitest";
import {
  HOID_CONVERSATION_SECURITY_CAPABILITIES_KIND,
  HOID_CONVERSATION_SECURITY_CAPABILITIES_SCHEMA_VERSION,
  evaluateHoidConversationSecurityReadiness,
} from "./conversationSecurityReadiness";

type MutableRecord = Record<string, unknown>;
type NativePlatform = "ios" | "android";

const PROVIDER_ID = "atlas.hoid.native";

function validCapabilities(platform: NativePlatform = "ios"): MutableRecord {
  return {
    schemaVersion: HOID_CONVERSATION_SECURITY_CAPABILITIES_SCHEMA_VERSION,
    kind: HOID_CONVERSATION_SECURITY_CAPABILITIES_KIND,
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

function validRuntime(
  platform: "ios" | "android" | "web" = "ios",
  overrides: MutableRecord = {},
): MutableRecord {
  return {
    platform,
    nativeBuild: true,
    secureStorageAvailable: true,
    sqliteTransactionMode: "exclusive",
    ...overrides,
  };
}

function nested(
  input: MutableRecord,
  parent: string,
): MutableRecord {
  return input[parent] as MutableRecord;
}

function reasons(result: ReturnType<typeof evaluateHoidConversationSecurityReadiness>) {
  return result.status === "blocked" ? result.reasons : [];
}

describe("Hoid conversation security readiness", () => {
  it("accepts a complete iOS native security stack", () => {
    expect(
      evaluateHoidConversationSecurityReadiness(
        validCapabilities("ios"),
        validRuntime("ios"),
      ),
    ).toEqual({
      status: "ready",
      providerId: PROVIDER_ID,
      platform: "ios",
      algorithm: "AES-256-GCM",
    });
  });

  it("accepts a complete Android native security stack", () => {
    expect(
      evaluateHoidConversationSecurityReadiness(
        validCapabilities("android"),
        validRuntime("android"),
      ),
    ).toEqual({
      status: "ready",
      providerId: PROVIDER_ID,
      platform: "android",
      algorithm: "AES-256-GCM",
    });
  });

  it("selects the preferred common algorithm deterministically", () => {
    const capabilities = validCapabilities();
    nested(capabilities, "cipher").algorithms = [
      "XCHACHA20-POLY1305",
      "CHACHA20-POLY1305",
      "AES-256-GCM",
    ];

    const result = evaluateHoidConversationSecurityReadiness(
      capabilities,
      validRuntime(),
    );

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.algorithm).toBe("AES-256-GCM");
    }
  });

  it("blocks web even when a native provider declaration is supplied", () => {
    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          validCapabilities(),
          validRuntime("web"),
        ),
      ),
    ).toContain("unsupported-platform");
  });

  it("blocks a runtime and capability platform mismatch", () => {
    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          validCapabilities("ios"),
          validRuntime("android"),
        ),
      ),
    ).toContain("platform-mismatch");
  });

  it("requires a native build containing the native security module", () => {
    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          validCapabilities(),
          validRuntime("ios", { nativeBuild: false }),
        ),
      ),
    ).toContain("native-build-required");
  });

  it("blocks when secure storage is unavailable", () => {
    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          validCapabilities(),
          validRuntime("ios", { secureStorageAvailable: false }),
        ),
      ),
    ).toContain("secure-storage-unavailable");
  });

  it("requires the vault and cipher to share one provider identity", () => {
    const capabilities = validCapabilities();
    nested(capabilities, "cipher").providerId = "another.crypto.provider";

    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          capabilities,
          validRuntime(),
        ),
      ),
    ).toContain("provider-mismatch");
  });

  it("requires the platform-specific secure key store", () => {
    const capabilities = validCapabilities("android");
    nested(capabilities, "keyVault").storage = "ios-keychain";

    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          capabilities,
          validRuntime("android"),
        ),
      ),
    ).toContain("key-storage-mismatch");
  });

  it("rejects exportable key material", () => {
    const capabilities = validCapabilities();
    nested(capabilities, "keyVault").keyMaterial = "exportable";

    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          capabilities,
          validRuntime(),
        ),
      ),
    ).toContain("exportable-key-material");
  });

  it("requires native secure key generation", () => {
    const capabilities = validCapabilities();
    nested(capabilities, "keyVault").keyCreation = "javascript-random";

    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          capabilities,
          validRuntime(),
        ),
      ),
    ).toContain("native-key-generation-required");
  });

  it("requires retention of prior keys for historical decryption", () => {
    const capabilities = validCapabilities();
    nested(capabilities, "keyVault").retainsPreviousOnRotation = false;

    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          capabilities,
          validRuntime(),
        ),
      ),
    ).toContain("previous-key-retention-required");
  });

  it("requires authenticated encryption", () => {
    const capabilities = validCapabilities();
    nested(capabilities, "cipher").authenticatedEncryption = false;

    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          capabilities,
          validRuntime(),
        ),
      ),
    ).toContain("authenticated-encryption-required");
  });

  it("does not permit raw key bytes across the provider boundary", () => {
    const capabilities = validCapabilities();
    nested(capabilities, "cipher").keyHandlesOnly = false;

    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          capabilities,
          validRuntime(),
        ),
      ),
    ).toContain("opaque-key-handle-boundary-required");
  });

  it("requires a native cryptographically secure nonce source", () => {
    const capabilities = validCapabilities();
    nested(capabilities, "cipher").nonceSource = "javascript-random";

    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          capabilities,
          validRuntime(),
        ),
      ),
    ).toContain("native-csprng-required");
  });

  it("requires per-key nonce uniqueness enforcement", () => {
    const capabilities = validCapabilities();
    nested(capabilities, "cipher").nonceUniqueness = "best-effort";

    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          capabilities,
          validRuntime(),
        ),
      ),
    ).toContain("nonce-uniqueness-required");
  });

  it("blocks an empty AEAD algorithm capability set", () => {
    const capabilities = validCapabilities();
    nested(capabilities, "cipher").algorithms = [];

    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          capabilities,
          validRuntime(),
        ),
      ),
    ).toContain("no-common-aead-algorithm");
  });

  it("requires the shared Atlas SQLite connection", () => {
    const capabilities = validCapabilities();
    nested(capabilities, "sqlite").sharedConnection = false;

    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          capabilities,
          validRuntime(),
        ),
      ),
    ).toContain("shared-sqlite-connection-required");
  });

  it("requires exclusive transactions from both provider and runtime", () => {
    const capabilities = validCapabilities();
    nested(capabilities, "sqlite").transactionMode = "deferred";

    const result = evaluateHoidConversationSecurityReadiness(
      capabilities,
      validRuntime("ios", { sqliteTransactionMode: "deferred" }),
    );

    expect(reasons(result)).toContain("exclusive-sqlite-transaction-required");
  });

  it("rejects unknown algorithms and duplicate algorithm declarations", () => {
    const unknown = validCapabilities();
    nested(unknown, "cipher").algorithms = ["AES-128-CBC"];

    const duplicate = validCapabilities();
    nested(duplicate, "cipher").algorithms = [
      "AES-256-GCM",
      "AES-256-GCM",
    ];

    expect(
      reasons(evaluateHoidConversationSecurityReadiness(unknown, validRuntime())),
    ).toContain("invalid-capabilities");
    expect(
      reasons(evaluateHoidConversationSecurityReadiness(duplicate, validRuntime())),
    ).toContain("invalid-capabilities");
  });

  it("rejects sparse capability arrays", () => {
    const capabilities = validCapabilities();
    nested(capabilities, "cipher").algorithms = new Array(1);

    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          capabilities,
          validRuntime(),
        ),
      ),
    ).toContain("invalid-capabilities");
  });

  it("rejects getters without executing them", () => {
    const capabilities = validCapabilities();
    let getterCalls = 0;
    Object.defineProperty(capabilities, "providerId", {
      enumerable: true,
      configurable: true,
      get: () => {
        getterCalls += 1;
        return PROVIDER_ID;
      },
    });

    const result = evaluateHoidConversationSecurityReadiness(
      capabilities,
      validRuntime(),
    );

    expect(reasons(result)).toContain("invalid-capabilities");
    expect(getterCalls).toBe(0);
  });

  it("rejects inherited capability objects", () => {
    const capabilities = Object.assign(
      Object.create({ inherited: true }) as MutableRecord,
      validCapabilities(),
    );

    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          capabilities,
          validRuntime(),
        ),
      ),
    ).toContain("invalid-capabilities");
  });

  it("rejects malformed runtime objects", () => {
    expect(
      reasons(
        evaluateHoidConversationSecurityReadiness(
          validCapabilities(),
          { platform: "ios", nativeBuild: true },
        ),
      ),
    ).toContain("invalid-runtime");
  });

  it("returns a frozen readiness result and does not mutate provider input", () => {
    const capabilities = validCapabilities();
    const before = JSON.stringify(capabilities);
    const result = evaluateHoidConversationSecurityReadiness(
      capabilities,
      validRuntime(),
    );

    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(capabilities)).toBe(before);
  });
});
