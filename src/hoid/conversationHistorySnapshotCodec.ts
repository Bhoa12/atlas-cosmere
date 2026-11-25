import {
  createHoidConversationHistorySnapshot,
  hydrateHoidConversationHistorySnapshot,
  type HoidConversationHistorySnapshot,
} from "./conversationHistoryHydration";
import {
  isHoidConversationProgressScope,
  type HoidConversationProgressScope,
} from "./conversationHistoryPolicy";
import type { HoidConversationVaultCodec } from "./conversationVault";
import { sha256Hex } from "./sha256";

export const HOID_HISTORY_SNAPSHOT_CODEC_SCHEMA_VERSION = 1 as const;
export const HOID_HISTORY_SNAPSHOT_CODEC_KIND = "hoid-history-snapshot-codec" as const;
export const HOID_HISTORY_SNAPSHOT_CODEC_MAX_BYTES = 2_000_000;

type DataRecord = Record<string, unknown>;

export type HoidConversationHistorySnapshotCodec = HoidConversationVaultCodec & Readonly<{
  kind: typeof HOID_HISTORY_SNAPSHOT_CODEC_KIND;
  schemaVersion: typeof HOID_HISTORY_SNAPSHOT_CODEC_SCHEMA_VERSION;
  /** Digest of the canonical UTF-8 JSON representation, not of caller-owned objects. */
  digest(snapshot: unknown): string | null;
  /** Returns a newly-created, frozen v1 snapshot or null. */
  canonicalize(snapshot: unknown): HoidConversationHistorySnapshot | null;
}>;

function exactDataRecord(value: unknown, keys: readonly string[]): DataRecord | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some(key => typeof key !== "string" || !keys.includes(key))
    ) return null;

    const result = Object.create(null) as DataRecord;
    for (const key of keys) {
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

/** Strict UTF-8 encoder. JSON.stringify escapes lone UTF-16 surrogates. */
function encodeUtf8(value: string): Uint8Array | null {
  const bytes: number[] = [];
  try {
    for (let index = 0; index < value.length; index += 1) {
      let point = value.charCodeAt(index);
      if (point >= 0xd800 && point <= 0xdbff) {
        const low = value.charCodeAt(index + 1);
        if (low < 0xdc00 || low > 0xdfff) return null;
        point = 0x10000 + ((point - 0xd800) << 10) + (low - 0xdc00);
        index += 1;
      } else if (point >= 0xdc00 && point <= 0xdfff) {
        return null;
      }

      if (point <= 0x7f) {
        bytes.push(point);
      } else if (point <= 0x7ff) {
        bytes.push(0xc0 | (point >>> 6), 0x80 | (point & 0x3f));
      } else if (point <= 0xffff) {
        bytes.push(
          0xe0 | (point >>> 12),
          0x80 | ((point >>> 6) & 0x3f),
          0x80 | (point & 0x3f),
        );
      } else {
        bytes.push(
          0xf0 | (point >>> 18),
          0x80 | ((point >>> 12) & 0x3f),
          0x80 | ((point >>> 6) & 0x3f),
          0x80 | (point & 0x3f),
        );
      }
      if (bytes.length > HOID_HISTORY_SNAPSHOT_CODEC_MAX_BYTES) return null;
    }
    return new Uint8Array(bytes);
  } catch {
    return null;
  }
}

/** Rejects overlong encodings, surrogate code points, truncation and > U+10FFFF. */
function decodeUtf8(bytes: Uint8Array): string | null {
  const units: number[] = [];
  try {
    for (let index = 0; index < bytes.length;) {
      const first = bytes[index];
      let point: number;
      let width: number;

      if (first <= 0x7f) {
        point = first;
        width = 1;
      } else if (first >= 0xc2 && first <= 0xdf) {
        point = first & 0x1f;
        width = 2;
      } else if (first >= 0xe0 && first <= 0xef) {
        point = first & 0x0f;
        width = 3;
      } else if (first >= 0xf0 && first <= 0xf4) {
        point = first & 0x07;
        width = 4;
      } else {
        return null;
      }

      if (index + width > bytes.length) return null;
      for (let offset = 1; offset < width; offset += 1) {
        const next = bytes[index + offset];
        if (next < 0x80 || next > 0xbf) return null;
        if (offset === 1) {
          if (first === 0xe0 && next < 0xa0) return null;
          if (first === 0xed && next > 0x9f) return null;
          if (first === 0xf0 && next < 0x90) return null;
          if (first === 0xf4 && next > 0x8f) return null;
        }
        point = (point << 6) | (next & 0x3f);
      }

      if (point >= 0xd800 && point <= 0xdfff) return null;
      if (point > 0x10ffff) return null;
      if (point <= 0xffff) {
        units.push(point);
      } else {
        const adjusted = point - 0x10000;
        units.push(0xd800 | (adjusted >>> 10), 0xdc00 | (adjusted & 0x3ff));
      }
      index += width;
    }

    let output = "";
    for (let offset = 0; offset < units.length; offset += 4096) {
      output += String.fromCharCode(...units.slice(offset, offset + 4096));
    }
    return output;
  } catch {
    return null;
  }
}

function canonicalSnapshot(value: unknown): HoidConversationHistorySnapshot | null {
  const envelope = exactDataRecord(value, [
    "schemaVersion",
    "kind",
    "progressScope",
    "messages",
  ]);
  if (
    !envelope ||
    envelope.schemaVersion !== 1 ||
    envelope.kind !== "hoid-conversation-history"
  ) return null;

  const rawScope = exactDataRecord(envelope.progressScope, ["revision", "fingerprint"]);
  if (
    !rawScope ||
    typeof rawScope.revision !== "number" ||
    typeof rawScope.fingerprint !== "string"
  ) return null;
  const scope = Object.freeze({
    revision: rawScope.revision,
    fingerprint: rawScope.fingerprint,
  });
  if (!isHoidConversationProgressScope(scope)) return null;
  const hydrated = hydrateHoidConversationHistorySnapshot(value, scope);
  if (hydrated.status !== "ready") return null;

  const created = createHoidConversationHistorySnapshot(hydrated.messages, scope);
  return created.status === "ready" ? created.snapshot : null;
}

function canonicalJson(snapshot: unknown): Readonly<{
  snapshot: HoidConversationHistorySnapshot;
  json: string;
}> | null {
  const canonical = canonicalSnapshot(snapshot);
  if (!canonical) return null;
  try {
    const json = JSON.stringify(canonical);
    if (typeof json !== "string") return null;
    const bytes = encodeUtf8(json);
    if (!bytes || bytes.length < 1 || bytes.length > HOID_HISTORY_SNAPSHOT_CODEC_MAX_BYTES) return null;
    return Object.freeze({ snapshot: canonical, json });
  } catch {
    return null;
  }
}

/**
 * Provider-neutral v1 codec for encrypted Vault storage and history migration.
 *
 * It serializes only the existing text-only, progress-scoped history schema.
 * It deliberately rejects citations, rich UI, provider payloads, EPUB locators,
 * extracted source text and unknown extension fields. Spoiler authorization is
 * still performed by hydrateHoidConversationHistorySnapshot at restore time.
 */
export function createHoidConversationHistorySnapshotCodec(): HoidConversationHistorySnapshotCodec {
  const canonicalize = (snapshot: unknown) => canonicalSnapshot(snapshot);

  const encode = (snapshot: unknown): Uint8Array | null => {
    const canonical = canonicalJson(snapshot);
    return canonical ? encodeUtf8(canonical.json) : null;
  };

  const decode = (plaintext: Uint8Array): unknown | null => {
    try {
      if (
        !(plaintext instanceof Uint8Array) ||
        plaintext.length < 1 ||
        plaintext.length > HOID_HISTORY_SNAPSHOT_CODEC_MAX_BYTES
      ) return null;

      const json = decodeUtf8(new Uint8Array(plaintext));
      if (json === null) return null;

      const parsed: unknown = JSON.parse(json);
      const canonical = canonicalJson(parsed);
      if (!canonical || canonical.json !== json) return null;
      return canonical.snapshot;
    } catch {
      return null;
    }
  };

  const digest = (snapshot: unknown): string | null => {
    const canonical = canonicalJson(snapshot);
    return canonical ? sha256Hex(canonical.json) : null;
  };

  return Object.freeze({
    kind: HOID_HISTORY_SNAPSHOT_CODEC_KIND,
    schemaVersion: HOID_HISTORY_SNAPSHOT_CODEC_SCHEMA_VERSION,
    encode,
    decode,
    digest,
    canonicalize,
  });
}
