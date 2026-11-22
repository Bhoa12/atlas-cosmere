export const HOID_CONVERSATION_SECURITY_CAPABILITIES_SCHEMA_VERSION = 1 as const;
export const HOID_CONVERSATION_SECURITY_CAPABILITIES_KIND =
  "hoid-conversation-native-security-capabilities" as const;

export const HOID_CONVERSATION_SECURITY_ALGORITHMS = [
  "AES-256-GCM",
  "CHACHA20-POLY1305",
  "XCHACHA20-POLY1305",
] as const;

export type HoidConversationSecurityAlgorithm =
  (typeof HOID_CONVERSATION_SECURITY_ALGORITHMS)[number];

export type HoidConversationSecurityReadinessReason =
  | "invalid-capabilities"
  | "invalid-runtime"
  | "unsupported-platform"
  | "platform-mismatch"
  | "native-build-required"
  | "secure-storage-unavailable"
  | "provider-mismatch"
  | "key-storage-mismatch"
  | "exportable-key-material"
  | "native-key-generation-required"
  | "previous-key-retention-required"
  | "authenticated-encryption-required"
  | "opaque-key-handle-boundary-required"
  | "native-csprng-required"
  | "nonce-uniqueness-required"
  | "no-common-aead-algorithm"
  | "shared-sqlite-connection-required"
  | "exclusive-sqlite-transaction-required";

export type HoidConversationSecurityReadiness =
  | Readonly<{
      status: "ready";
      providerId: string;
      platform: "ios" | "android";
      algorithm: HoidConversationSecurityAlgorithm;
    }>
  | Readonly<{
      status: "blocked";
      reasons: readonly HoidConversationSecurityReadinessReason[];
    }>;

type DataRecord = Record<string, unknown>;

type CanonicalCapabilities = Readonly<{
  schemaVersion: typeof HOID_CONVERSATION_SECURITY_CAPABILITIES_SCHEMA_VERSION;
  kind: typeof HOID_CONVERSATION_SECURITY_CAPABILITIES_KIND;
  providerId: string;
  platform: "ios" | "android";
  keyVault: Readonly<{
    providerId: string;
    storage: "ios-keychain" | "android-keystore";
    keyMaterial: "non-exportable";
    keyCreation: "native-secure-random";
    retainsPreviousOnRotation: true;
  }>;
  cipher: Readonly<{
    providerId: string;
    authenticatedEncryption: true;
    keyHandlesOnly: true;
    nonceSource: "native-csprng";
    nonceUniqueness: "enforced-per-key";
    algorithms: readonly HoidConversationSecurityAlgorithm[];
  }>;
  sqlite: Readonly<{
    sharedConnection: true;
    transactionMode: "exclusive";
  }>;
}>;

type CanonicalRuntime = Readonly<{
  platform: "ios" | "android" | "web";
  nativeBuild: boolean;
  secureStorageAvailable: boolean;
  sqliteTransactionMode: "exclusive" | "deferred" | "unavailable";
}>;

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
): DataRecord | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.length) return null;

    const result = Object.create(null) as DataRecord;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
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

function canonicalAlgorithms(
  value: unknown,
): readonly HoidConversationSecurityAlgorithm[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return null;
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: HoidConversationSecurityAlgorithm[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      const algorithm = descriptor.value;
      if (
        typeof algorithm !== "string" ||
        !HOID_CONVERSATION_SECURITY_ALGORITHMS.includes(
          algorithm as HoidConversationSecurityAlgorithm,
        ) ||
        result.includes(algorithm as HoidConversationSecurityAlgorithm)
      ) return null;
      result.push(algorithm as HoidConversationSecurityAlgorithm);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function parseCapabilities(value: unknown): CanonicalCapabilities | null {
  const record = canonicalRecord(value, [
    "schemaVersion",
    "kind",
    "providerId",
    "platform",
    "keyVault",
    "cipher",
    "sqlite",
  ]);
  if (
    !record ||
    record.schemaVersion !== HOID_CONVERSATION_SECURITY_CAPABILITIES_SCHEMA_VERSION ||
    record.kind !== HOID_CONVERSATION_SECURITY_CAPABILITIES_KIND ||
    typeof record.providerId !== "string" ||
    !/^[a-z][a-z0-9.-]{2,63}$/u.test(record.providerId) ||
    (record.platform !== "ios" && record.platform !== "android")
  ) return null;

  const keyVault = canonicalRecord(record.keyVault, [
    "providerId",
    "storage",
    "keyMaterial",
    "keyCreation",
    "retainsPreviousOnRotation",
  ]);
  const cipher = canonicalRecord(record.cipher, [
    "providerId",
    "authenticatedEncryption",
    "keyHandlesOnly",
    "nonceSource",
    "nonceUniqueness",
    "algorithms",
  ]);
  const sqlite = canonicalRecord(record.sqlite, [
    "sharedConnection",
    "transactionMode",
  ]);
  if (!keyVault || !cipher || !sqlite) return null;

  const algorithms = canonicalAlgorithms(cipher.algorithms);
  if (!algorithms || algorithms.length === 0) return null;

  const expectedStorage = record.platform === "ios"
    ? "ios-keychain"
    : "android-keystore";

  return Object.freeze({
    schemaVersion: HOID_CONVERSATION_SECURITY_CAPABILITIES_SCHEMA_VERSION,
    kind: HOID_CONVERSATION_SECURITY_CAPABILITIES_KIND,
    providerId: record.providerId,
    platform: record.platform,
    keyVault: Object.freeze({
      providerId: keyVault.providerId as string,
      storage: keyVault.storage as "ios-keychain" | "android-keystore",
      keyMaterial: keyVault.keyMaterial as "non-exportable",
      keyCreation: keyVault.keyCreation as "native-secure-random",
      retainsPreviousOnRotation: keyVault.retainsPreviousOnRotation as true,
    }),
    cipher: Object.freeze({
      providerId: cipher.providerId as string,
      authenticatedEncryption: cipher.authenticatedEncryption as true,
      keyHandlesOnly: cipher.keyHandlesOnly as true,
      nonceSource: cipher.nonceSource as "native-csprng",
      nonceUniqueness: cipher.nonceUniqueness as "enforced-per-key",
      algorithms,
    }),
    sqlite: Object.freeze({
      sharedConnection: sqlite.sharedConnection as true,
      transactionMode: sqlite.transactionMode as "exclusive",
    }),
  });
}

function parseRuntime(value: unknown): CanonicalRuntime | null {
  const record = canonicalRecord(value, [
    "platform",
    "nativeBuild",
    "secureStorageAvailable",
    "sqliteTransactionMode",
  ]);
  if (
    !record ||
    (record.platform !== "ios" &&
      record.platform !== "android" &&
      record.platform !== "web") ||
    typeof record.nativeBuild !== "boolean" ||
    typeof record.secureStorageAvailable !== "boolean" ||
    (record.sqliteTransactionMode !== "exclusive" &&
      record.sqliteTransactionMode !== "deferred" &&
      record.sqliteTransactionMode !== "unavailable")
  ) return null;

  return Object.freeze({
    platform: record.platform,
    nativeBuild: record.nativeBuild,
    secureStorageAvailable: record.secureStorageAvailable,
    sqliteTransactionMode: record.sqliteTransactionMode,
  });
}

/**
 * Evaluates whether the host has supplied a reviewed native security stack.
 *
 * This is a fail-closed configuration gate, not hardware attestation. The
 * capability declaration is an assertion by the native provider and must be
 * backed by independent code review, provider conformance tests and real
 * Android/iOS device verification before production activation.
 */
export function evaluateHoidConversationSecurityReadiness(
  capabilitiesInput: unknown,
  runtimeInput: unknown,
): HoidConversationSecurityReadiness {
  const capabilities = parseCapabilities(capabilitiesInput);
  if (!capabilities) {
    return Object.freeze({
      status: "blocked",
      reasons: Object.freeze(["invalid-capabilities"] as const),
    });
  }

  const runtime = parseRuntime(runtimeInput);
  if (!runtime) {
    return Object.freeze({
      status: "blocked",
      reasons: Object.freeze(["invalid-runtime"] as const),
    });
  }

  const reasons: HoidConversationSecurityReadinessReason[] = [];
  const add = (reason: HoidConversationSecurityReadinessReason): void => {
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  if (runtime.platform === "web") add("unsupported-platform");
  if (runtime.platform !== capabilities.platform) add("platform-mismatch");
  if (!runtime.nativeBuild) add("native-build-required");
  if (!runtime.secureStorageAvailable) add("secure-storage-unavailable");

  const expectedStorage = capabilities.platform === "ios"
    ? "ios-keychain"
    : "android-keystore";
  if (capabilities.keyVault.storage !== expectedStorage) {
    add("key-storage-mismatch");
  }

  if (
    capabilities.keyVault.providerId !== capabilities.providerId ||
    capabilities.cipher.providerId !== capabilities.providerId
  ) add("provider-mismatch");

  if (capabilities.keyVault.keyMaterial !== "non-exportable") {
    add("exportable-key-material");
  }
  if (capabilities.keyVault.keyCreation !== "native-secure-random") {
    add("native-key-generation-required");
  }
  if (capabilities.keyVault.retainsPreviousOnRotation !== true) {
    add("previous-key-retention-required");
  }
  if (capabilities.cipher.authenticatedEncryption !== true) {
    add("authenticated-encryption-required");
  }
  if (capabilities.cipher.keyHandlesOnly !== true) {
    add("opaque-key-handle-boundary-required");
  }
  if (capabilities.cipher.nonceSource !== "native-csprng") {
    add("native-csprng-required");
  }
  if (capabilities.cipher.nonceUniqueness !== "enforced-per-key") {
    add("nonce-uniqueness-required");
  }
  if (capabilities.sqlite.sharedConnection !== true) {
    add("shared-sqlite-connection-required");
  }
  if (capabilities.sqlite.transactionMode !== "exclusive") {
    add("exclusive-sqlite-transaction-required");
  }
  if (runtime.sqliteTransactionMode !== "exclusive") {
    add("exclusive-sqlite-transaction-required");
  }

  const algorithm = HOID_CONVERSATION_SECURITY_ALGORITHMS.find(candidate =>
    capabilities.cipher.algorithms.includes(candidate),
  );
  if (!algorithm) add("no-common-aead-algorithm");

  if (reasons.length > 0 || !algorithm) {
    return Object.freeze({
      status: "blocked",
      reasons: Object.freeze(reasons),
    });
  }

  return Object.freeze({
    status: "ready",
    providerId: capabilities.providerId,
    platform: capabilities.platform,
    algorithm,
  });
}
