import {
  createHoidConversationHistorySnapshot,
  hydrateHoidConversationHistorySnapshot,
  type HoidConversationHistorySnapshot,
  type HoidPersistableConversationMessage,
} from "./conversationHistoryHydration";
import {
  isHoidConversationProgressScope,
  type HoidConversationProgressScope,
} from "./conversationHistoryPolicy";

export const HOID_CONVERSATION_STORAGE_SCHEMA_VERSION = 1 as const;
export const HOID_CONVERSATION_STORAGE_RECORD_KIND = "hoid-conversation-storage-record" as const;

const MAX_KEY_LENGTH = 128;
const MAX_STORAGE_REVISION = Number.MAX_SAFE_INTEGER - 1;
const OPAQUE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export type HoidConversationStorageKey = Readonly<{
  principalId: string;
  conversationId: string;
}>;

export type HoidConversationStorageRecord = Readonly<{
  schemaVersion: typeof HOID_CONVERSATION_STORAGE_SCHEMA_VERSION;
  kind: typeof HOID_CONVERSATION_STORAGE_RECORD_KIND;
  principalId: string;
  conversationId: string;
  storageRevision: number;
  snapshot: HoidConversationHistorySnapshot;
}>;

/**
 * Provider- and database-neutral persistence boundary.
 *
 * read() must return null only when the exact partition does not exist.
 * compareAndSwap() must atomically compare the current storageRevision
 * (null means absent) and replace the complete record, never merge it.
 * Adapters must decode external bytes into ordinary data records before
 * returning them; this port deliberately accepts unknown at runtime.
 */
export type HoidConversationHistoryStorePort = Readonly<{
  read: (key: HoidConversationStorageKey) => Promise<unknown | null>;
  compareAndSwap: (
    key: HoidConversationStorageKey,
    expectedStorageRevision: number | null,
    nextRecord: HoidConversationStorageRecord,
  ) => Promise<"saved" | "conflict">;
}>;

export type HoidConversationHistorySaveResult =
  | Readonly<{ status: "saved"; storageRevision: number }>
  | Readonly<{ status: "conflict" }>
  | Readonly<{ status: "stale-progress" }>
  | Readonly<{
      status: "invalid-input";
      reason: "invalid-store" | "invalid-key" | "invalid-storage-revision";
    }>
  | Readonly<{ status: "invalid-snapshot" }>
  | Readonly<{ status: "unavailable" }>;

export type HoidConversationHistoryLoadResult =
  | Readonly<{
      status: "ready";
      messages: readonly HoidPersistableConversationMessage[];
      storageRevision: number;
      savedProgressScope: HoidConversationProgressScope;
    }>
  | Readonly<{
      status: "stale";
      messages: readonly (
        | Extract<HoidPersistableConversationMessage, { emisor: "usuario" }>
        | Extract<HoidPersistableConversationMessage, { kind: "static-greeting" }>
      )[];
      storageRevision: number;
      savedProgressScope: HoidConversationProgressScope;
      droppedAssistantCount: number;
      requiresRewrite: true;
    }>
  | Readonly<{ status: "not-found" }>
  | Readonly<{
      status: "invalid-input";
      reason: "invalid-store" | "invalid-key";
    }>
  | Readonly<{ status: "invalid-record" }>
  | Readonly<{ status: "unavailable" }>;

type DataRecord = Record<string, unknown>;

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
): DataRecord | null {
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

function canonicalStorageKey(value: unknown): HoidConversationStorageKey | null {
  const record = canonicalRecord(value, ["principalId", "conversationId"]);
  if (!record) return null;

  const principalId = record.principalId;
  const conversationId = record.conversationId;
  if (
    typeof principalId !== "string" ||
    typeof conversationId !== "string" ||
    principalId.length > MAX_KEY_LENGTH ||
    conversationId.length > MAX_KEY_LENGTH ||
    !OPAQUE_KEY_PATTERN.test(principalId) ||
    !OPAQUE_KEY_PATTERN.test(conversationId)
  ) return null;

  return Object.freeze({ principalId, conversationId });
}

function canonicalStorePort(value: unknown): HoidConversationHistoryStorePort | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== 2 ||
      !keys.includes("read") ||
      !keys.includes("compareAndSwap")
    ) return null;

    const read = Object.getOwnPropertyDescriptor(value, "read");
    const compareAndSwap = Object.getOwnPropertyDescriptor(value, "compareAndSwap");
    if (
      !read ||
      !compareAndSwap ||
      !Object.prototype.hasOwnProperty.call(read, "value") ||
      !Object.prototype.hasOwnProperty.call(compareAndSwap, "value") ||
      read.enumerable !== true ||
      compareAndSwap.enumerable !== true ||
      typeof read.value !== "function" ||
      typeof compareAndSwap.value !== "function"
    ) return null;

    const readMethod = read.value as HoidConversationHistoryStorePort["read"];
    const compareAndSwapMethod =
      compareAndSwap.value as HoidConversationHistoryStorePort["compareAndSwap"];

    return Object.freeze({
      read: (key: HoidConversationStorageKey) => readMethod.call(value, key),
      compareAndSwap: (
        key: HoidConversationStorageKey,
        expectedStorageRevision: number | null,
        nextRecord: HoidConversationStorageRecord,
      ) => compareAndSwapMethod.call(value, key, expectedStorageRevision, nextRecord),
    });
  } catch {
    return null;
  }
}

function validExpectedStorageRevision(value: unknown): value is number | null {
  return value === null || (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MAX_STORAGE_REVISION
  );
}

function canonicalStorageRecord(
  value: unknown,
  key: HoidConversationStorageKey,
): Readonly<{
  storageRevision: number;
  snapshot: unknown;
}> | null {
  const record = canonicalRecord(value, [
    "schemaVersion",
    "kind",
    "principalId",
    "conversationId",
    "storageRevision",
    "snapshot",
  ]);
  if (
    !record ||
    record.schemaVersion !== HOID_CONVERSATION_STORAGE_SCHEMA_VERSION ||
    record.kind !== HOID_CONVERSATION_STORAGE_RECORD_KIND ||
    record.principalId !== key.principalId ||
    record.conversationId !== key.conversationId ||
    typeof record.storageRevision !== "number" ||
    !Number.isSafeInteger(record.storageRevision) ||
    record.storageRevision < 1 ||
    record.storageRevision > MAX_STORAGE_REVISION
  ) return null;

  return Object.freeze({
    storageRevision: record.storageRevision,
    snapshot: record.snapshot,
  });
}

/**
 * Saves a canonical snapshot with atomic compare-and-swap.
 *
 * The caller must refresh the authoritative reading progress immediately
 * before invoking this function. A snapshot whose progress identity differs
 * from that current identity is never written.
 */
export async function saveHoidConversationHistory(
  storeInput: unknown,
  keyInput: unknown,
  expectedStorageRevisionInput: unknown,
  snapshotInput: unknown,
  currentProgressScopeInput: unknown,
): Promise<HoidConversationHistorySaveResult> {
  const store = canonicalStorePort(storeInput);
  if (!store) return Object.freeze({ status: "invalid-input", reason: "invalid-store" });

  const key = canonicalStorageKey(keyInput);
  if (!key) return Object.freeze({ status: "invalid-input", reason: "invalid-key" });

  if (!validExpectedStorageRevision(expectedStorageRevisionInput)) {
    return Object.freeze({ status: "invalid-input", reason: "invalid-storage-revision" });
  }
  const expectedStorageRevision = expectedStorageRevisionInput;
  if (
    expectedStorageRevision !== null &&
    expectedStorageRevision >= MAX_STORAGE_REVISION
  ) return Object.freeze({ status: "invalid-input", reason: "invalid-storage-revision" });

  const hydrated = hydrateHoidConversationHistorySnapshot(
    snapshotInput,
    currentProgressScopeInput,
  );
  if (hydrated.status === "invalid") {
    return Object.freeze({ status: "invalid-snapshot" });
  }
  if (hydrated.status !== "ready") {
    return Object.freeze({ status: "stale-progress" });
  }

  const canonicalSnapshot = createHoidConversationHistorySnapshot(
    hydrated.messages,
    hydrated.savedProgressScope,
  );
  if (canonicalSnapshot.status !== "ready") {
    return Object.freeze({ status: "invalid-snapshot" });
  }

  const storageRevision = expectedStorageRevision === null
    ? 1
    : expectedStorageRevision + 1;
  const nextRecord: HoidConversationHistoryStorageRecord = Object.freeze({
    schemaVersion: HOID_CONVERSATION_STORAGE_SCHEMA_VERSION,
    kind: HOID_CONVERSATION_STORAGE_RECORD_KIND,
    principalId: key.principalId,
    conversationId: key.conversationId,
    storageRevision,
    snapshot: canonicalSnapshot.snapshot,
  });

  try {
    const result = await store.compareAndSwap(
      key,
      expectedStorageRevision,
      nextRecord,
    );
    if (result === "saved") {
      return Object.freeze({ status: "saved", storageRevision });
    }
    if (result === "conflict") return Object.freeze({ status: "conflict" });
    return Object.freeze({ status: "unavailable" });
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
}

/**
 * Loads only a record bound to the requested opaque principal/conversation
 * partition. Stale progress returns user-authored history and the exact static
 * greeting only; it never mutates storage. The caller may rewrite that safe
 * subset using the returned storageRevision as the CAS expectation.
 */
export async function loadHoidConversationHistory(
  storeInput: unknown,
  keyInput: unknown,
  currentProgressScopeInput: unknown,
): Promise<HoidConversationHistoryLoadResult> {
  const store = canonicalStorePort(storeInput);
  if (!store) return Object.freeze({ status: "invalid-input", reason: "invalid-store" });

  const key = canonicalStorageKey(keyInput);
  if (!key) return Object.freeze({ status: "invalid-input", reason: "invalid-key" });

  let rawRecord: unknown | null;
  try {
    rawRecord = await store.read(key);
  } catch {
    return Object.freeze({ status: "unavailable" });
  }
  if (rawRecord === null) return Object.freeze({ status: "not-found" });

  const record = canonicalStorageRecord(rawRecord, key);
  if (!record) return Object.freeze({ status: "invalid-record" });

  const hydrated = hydrateHoidConversationHistorySnapshot(
    record.snapshot,
    currentProgressScopeInput,
  );
  if (hydrated.status === "invalid") return Object.freeze({ status: "invalid-record" });

  if (hydrated.status === "ready") {
    return Object.freeze({
      status: "ready",
      messages: hydrated.messages,
      storageRevision: record.storageRevision,
      savedProgressScope: hydrated.savedProgressScope,
    });
  }

  return Object.freeze({
    status: "stale",
    messages: hydrated.messages,
    storageRevision: record.storageRevision,
    savedProgressScope: hydrated.savedProgressScope,
    droppedAssistantCount: hydrated.droppedAssistantCount,
    requiresRewrite: true,
  });
}
