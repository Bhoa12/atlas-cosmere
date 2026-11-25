import { sha256Hex } from "./sha256";

const SESSION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/u;
const KEY_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/u;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const MAX_CIPHERTEXT_CHARS = 2_800_000;
const MAX_PLAINTEXT_BYTES = 2_000_000;
const TOMBSTONE_BYTES = new Uint8Array([0x48, 0x4f, 0x49, 0x44, 0x2d, 0x43, 0x4c, 0x45, 0x41, 0x52, 0x2d, 0x56, 0x31]);

export type HoidConversationVaultEnvelope = Readonly<{
  schemaVersion: 1;
  sessionId: string;
  revision: number;
  kind: "snapshot" | "tombstone";
  keyId: string;
  algorithm: "AES-256-GCM";
  nonce: string;
  ciphertext: string;
  tag: string;
  aadSha256: string;
  updatedAt: string;
}>;

/**
 * A handle is an opaque native reference, never raw key bytes.
 * The implementation must keep the AES key non-exportable.
 */
export type HoidConversationVaultKeyHandle = Readonly<{
  keyId: string;
  handle: object;
}>;

export interface HoidConversationVaultKeyProvider {
  getActiveKey(): Promise<unknown>;
  resolveKey(keyId: string): Promise<unknown>;
}

/** Native implementation backed by a vetted platform crypto API. */
export interface HoidConversationVaultAead {
  seal(input: Readonly<{
    keyHandle: object;
    plaintext: Uint8Array;
    additionalAuthenticatedData: string;
  }>): Promise<unknown>;
  open(input: Readonly<{
    keyHandle: object;
    nonce: string;
    ciphertext: string;
    tag: string;
    additionalAuthenticatedData: string;
  }>): Promise<unknown>;
}

/** Must provide durable, atomic revision compare-and-swap semantics. */
export interface HoidConversationVaultBlobStore {
  read(sessionId: string): Promise<unknown>;
  compareAndSwap(
    sessionId: string,
    expectedRevision: number | null,
    next: HoidConversationVaultEnvelope,
  ): Promise<boolean>;
}

/**
 * This checkpoint must be protected by an independently rollback-resistant
 * native authority. SQLite/AsyncStorage alone do not satisfy that requirement.
 */
export interface HoidConversationVaultCheckpoint {
  readRevision(sessionId: string): Promise<unknown>;
  compareAndSwap(
    sessionId: string,
    expectedRevision: number | null,
    nextRevision: number,
  ): Promise<boolean>;
}

/** The codec owns the versioned, allow-listed conversation schema. */
export interface HoidConversationVaultCodec {
  encode(snapshot: unknown): Uint8Array | null;
  decode(plaintext: Uint8Array): unknown | null;
}

export interface HoidConversationVaultClock {
  nowIso(): string;
}

export type HoidConversationVaultResult =
  | Readonly<{ status: "empty"; revision: number }>
  | Readonly<{ status: "ready"; revision: number; snapshot: unknown }>
  | Readonly<{ status: "saved"; revision: number }>
  | Readonly<{ status: "cleared"; revision: number }>
  | Readonly<{ status: "conflict"; revision: number | null }>
  | Readonly<{
      status: "blocked";
      reason:
        | "invalid-session"
        | "invalid-revision"
        | "checkpoint-unavailable"
        | "blob-store-unavailable"
        | "checkpoint-envelope-mismatch"
        | "invalid-envelope"
        | "aad-mismatch"
        | "key-unavailable"
        | "encryption-failed"
        | "decryption-failed"
        | "invalid-plaintext"
        | "codec-rejected"
        | "checkpoint-commit-failed"
        | "generation-fenced"
        | "generation-fence-unavailable";
    }>;

type DataRecord = Record<string, unknown>;

function exactRecord(value: unknown, keys: readonly string[]): DataRecord | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== "string" || !keys.includes(key))) {
      return null;
    }
    const output = Object.create(null) as DataRecord;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      output[key] = descriptor.value;
    }
    return output;
  } catch {
    return null;
  }
}

function validIso(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  try {
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
  } catch {
    return false;
  }
}

function validRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validKey(value: unknown): HoidConversationVaultKeyHandle | null {
  const record = exactRecord(value, ["keyId", "handle"]);
  if (
    !record ||
    typeof record.keyId !== "string" ||
    !KEY_ID_PATTERN.test(record.keyId) ||
    record.handle === null ||
    typeof record.handle !== "object" ||
    Array.isArray(record.handle)
  ) return null;
  return Object.freeze({ keyId: record.keyId, handle: record.handle as object });
}

function validSealed(value: unknown): Readonly<{ nonce: string; ciphertext: string; tag: string }> | null {
  const record = exactRecord(value, ["nonce", "ciphertext", "tag"]);
  if (
    !record ||
    typeof record.nonce !== "string" ||
    !/^[A-Za-z0-9_-]{16}$/u.test(record.nonce) ||
    typeof record.tag !== "string" ||
    !/^[A-Za-z0-9_-]{22}$/u.test(record.tag) ||
    typeof record.ciphertext !== "string" ||
    record.ciphertext.length < 1 ||
    record.ciphertext.length > MAX_CIPHERTEXT_CHARS ||
    !BASE64URL_PATTERN.test(record.ciphertext)
  ) return null;
  return Object.freeze({
    nonce: record.nonce,
    ciphertext: record.ciphertext,
    tag: record.tag,
  });
}

function validEnvelope(value: unknown): HoidConversationVaultEnvelope | null {
  const record = exactRecord(value, [
    "schemaVersion", "sessionId", "revision", "kind", "keyId", "algorithm",
    "nonce", "ciphertext", "tag", "aadSha256", "updatedAt",
  ]);
  if (
    !record ||
    record.schemaVersion !== 1 ||
    typeof record.sessionId !== "string" ||
    !SESSION_ID_PATTERN.test(record.sessionId) ||
    !validRevision(record.revision) ||
    record.revision < 1 ||
    (record.kind !== "snapshot" && record.kind !== "tombstone") ||
    typeof record.keyId !== "string" ||
    !KEY_ID_PATTERN.test(record.keyId) ||
    record.algorithm !== "AES-256-GCM" ||
    typeof record.nonce !== "string" ||
    !/^[A-Za-z0-9_-]{16}$/u.test(record.nonce) ||
    typeof record.ciphertext !== "string" ||
    record.ciphertext.length < 1 ||
    record.ciphertext.length > MAX_CIPHERTEXT_CHARS ||
    !BASE64URL_PATTERN.test(record.ciphertext) ||
    typeof record.tag !== "string" ||
    !/^[A-Za-z0-9_-]{22}$/u.test(record.tag) ||
    typeof record.aadSha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(record.aadSha256) ||
    !validIso(record.updatedAt)
  ) return null;
  return Object.freeze({
    schemaVersion: 1,
    sessionId: record.sessionId,
    revision: record.revision,
    kind: record.kind,
    keyId: record.keyId,
    algorithm: "AES-256-GCM",
    nonce: record.nonce,
    ciphertext: record.ciphertext,
    tag: record.tag,
    aadSha256: record.aadSha256,
    updatedAt: record.updatedAt,
  });
}

function aadFor(envelope: Pick<HoidConversationVaultEnvelope, "sessionId" | "revision" | "kind" | "keyId" | "updatedAt">): string {
  return [
    "hoid-conversation-vault",
    "schema=1",
    `session=${envelope.sessionId}`,
    `revision=${envelope.revision}`,
    `kind=${envelope.kind}`,
    `key=${envelope.keyId}`,
    `updatedAt=${envelope.updatedAt}`,
  ].join("\n");
}

function blocked(reason: Extract<HoidConversationVaultResult, { status: "blocked" }>["reason"]): HoidConversationVaultResult {
  return Object.freeze({ status: "blocked", reason });
}

export type HoidConversationVault = Readonly<{
  restore(sessionId: string): Promise<HoidConversationVaultResult>;
  save(sessionId: string, expectedRevision: number, snapshot: unknown): Promise<HoidConversationVaultResult>;
  clear(sessionId: string, expectedRevision: number): Promise<HoidConversationVaultResult>;
}>;

/**
 * Encrypted, revisioned persistence for conversation snapshots.
 *
 * This module orchestrates contracts only. It does not implement cryptography,
 * create keys, claim hardware backing, or claim rollback resistance. Those
 * guarantees must be supplied by the native key, AEAD and checkpoint ports.
 */
export function createHoidConversationVault(input: Readonly<{
  keys: HoidConversationVaultKeyProvider;
  aead: HoidConversationVaultAead;
  blobs: HoidConversationVaultBlobStore;
  checkpoint: HoidConversationVaultCheckpoint;
  codec: HoidConversationVaultCodec;
  clock: HoidConversationVaultClock;
}>): HoidConversationVault {
  const restore = async (sessionId: string): Promise<HoidConversationVaultResult> => {
    if (typeof sessionId !== "string" || !SESSION_ID_PATTERN.test(sessionId)) return blocked("invalid-session");

    let checkpointValue: unknown;
    let storedValue: unknown;
    try {
      checkpointValue = await input.checkpoint.readRevision(sessionId);
      storedValue = await input.blobs.read(sessionId);
    } catch {
      return blocked("blob-store-unavailable");
    }

    if (checkpointValue === null && storedValue === null) {
      return Object.freeze({ status: "empty", revision: 0 });
    }
    if (!validRevision(checkpointValue)) return blocked("checkpoint-unavailable");
    if (checkpointValue === 0) {
      return storedValue === null
        ? Object.freeze({ status: "empty", revision: 0 })
        : blocked("checkpoint-envelope-mismatch");
    }
    if (storedValue === null) return blocked("checkpoint-envelope-mismatch");

    const envelope = validEnvelope(storedValue);
    if (!envelope || envelope.sessionId !== sessionId) return blocked("invalid-envelope");
    if (envelope.revision !== checkpointValue) return blocked("checkpoint-envelope-mismatch");

    const aad = aadFor(envelope);
    if (sha256Hex(aad) !== envelope.aadSha256) return blocked("aad-mismatch");

    let keyValue: unknown;
    try {
      keyValue = await input.keys.resolveKey(envelope.keyId);
    } catch {
      return blocked("key-unavailable");
    }
    const key = validKey(keyValue);
    if (!key || key.keyId !== envelope.keyId) return blocked("key-unavailable");

    let opened: unknown;
    try {
      opened = await input.aead.open({
        keyHandle: key.handle,
        nonce: envelope.nonce,
        ciphertext: envelope.ciphertext,
        tag: envelope.tag,
        additionalAuthenticatedData: aad,
      });
    } catch {
      return blocked("decryption-failed");
    }
    if (!(opened instanceof Uint8Array) || opened.length < 1 || opened.length > MAX_PLAINTEXT_BYTES) {
      return blocked("invalid-plaintext");
    }

    const plaintext = new Uint8Array(opened);
    opened.fill(0);
    try {
      if (envelope.kind === "tombstone") {
        const isTombstone = plaintext.length === TOMBSTONE_BYTES.length &&
          plaintext.every((byte, index) => byte === TOMBSTONE_BYTES[index]);
        return isTombstone
          ? Object.freeze({ status: "empty", revision: envelope.revision })
          : blocked("invalid-plaintext");
      }
      let snapshot: unknown;
      try {
        snapshot = input.codec.decode(plaintext);
      } catch {
        return blocked("codec-rejected");
      }
      if (snapshot === null || snapshot === undefined) return blocked("codec-rejected");
      return Object.freeze({ status: "ready", revision: envelope.revision, snapshot });
    } finally {
      plaintext.fill(0);
    }
  };

  const commit = async (
    sessionId: string,
    expectedRevision: number,
    kind: "snapshot" | "tombstone",
    snapshot?: unknown,
  ): Promise<HoidConversationVaultResult> => {
    if (typeof sessionId !== "string" || !SESSION_ID_PATTERN.test(sessionId)) return blocked("invalid-session");
    if (!validRevision(expectedRevision)) return blocked("invalid-revision");

    const current = await restore(sessionId);
    if (current.status === "blocked") return current;
    if (current.revision !== expectedRevision) {
      return Object.freeze({ status: "conflict", revision: current.revision });
    }

    let plaintext: Uint8Array | null = null;
    if (kind === "tombstone") {
      plaintext = new Uint8Array(TOMBSTONE_BYTES);
    } else {
      let encoded: Uint8Array | null;
      try {
        encoded = input.codec.encode(snapshot);
      } catch {
        return blocked("codec-rejected");
      }
      if (!(encoded instanceof Uint8Array) || encoded.length < 1 || encoded.length > MAX_PLAINTEXT_BYTES) {
        return blocked("codec-rejected");
      }
      plaintext = new Uint8Array(encoded);
      encoded.fill(0);
    }

    let key: HoidConversationVaultKeyHandle | null = null;
    let updatedAt: string;
    try {
      key = validKey(await input.keys.getActiveKey());
      updatedAt = input.clock.nowIso();
    } catch {
      plaintext.fill(0);
      return blocked("key-unavailable");
    }
    if (!key || !validIso(updatedAt)) {
      plaintext.fill(0);
      return blocked(key ? "encryption-failed" : "key-unavailable");
    }

    const revision = expectedRevision + 1;
    const metadata = Object.freeze({
      sessionId,
      revision,
      kind,
      keyId: key.keyId,
      updatedAt,
    });
    const aad = aadFor(metadata);
    let sealedValue: unknown;
    try {
      sealedValue = await input.aead.seal({
        keyHandle: key.handle,
        plaintext,
        additionalAuthenticatedData: aad,
      });
    } catch {
      return blocked("encryption-failed");
    } finally {
      plaintext.fill(0);
    }

    const sealed = validSealed(sealedValue);
    if (!sealed) return blocked("encryption-failed");

    const envelope: HoidConversationVaultEnvelope = Object.freeze({
      schemaVersion: 1,
      ...metadata,
      algorithm: "AES-256-GCM",
      ...sealed,
      aadSha256: sha256Hex(aad),
    });

    let blobCommitted: boolean;
    try {
      blobCommitted = await input.blobs.compareAndSwap(
        sessionId,
        expectedRevision === 0 ? null : expectedRevision,
        envelope,
      );
    } catch {
      return blocked("blob-store-unavailable");
    }
    if (!blobCommitted) {
      const latest = await input.checkpoint.readRevision(sessionId).catch(() => null);
      return Object.freeze({
        status: "conflict",
        revision: validRevision(latest) ? latest : null,
      });
    }

    let checkpointCommitted: boolean;
    try {
      checkpointCommitted = await input.checkpoint.compareAndSwap(
        sessionId,
        expectedRevision === 0 ? null : expectedRevision,
        revision,
      );
    } catch {
      return blocked("checkpoint-commit-failed");
    }
    if (!checkpointCommitted) return blocked("checkpoint-commit-failed");

    return Object.freeze({
      status: kind === "snapshot" ? "saved" : "cleared",
      revision,
    });
  };

  return Object.freeze({
    restore,
    save: (sessionId: string, expectedRevision: number, snapshot: unknown) =>
      commit(sessionId, expectedRevision, "snapshot", snapshot),
    clear: (sessionId: string, expectedRevision: number) =>
      commit(sessionId, expectedRevision, "tombstone"),
  });
}
