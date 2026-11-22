import type {
  HoidConversationPayloadProtectionContext,
  HoidConversationPayloadProtector,
} from "./expoSqliteConversationHistoryStore";
import {
  HOID_CONVERSATION_AEAD_ALGORITHMS,
  ensureHoidConversationActiveKey,
  resolveHoidConversationKeyForDecryption,
  type HoidConversationAeadAlgorithm,
  type HoidConversationKeyManagerPort,
  type HoidConversationManagedKeyDescriptor,
} from "./conversationKeyManagement";
import { isHoidLocalPrincipalId } from "./localPrincipalIdentity";

export const HOID_MANAGED_AEAD_ENVELOPE_SCHEMA_VERSION = 1 as const;
export const HOID_MANAGED_AEAD_ENVELOPE_KIND = "hoid-managed-aead-envelope" as const;

const MAX_PLAINTEXT_LENGTH = 600_000;
const MAX_CIPHERTEXT_LENGTH = 850_000;
const MAX_ENVELOPE_LENGTH = 900_000;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

/**
 * The host supplies the actual reviewed AEAD implementation. seal() must
 * generate each nonce with a cryptographically secure source and must never
 * reuse a nonce with the same key handle. Required nonce sizes are 96 bits
 * for AES-256-GCM and ChaCha20-Poly1305, and 192 bits for XChaCha20-Poly1305.
 * Key bytes remain inside the native/provider boundary; only opaque handles
 * cross this port. Unsupported algorithms must fail closed.
 */
export type HoidAeadCipherPort = Readonly<{
  seal: (
    plaintext: string,
    keyHandle: string,
    algorithm: HoidConversationAeadAlgorithm,
    associatedData: string,
  ) => Promise<unknown>;
  open: (
    ciphertext: string,
    nonce: string,
    keyHandle: string,
    algorithm: HoidConversationAeadAlgorithm,
    associatedData: string,
  ) => Promise<unknown>;
}>;

type DataRecord = Record<string, unknown>;
type CanonicalContext = HoidConversationPayloadProtectionContext;

type CanonicalEnvelope = Readonly<{
  schemaVersion: typeof HOID_MANAGED_AEAD_ENVELOPE_SCHEMA_VERSION;
  kind: typeof HOID_MANAGED_AEAD_ENVELOPE_KIND;
  keyId: string;
  keyVersion: number;
  algorithm: HoidConversationAeadAlgorithm;
  nonce: string;
  ciphertext: string;
}>;

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

function canonicalContext(value: unknown): CanonicalContext | null {
  const record = canonicalRecord(value, [
    "purpose",
    "schemaVersion",
    "principalId",
    "conversationId",
    "storageRevision",
  ]);
  if (
    !record ||
    record.purpose !== "hoid-conversation-history" ||
    record.schemaVersion !== 1 ||
    !isHoidLocalPrincipalId(record.principalId) ||
    typeof record.conversationId !== "string" ||
    !OPAQUE_ID_PATTERN.test(record.conversationId) ||
    typeof record.storageRevision !== "number" ||
    !Number.isSafeInteger(record.storageRevision) ||
    record.storageRevision < 1
  ) return null;

  return Object.freeze({
    purpose: "hoid-conversation-history",
    schemaVersion: 1,
    principalId: record.principalId,
    conversationId: record.conversationId,
    storageRevision: record.storageRevision,
  });
}

function canonicalCipher(value: unknown): HoidAeadCipherPort | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 2 || !keys.includes("seal") || !keys.includes("open")) return null;

    const sealDescriptor = Object.getOwnPropertyDescriptor(value, "seal");
    const openDescriptor = Object.getOwnPropertyDescriptor(value, "open");
    if (
      !sealDescriptor ||
      !openDescriptor ||
      !Object.prototype.hasOwnProperty.call(sealDescriptor, "value") ||
      !Object.prototype.hasOwnProperty.call(openDescriptor, "value") ||
      sealDescriptor.enumerable !== true ||
      openDescriptor.enumerable !== true ||
      typeof sealDescriptor.value !== "function" ||
      typeof openDescriptor.value !== "function"
    ) return null;

    const sealMethod = sealDescriptor.value as HoidAeadCipherPort["seal"];
    const openMethod = openDescriptor.value as HoidAeadCipherPort["open"];
    return Object.freeze({
      seal: (
        plaintext: string,
        keyHandle: string,
        algorithm: HoidConversationAeadAlgorithm,
        associatedData: string,
      ) => sealMethod.call(value, plaintext, keyHandle, algorithm, associatedData),
      open: (
        ciphertext: string,
        nonce: string,
        keyHandle: string,
        algorithm: HoidConversationAeadAlgorithm,
        associatedData: string,
      ) => openMethod.call(value, ciphertext, nonce, keyHandle, algorithm, associatedData),
    });
  } catch {
    return null;
  }
}

function nonceLength(algorithm: HoidConversationAeadAlgorithm): number {
  return algorithm === "XCHACHA20-POLY1305" ? 32 : 16;
}

function validEncoded(value: unknown, min: number, max: number): value is string {
  if (
    typeof value !== "string" ||
    value.length < min ||
    value.length > max ||
    value.length % 4 === 1 ||
    !BASE64URL_PATTERN.test(value)
  ) return false;

  const remainder = value.length % 4;
  const lastValue = BASE64URL_ALPHABET.indexOf(value[value.length - 1]);
  if (lastValue < 0) return false;
  if (remainder === 2 && (lastValue & 0x0f) !== 0) return false;
  if (remainder === 3 && (lastValue & 0x03) !== 0) return false;
  return true;
}

function associatedData(
  context: CanonicalContext,
  key: HoidConversationManagedKeyDescriptor,
): string {
  return JSON.stringify({
    purpose: context.purpose,
    schemaVersion: context.schemaVersion,
    principalId: context.principalId,
    conversationId: context.conversationId,
    storageRevision: context.storageRevision,
    keyId: key.keyId,
    keyVersion: key.keyVersion,
    algorithm: key.algorithm,
  });
}

function canonicalSealedPayload(
  value: unknown,
  algorithm: HoidConversationAeadAlgorithm,
): Readonly<{ nonce: string; ciphertext: string }> | null {
  const record = canonicalRecord(value, ["nonce", "ciphertext"]);
  if (
    !record ||
    !validEncoded(record.nonce, nonceLength(algorithm), nonceLength(algorithm)) ||
    !validEncoded(record.ciphertext, 22, MAX_CIPHERTEXT_LENGTH)
  ) return null;
  return Object.freeze({
    nonce: record.nonce,
    ciphertext: record.ciphertext,
  });
}

function canonicalEnvelope(value: unknown): CanonicalEnvelope | null {
  const record = canonicalRecord(value, [
    "schemaVersion",
    "kind",
    "keyId",
    "keyVersion",
    "algorithm",
    "nonce",
    "ciphertext",
  ]);
  if (
    !record ||
    record.schemaVersion !== HOID_MANAGED_AEAD_ENVELOPE_SCHEMA_VERSION ||
    record.kind !== HOID_MANAGED_AEAD_ENVELOPE_KIND ||
    typeof record.keyId !== "string" ||
    !/^hkey1_[A-Za-z0-9_-]{16,64}$/u.test(record.keyId) ||
    typeof record.keyVersion !== "number" ||
    !Number.isSafeInteger(record.keyVersion) ||
    record.keyVersion < 1 ||
    !HOID_CONVERSATION_AEAD_ALGORITHMS.includes(
      record.algorithm as HoidConversationAeadAlgorithm,
    )
  ) return null;

  const algorithm = record.algorithm as HoidConversationAeadAlgorithm;
  if (
    !validEncoded(record.nonce, nonceLength(algorithm), nonceLength(algorithm)) ||
    !validEncoded(record.ciphertext, 22, MAX_CIPHERTEXT_LENGTH)
  ) return null;

  return Object.freeze({
    schemaVersion: HOID_MANAGED_AEAD_ENVELOPE_SCHEMA_VERSION,
    kind: HOID_MANAGED_AEAD_ENVELOPE_KIND,
    keyId: record.keyId,
    keyVersion: record.keyVersion,
    algorithm,
    nonce: record.nonce,
    ciphertext: record.ciphertext,
  });
}

function requireReadyKey(
  result: Awaited<ReturnType<typeof ensureHoidConversationActiveKey>>,
): HoidConversationManagedKeyDescriptor {
  if (result.status !== "ready") {
    throw new Error("Hoid active conversation key is unavailable");
  }
  return result.descriptor;
}

export function createManagedHoidConversationPayloadProtector(
  managerInput: unknown,
  cipherInput: unknown,
): HoidConversationPayloadProtector {
  const manager = managerInput as HoidConversationKeyManagerPort;
  const cipher = canonicalCipher(cipherInput);
  if (!cipher) throw new TypeError("Invalid Hoid AEAD cipher port");

  return Object.freeze({
    seal: async (
      plaintext: string,
      contextInput: HoidConversationPayloadProtectionContext,
    ): Promise<string> => {
      const context = canonicalContext(contextInput);
      if (!context) throw new TypeError("Invalid Hoid conversation protection context");
      if (typeof plaintext !== "string" || plaintext.length > MAX_PLAINTEXT_LENGTH) {
        throw new TypeError("Invalid Hoid conversation plaintext");
      }

      const keyResult = await ensureHoidConversationActiveKey(managerInput, context.principalId);
      const key = requireReadyKey(keyResult);
      const sealed = canonicalSealedPayload(
        await cipher.seal(
          plaintext,
          key.keyHandle,
          key.algorithm,
          associatedData(context, key),
        ),
        key.algorithm,
      );
      if (!sealed) throw new Error("Hoid AEAD provider returned a malformed sealed payload");

      const envelope: CanonicalEnvelope = Object.freeze({
        schemaVersion: HOID_MANAGED_AEAD_ENVELOPE_SCHEMA_VERSION,
        kind: HOID_MANAGED_AEAD_ENVELOPE_KIND,
        keyId: key.keyId,
        keyVersion: key.keyVersion,
        algorithm: key.algorithm,
        nonce: sealed.nonce,
        ciphertext: sealed.ciphertext,
      });
      const serialized = JSON.stringify(envelope);
      if (serialized.length > MAX_ENVELOPE_LENGTH) {
        throw new Error("Hoid AEAD envelope exceeds the storage limit");
      }
      return serialized;
    },

    open: async (
      ciphertextInput: string,
      contextInput: HoidConversationPayloadProtectionContext,
    ): Promise<string> => {
      const context = canonicalContext(contextInput);
      if (!context) throw new TypeError("Invalid Hoid conversation protection context");
      if (
        typeof ciphertextInput !== "string" ||
        ciphertextInput.length === 0 ||
        ciphertextInput.length > MAX_ENVELOPE_LENGTH
      ) throw new TypeError("Invalid Hoid AEAD envelope");

      let parsed: unknown;
      try {
        parsed = JSON.parse(ciphertextInput) as unknown;
      } catch {
        throw new Error("Malformed Hoid AEAD envelope");
      }
      const envelope = canonicalEnvelope(parsed);
      if (!envelope) throw new Error("Invalid Hoid AEAD envelope");
      // Require the exact serialization emitted by seal(). This rejects duplicate
      // JSON keys, alternate property order and whitespace-based ambiguity.
      if (JSON.stringify(envelope) !== ciphertextInput) {
        throw new Error("Non-canonical Hoid AEAD envelope");
      }

      const keyResult = await resolveHoidConversationKeyForDecryption(
        managerInput,
        context.principalId,
        envelope.keyId,
      );
      if (keyResult.status !== "ready") {
        throw new Error("Hoid conversation decryption key is unavailable");
      }
      const key = keyResult.descriptor;
      if (
        key.keyVersion !== envelope.keyVersion ||
        key.algorithm !== envelope.algorithm
      ) throw new Error("Hoid AEAD key metadata does not match the envelope");

      const plaintext = await cipher.open(
        envelope.ciphertext,
        envelope.nonce,
        key.keyHandle,
        key.algorithm,
        associatedData(context, key),
      );
      if (typeof plaintext !== "string" || plaintext.length > MAX_PLAINTEXT_LENGTH) {
        throw new Error("Hoid AEAD provider returned invalid plaintext");
      }
      return plaintext;
    },
  });
}
