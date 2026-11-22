import { isHoidLocalPrincipalId } from "./localPrincipalIdentity";

export const HOID_CONVERSATION_KEY_SCHEMA_VERSION = 1 as const;
export const HOID_CONVERSATION_KEY_KIND = "hoid-conversation-managed-key" as const;

export const HOID_CONVERSATION_AEAD_ALGORITHMS = [
  "AES-256-GCM",
  "CHACHA20-POLY1305",
  "XCHACHA20-POLY1305",
] as const;

export type HoidConversationAeadAlgorithm =
  (typeof HOID_CONVERSATION_AEAD_ALGORITHMS)[number];

export type HoidConversationManagedKeyDescriptor = Readonly<{
  schemaVersion: typeof HOID_CONVERSATION_KEY_SCHEMA_VERSION;
  kind: typeof HOID_CONVERSATION_KEY_KIND;
  principalId: string;
  keyId: string;
  keyHandle: string;
  keyVersion: number;
  algorithm: HoidConversationAeadAlgorithm;
  state: "active" | "decrypt-only";
}>;

/**
 * The native host owns key generation, secure hardware/key-store integration,
 * metadata atomicity and key availability. Raw key bytes must never cross this
 * port. Rotation keeps the previous key decrypt-only; deletion is deliberately
 * absent until ciphertext migration and retention can be proven complete.
 */
export type HoidConversationKeyManagerPort = Readonly<{
  ensureActiveKey: (principalId: string) => Promise<unknown>;
  resolveForDecryption: (principalId: string, keyId: string) => Promise<unknown | null>;
  rotateActiveKey: (
    principalId: string,
    expectedActiveKeyVersion: number,
  ) => Promise<unknown>;
}>;

export type HoidConversationManagedKeyResult =
  | Readonly<{ status: "ready"; descriptor: HoidConversationManagedKeyDescriptor }>
  | Readonly<{ status: "conflict" }>
  | Readonly<{ status: "invalid-input"; reason: "invalid-manager" | "invalid-principal" | "invalid-key-id" | "invalid-key-version" }>
  | Readonly<{ status: "invalid-key" }>
  | Readonly<{ status: "unavailable" }>;

const KEY_ID_PATTERN = /^hkey1_[A-Za-z0-9_-]{16,64}$/u;
const KEY_HANDLE_PATTERN = /^hkref1_[A-Za-z0-9._:-]{1,120}$/u;
const MAX_KEY_VERSION = Number.MAX_SAFE_INTEGER - 1;

type DataRecord = Record<string, unknown>;

function canonicalRecord(value: unknown, allowedKeys: readonly string[]): DataRecord | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
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

function canonicalDescriptor(value: unknown): HoidConversationManagedKeyDescriptor | null {
  const record = canonicalRecord(value, [
    "schemaVersion",
    "kind",
    "principalId",
    "keyId",
    "keyHandle",
    "keyVersion",
    "algorithm",
    "state",
  ]);
  if (
    !record ||
    record.schemaVersion !== HOID_CONVERSATION_KEY_SCHEMA_VERSION ||
    record.kind !== HOID_CONVERSATION_KEY_KIND ||
    !isHoidLocalPrincipalId(record.principalId) ||
    typeof record.keyId !== "string" ||
    !KEY_ID_PATTERN.test(record.keyId) ||
    typeof record.keyHandle !== "string" ||
    !KEY_HANDLE_PATTERN.test(record.keyHandle) ||
    typeof record.keyVersion !== "number" ||
    !Number.isSafeInteger(record.keyVersion) ||
    record.keyVersion < 1 ||
    record.keyVersion > MAX_KEY_VERSION ||
    !HOID_CONVERSATION_AEAD_ALGORITHMS.includes(
      record.algorithm as HoidConversationAeadAlgorithm,
    ) ||
    (record.state !== "active" && record.state !== "decrypt-only")
  ) return null;

  return Object.freeze({
    schemaVersion: HOID_CONVERSATION_KEY_SCHEMA_VERSION,
    kind: HOID_CONVERSATION_KEY_KIND,
    principalId: record.principalId,
    keyId: record.keyId,
    keyHandle: record.keyHandle,
    keyVersion: record.keyVersion,
    algorithm: record.algorithm as HoidConversationAeadAlgorithm,
    state: record.state,
  });
}

type CanonicalManager = Readonly<{
  ensureActiveKey: HoidConversationKeyManagerPort["ensureActiveKey"];
  resolveForDecryption: HoidConversationKeyManagerPort["resolveForDecryption"];
  rotateActiveKey: HoidConversationKeyManagerPort["rotateActiveKey"];
}>;

function canonicalManager(value: unknown): CanonicalManager | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    const allowed = ["ensureActiveKey", "resolveForDecryption", "rotateActiveKey"];
    if (keys.length !== allowed.length || keys.some(key => typeof key !== "string" || !allowed.includes(key))) {
      return null;
    }

    const descriptors = allowed.map(key => Object.getOwnPropertyDescriptor(value, key));
    if (descriptors.some(descriptor =>
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      descriptor.enumerable !== true ||
      typeof descriptor.value !== "function"
    )) return null;

    const ensureMethod = descriptors[0]?.value as HoidConversationKeyManagerPort["ensureActiveKey"];
    const resolveMethod = descriptors[1]?.value as HoidConversationKeyManagerPort["resolveForDecryption"];
    const rotateMethod = descriptors[2]?.value as HoidConversationKeyManagerPort["rotateActiveKey"];

    return Object.freeze({
      ensureActiveKey: (principalId: string) => ensureMethod.call(value, principalId),
      resolveForDecryption: (principalId: string, keyId: string) =>
        resolveMethod.call(value, principalId, keyId),
      rotateActiveKey: (principalId: string, expectedVersion: number) =>
        rotateMethod.call(value, principalId, expectedVersion),
    });
  } catch {
    return null;
  }
}

function resultReady(
  descriptor: HoidConversationManagedKeyDescriptor,
): HoidConversationManagedKeyResult {
  return Object.freeze({ status: "ready", descriptor });
}

export async function ensureHoidConversationActiveKey(
  managerInput: unknown,
  principalIdInput: unknown,
): Promise<HoidConversationManagedKeyResult> {
  const manager = canonicalManager(managerInput);
  if (!manager) return Object.freeze({ status: "invalid-input", reason: "invalid-manager" });
  if (!isHoidLocalPrincipalId(principalIdInput)) {
    return Object.freeze({ status: "invalid-input", reason: "invalid-principal" });
  }

  try {
    const descriptor = canonicalDescriptor(await manager.ensureActiveKey(principalIdInput));
    if (
      !descriptor ||
      descriptor.principalId !== principalIdInput ||
      descriptor.state !== "active"
    ) return Object.freeze({ status: "invalid-key" });
    return resultReady(descriptor);
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
}

export async function resolveHoidConversationKeyForDecryption(
  managerInput: unknown,
  principalIdInput: unknown,
  keyIdInput: unknown,
): Promise<HoidConversationManagedKeyResult> {
  const manager = canonicalManager(managerInput);
  if (!manager) return Object.freeze({ status: "invalid-input", reason: "invalid-manager" });
  if (!isHoidLocalPrincipalId(principalIdInput)) {
    return Object.freeze({ status: "invalid-input", reason: "invalid-principal" });
  }
  if (typeof keyIdInput !== "string" || !KEY_ID_PATTERN.test(keyIdInput)) {
    return Object.freeze({ status: "invalid-input", reason: "invalid-key-id" });
  }

  try {
    const raw = await manager.resolveForDecryption(principalIdInput, keyIdInput);
    if (raw === null) return Object.freeze({ status: "unavailable" });
    const descriptor = canonicalDescriptor(raw);
    if (
      !descriptor ||
      descriptor.principalId !== principalIdInput ||
      descriptor.keyId !== keyIdInput
    ) return Object.freeze({ status: "invalid-key" });
    return resultReady(descriptor);
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
}

/**
 * Rotates only from the exact active version supplied by the caller. After
 * compare-and-swap, it verifies both the new active key and retention of the
 * previous key as decrypt-only. A manager that drops the old key is rejected.
 */
export async function rotateHoidConversationActiveKey(
  managerInput: unknown,
  principalIdInput: unknown,
  expectedActiveKeyVersionInput: unknown,
): Promise<HoidConversationManagedKeyResult> {
  const manager = canonicalManager(managerInput);
  if (!manager) return Object.freeze({ status: "invalid-input", reason: "invalid-manager" });
  if (!isHoidLocalPrincipalId(principalIdInput)) {
    return Object.freeze({ status: "invalid-input", reason: "invalid-principal" });
  }
  if (
    typeof expectedActiveKeyVersionInput !== "number" ||
    !Number.isSafeInteger(expectedActiveKeyVersionInput) ||
    expectedActiveKeyVersionInput < 1 ||
    expectedActiveKeyVersionInput >= MAX_KEY_VERSION
  ) return Object.freeze({ status: "invalid-input", reason: "invalid-key-version" });

  const previous = await ensureHoidConversationActiveKey(manager, principalIdInput);
  if (previous.status !== "ready") return previous;
  if (previous.descriptor.keyVersion !== expectedActiveKeyVersionInput) {
    return Object.freeze({ status: "conflict" });
  }

  try {
    const outcome = await manager.rotateActiveKey(
      principalIdInput,
      expectedActiveKeyVersionInput,
    );
    if (outcome === "conflict") return Object.freeze({ status: "conflict" });
    if (outcome !== "rotated") return Object.freeze({ status: "unavailable" });

    const active = await ensureHoidConversationActiveKey(manager, principalIdInput);
    if (active.status !== "ready") return active;
    if (
      active.descriptor.keyVersion !== expectedActiveKeyVersionInput + 1 ||
      active.descriptor.keyId === previous.descriptor.keyId ||
      active.descriptor.keyHandle === previous.descriptor.keyHandle
    ) {
      // Every key generation must have a distinct immutable ID and handle.
      // Reusing either could make historical ciphertext resolve to new material.
      return Object.freeze({ status: "invalid-key" });
    }

    const retained = await resolveHoidConversationKeyForDecryption(
      manager,
      principalIdInput,
      previous.descriptor.keyId,
    );
    if (retained.status === "unavailable") return retained;
    if (
      retained.status !== "ready" ||
      retained.descriptor.keyVersion !== previous.descriptor.keyVersion ||
      retained.descriptor.algorithm !== previous.descriptor.algorithm ||
      retained.descriptor.state !== "decrypt-only"
    ) return Object.freeze({ status: "invalid-key" });

    return active;
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
}
