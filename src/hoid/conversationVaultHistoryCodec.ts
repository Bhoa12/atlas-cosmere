import { strFromU8, strToU8 } from "fflate";
import {
  createHoidConversationHistorySnapshot,
  HOID_CONVERSATION_HISTORY_KIND,
  HOID_CONVERSATION_HISTORY_SCHEMA_VERSION,
  type HoidConversationHistorySnapshot,
} from "./conversationHistoryHydration";
import type { HoidConversationVaultCodec } from "./conversationVault";

export const HOID_CONVERSATION_VAULT_HISTORY_MAX_BYTES = 1_750_000;

type DataRecord = Record<string, unknown>;

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

function canonicalSnapshot(value: unknown): HoidConversationHistorySnapshot | null {
  const record = exactDataRecord(value, [
    "schemaVersion",
    "kind",
    "progressScope",
    "messages",
  ]);
  if (
    !record ||
    record.schemaVersion !== HOID_CONVERSATION_HISTORY_SCHEMA_VERSION ||
    record.kind !== HOID_CONVERSATION_HISTORY_KIND
  ) return null;

  const created = createHoidConversationHistorySnapshot(record.messages, record.progressScope);
  return created.status === "ready" ? created.snapshot : null;
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

/**
 * Bridges the vault's byte codec to the existing, versioned, allow-listed
 * conversation-history schema. It deliberately cannot serialize provider
 * payloads, citations, display permits, trust checkpoints or arbitrary fields.
 */
export function createHoidConversationVaultHistoryCodec(): HoidConversationVaultCodec {
  return Object.freeze({
    encode(snapshot: unknown): Uint8Array | null {
      const canonical = canonicalSnapshot(snapshot);
      if (!canonical) return null;

      try {
        const encoded = strToU8(JSON.stringify(canonical));
        if (encoded.length < 2 || encoded.length > HOID_CONVERSATION_VAULT_HISTORY_MAX_BYTES) {
          encoded.fill(0);
          return null;
        }
        return encoded;
      } catch {
        return null;
      }
    },

    decode(plaintext: Uint8Array): unknown | null {
      if (
        !(plaintext instanceof Uint8Array) ||
        plaintext.length < 2 ||
        plaintext.length > HOID_CONVERSATION_VAULT_HISTORY_MAX_BYTES
      ) return null;

      try {
        const json = strFromU8(plaintext);
        const roundTrip = strToU8(json);
        if (!sameBytes(plaintext, roundTrip)) {
          roundTrip.fill(0);
          return null;
        }
        roundTrip.fill(0);

        const parsed: unknown = JSON.parse(json);
        return canonicalSnapshot(parsed);
      } catch {
        return null;
      }
    },
  });
}
