import {
  createHoidConversationHistorySnapshot,
  type HoidPersistableConversationMessage,
} from "./conversationHistoryHydration";
import {
  loadHoidConversationHistory,
  saveHoidConversationHistory,
  type HoidConversationHistoryLoadResult,
  type HoidConversationHistorySaveResult,
  type HoidConversationHistoryStorePort,
  type HoidConversationStorageKey,
} from "./conversationHistoryStorePort";
import {
  type HoidConversationVaultHistoryBridge,
  type HoidConversationVaultHistoryClearResult,
  type HoidConversationVaultHistoryRestoreResult,
  type HoidConversationVaultHistorySaveResult,
} from "./conversationVaultHistoryBridge";
import type { HoidConversationProgressScope } from "./conversationHistoryPolicy";

const AUTHORITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const MAX_EXPECTED_REVISION = Number.MAX_SAFE_INTEGER - 1;
const OPAQUE_STORAGE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

const trustedBackends = new WeakSet<object>();
const activeAuthorityIds = new Set<string>();

type SafeHistoryMessage =
  | Extract<HoidPersistableConversationMessage, { emisor: "usuario" }>
  | Extract<HoidPersistableConversationMessage, { kind: "static-greeting" }>;

export type HoidConversationHistoryAuthorityKind =
  | "sqlite-history-v1"
  | "vault-history-v1";

export type HoidConversationHistoryAuthorityBlocked =
  | Readonly<{
      status: "blocked";
      reason:
        | "authority-disposed"
        | "backend-failed"
        | "backend-unavailable"
        | "invalid-record"
        | "invalid-backend-input"
        | "stale-progress";
    }>
  | Readonly<{
      status: "blocked";
      reason: "vault-blocked";
      detail: string;
    }>;

export type HoidConversationHistoryAuthorityRestoreResult =
  | Readonly<{ status: "empty"; revision: number }>
  | Readonly<{
      status: "ready";
      revision: number;
      messages: readonly HoidPersistableConversationMessage[];
      savedProgressScope: HoidConversationProgressScope;
    }>
  | Readonly<{
      status: "stale";
      revision: number;
      messages: readonly SafeHistoryMessage[];
      savedProgressScope: HoidConversationProgressScope;
      droppedAssistantCount: number;
    }>
  | HoidConversationHistoryAuthorityBlocked;

export type HoidConversationHistoryAuthoritySaveResult =
  | Readonly<{ status: "saved"; revision: number }>
  | Readonly<{ status: "conflict" }>
  | Readonly<{ status: "invalid-input"; reason: "invalid-revision" | "invalid-history" }>
  | HoidConversationHistoryAuthorityBlocked;

export type HoidConversationHistoryAuthorityClearResult =
  | Readonly<{ status: "cleared"; revision: number }>
  | Readonly<{ status: "conflict" }>
  | Readonly<{ status: "unsupported"; reason: "backend-does-not-support-tombstone" }>
  | Readonly<{ status: "invalid-input"; reason: "invalid-revision" }>
  | HoidConversationHistoryAuthorityBlocked;

/**
 * Backend adapters expose one normalized result contract. The selected backend
 * kind remains metadata; callers do not need to branch on SQLite/vault result
 * field names or error unions.
 */
export type HoidConversationHistoryAuthorityBackendPort = Readonly<{
  kind: HoidConversationHistoryAuthorityKind;
  restore: (
    currentProgressScope: unknown,
  ) => Promise<HoidConversationHistoryAuthorityRestoreResult>;
  save: (
    expectedRevision: number,
    messages: unknown,
    currentProgressScope: unknown,
  ) => Promise<HoidConversationHistoryAuthoritySaveResult>;
  clear: (
    expectedRevision: number,
  ) => Promise<HoidConversationHistoryAuthorityClearResult>;
}>;

export type HoidConversationHistoryAuthority = Readonly<{
  kind: HoidConversationHistoryAuthorityKind;
  restore: (
    currentProgressScope: unknown,
  ) => Promise<HoidConversationHistoryAuthorityRestoreResult>;
  save: (
    expectedRevision: number,
    messages: unknown,
    currentProgressScope: unknown,
  ) => Promise<HoidConversationHistoryAuthoritySaveResult>;
  clear: (
    expectedRevision: number,
  ) => Promise<HoidConversationHistoryAuthorityClearResult>;
  dispose: () => void;
}>;

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

function validExpectedRevision(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_EXPECTED_REVISION
  );
}

function blocked(
  reason: Exclude<HoidConversationHistoryAuthorityBlocked, { reason: "vault-blocked" }>["reason"],
): HoidConversationHistoryAuthorityBlocked {
  return Object.freeze({ status: "blocked", reason });
}

function blockedByVault(detail: string): HoidConversationHistoryAuthorityBlocked {
  return Object.freeze({ status: "blocked", reason: "vault-blocked", detail });
}

function rememberBackend(
  value: HoidConversationHistoryAuthorityBackendPort,
): HoidConversationHistoryAuthorityBackendPort {
  trustedBackends.add(value);
  return value;
}

function canonicalVaultBridge(value: unknown): HoidConversationVaultHistoryBridge | null {
  const record = exactDataRecord(value, ["restore", "save", "clear"]);
  if (
    !record ||
    typeof record.restore !== "function" ||
    typeof record.save !== "function" ||
    typeof record.clear !== "function"
  ) return null;

  const restore = record.restore as HoidConversationVaultHistoryBridge["restore"];
  const save = record.save as HoidConversationVaultHistoryBridge["save"];
  const clear = record.clear as HoidConversationVaultHistoryBridge["clear"];
  return Object.freeze({
    restore: (scope: unknown) => restore.call(value, scope),
    save: (revision: number, messages: unknown, scope: unknown) =>
      save.call(value, revision, messages, scope),
    clear: (revision: number) => clear.call(value, revision),
  });
}

function normalizeSqliteRestore(
  result: HoidConversationHistoryLoadResult,
): HoidConversationHistoryAuthorityRestoreResult {
  switch (result.status) {
    case "not-found":
      return Object.freeze({ status: "empty", revision: 0 });
    case "ready":
      return Object.freeze({
        status: "ready",
        revision: result.storageRevision,
        messages: result.messages,
        savedProgressScope: result.savedProgressScope,
      });
    case "stale":
      return Object.freeze({
        status: "stale",
        revision: result.storageRevision,
        messages: result.messages,
        savedProgressScope: result.savedProgressScope,
        droppedAssistantCount: result.droppedAssistantCount,
      });
    case "invalid-input":
      return blocked("invalid-backend-input");
    case "invalid-record":
      return blocked("invalid-record");
    case "unavailable":
      return blocked("backend-unavailable");
  }
}

function normalizeSqliteSave(
  result: HoidConversationHistorySaveResult,
): HoidConversationHistoryAuthoritySaveResult {
  switch (result.status) {
    case "saved":
      return Object.freeze({ status: "saved", revision: result.storageRevision });
    case "conflict":
      return Object.freeze({ status: "conflict" });
    case "invalid-snapshot":
      return Object.freeze({ status: "invalid-input", reason: "invalid-history" });
    case "stale-progress":
      return blocked("stale-progress");
    case "invalid-input":
      return blocked("invalid-backend-input");
    case "unavailable":
      return blocked("backend-unavailable");
  }
}

function normalizeVaultRestore(
  result: HoidConversationVaultHistoryRestoreResult,
): HoidConversationHistoryAuthorityRestoreResult {
  switch (result.status) {
    case "empty":
      return Object.freeze({ status: "empty", revision: result.revision });
    case "ready":
      return Object.freeze({
        status: "ready",
        revision: result.revision,
        messages: result.messages,
        savedProgressScope: result.savedProgressScope,
      });
    case "stale":
      return Object.freeze({
        status: "stale",
        revision: result.revision,
        messages: result.messages.filter(
          (message): message is SafeHistoryMessage =>
            message.emisor === "usuario" || ("kind" in message && message.kind === "static-greeting"),
        ),
        savedProgressScope: result.savedProgressScope,
        droppedAssistantCount: result.droppedAssistantCount,
      });
    case "blocked":
      return result.reason === "invalid-history-snapshot" ||
        result.reason === "invalid-vault-result"
        ? blocked("invalid-record")
        : blockedByVault(result.reason);
  }
}

function normalizeVaultSave(
  result: HoidConversationVaultHistorySaveResult,
): HoidConversationHistoryAuthoritySaveResult {
  switch (result.status) {
    case "saved":
      return Object.freeze({ status: "saved", revision: result.revision });
    case "conflict":
      return Object.freeze({ status: "conflict" });
    case "invalid-input":
      return Object.freeze({ status: "invalid-input", reason: "invalid-revision" });
    case "invalid-history":
      return Object.freeze({ status: "invalid-input", reason: "invalid-history" });
    case "blocked":
      return blockedByVault(result.reason);
  }
}

function normalizeVaultClear(
  result: HoidConversationVaultHistoryClearResult,
): HoidConversationHistoryAuthorityClearResult {
  switch (result.status) {
    case "cleared":
      return Object.freeze({ status: "cleared", revision: result.revision });
    case "conflict":
      return Object.freeze({ status: "conflict" });
    case "invalid-input":
      return Object.freeze({ status: "invalid-input", reason: "invalid-revision" });
    case "blocked":
      return blockedByVault(result.reason);
  }
}

/**
 * Adapts the existing encrypted SQLite history store to the common authority
 * contract. Revision 0 means create-only; positive revisions map directly to
 * the SQLite storage revision. SQLite v1 has no tombstone operation, so clear
 * is explicitly unsupported rather than simulated by an empty conversation.
 */
export function createHoidSqliteConversationHistoryAuthorityBackend(
  storeInput: unknown,
  keyInput: unknown,
): HoidConversationHistoryAuthorityBackendPort | null {
  const storeRecord = exactDataRecord(storeInput, ["read", "compareAndSwap"]);
  const keyRecord = exactDataRecord(keyInput, ["principalId", "conversationId"]);
  if (
    !storeRecord ||
    !keyRecord ||
    typeof storeRecord.read !== "function" ||
    typeof storeRecord.compareAndSwap !== "function" ||
    typeof keyRecord.principalId !== "string" ||
    typeof keyRecord.conversationId !== "string" ||
    !OPAQUE_STORAGE_KEY_PATTERN.test(keyRecord.principalId) ||
    !OPAQUE_STORAGE_KEY_PATTERN.test(keyRecord.conversationId)
  ) return null;

  const readMethod = storeRecord.read as HoidConversationHistoryStorePort["read"];
  const compareAndSwapMethod =
    storeRecord.compareAndSwap as HoidConversationHistoryStorePort["compareAndSwap"];
  const capturedStore: HoidConversationHistoryStorePort = Object.freeze({
    read: (key: HoidConversationStorageKey) => readMethod.call(storeInput, key),
    compareAndSwap: (
      key: HoidConversationStorageKey,
      expectedRevision: number | null,
      nextRecord: Parameters<HoidConversationHistoryStorePort["compareAndSwap"]>[2],
    ) => compareAndSwapMethod.call(storeInput, key, expectedRevision, nextRecord),
  });
  const capturedKey: HoidConversationStorageKey = Object.freeze({
    principalId: keyRecord.principalId,
    conversationId: keyRecord.conversationId,
  });

  const backend: HoidConversationHistoryAuthorityBackendPort = Object.freeze({
    kind: "sqlite-history-v1",
    restore: async (scope: unknown) =>
      normalizeSqliteRestore(await loadHoidConversationHistory(capturedStore, capturedKey, scope)),
    save: async (
      expectedRevision: number,
      messages: unknown,
      scope: unknown,
    ): Promise<HoidConversationHistoryAuthoritySaveResult> => {
      if (!validExpectedRevision(expectedRevision)) {
        return Object.freeze({ status: "invalid-input", reason: "invalid-revision" });
      }
      const created = createHoidConversationHistorySnapshot(messages, scope);
      if (created.status !== "ready") {
        return Object.freeze({ status: "invalid-input", reason: "invalid-history" });
      }
      const result = await saveHoidConversationHistory(
        capturedStore,
        capturedKey,
        expectedRevision === 0 ? null : expectedRevision,
        created.snapshot,
        scope,
      );
      return normalizeSqliteSave(result);
    },
    clear: async () => Object.freeze({
      status: "unsupported",
      reason: "backend-does-not-support-tombstone",
    }),
  });
  return rememberBackend(backend);
}
/** Adapts the session-bound encrypted vault bridge without adding a fallback. */
export function createHoidVaultConversationHistoryAuthorityBackend(
  bridgeInput: unknown,
): HoidConversationHistoryAuthorityBackendPort | null {
  const bridge = canonicalVaultBridge(bridgeInput);
  if (!bridge) return null;

  const backend: HoidConversationHistoryAuthorityBackendPort = Object.freeze({
    kind: "vault-history-v1",
    restore: async (scope: unknown) => normalizeVaultRestore(await bridge.restore(scope)),
    save: async (revision: number, messages: unknown, scope: unknown) =>
      normalizeVaultSave(await bridge.save(revision, messages, scope)),
    clear: async (revision: number) => normalizeVaultClear(await bridge.clear(revision)),
  });
  return rememberBackend(backend);
}

/**
 * Creates one in-process authority for one opaque conversation partition.
 *
 * The per-instance queue serializes restore/save/clear. The module-local
 * registry rejects a second live authority with the same authorityId. The
 * underlying adapter CAS remains responsible for cross-instance/process
 * concurrency. This is not a durable lease or a cross-device migration lock.
 */
export function createHoidConversationHistoryAuthority(
  selectionInput: unknown,
): HoidConversationHistoryAuthority | null {
  const selection = exactDataRecord(selectionInput, ["authorityId", "backend"]);
  if (
    !selection ||
    typeof selection.authorityId !== "string" ||
    !AUTHORITY_ID_PATTERN.test(selection.authorityId) ||
    selection.backend === null ||
    typeof selection.backend !== "object" ||
    !trustedBackends.has(selection.backend)
  ) return null;

  const backendRecord = exactDataRecord(selection.backend, [
    "kind",
    "restore",
    "save",
    "clear",
  ]);
  if (
    !backendRecord ||
    (backendRecord.kind !== "sqlite-history-v1" && backendRecord.kind !== "vault-history-v1") ||
    typeof backendRecord.restore !== "function" ||
    typeof backendRecord.save !== "function" ||
    typeof backendRecord.clear !== "function"
  ) return null;

  const authorityId = selection.authorityId;
  if (activeAuthorityIds.has(authorityId)) return null;

  const kind = backendRecord.kind;
  const restoreMethod = backendRecord.restore as HoidConversationHistoryAuthorityBackendPort["restore"];
  const saveMethod = backendRecord.save as HoidConversationHistoryAuthorityBackendPort["save"];
  const clearMethod = backendRecord.clear as HoidConversationHistoryAuthorityBackendPort["clear"];

  activeAuthorityIds.add(authorityId);
  let disposed = false;
  let released = false;
  let tail: Promise<void> = Promise.resolve();

  const enqueue = <T>(
    operation: () => Promise<T>,
    disposedResult: T,
    failedResult: T,
  ): Promise<T> => {
    const task = tail.then(async () => {
      if (disposed) return disposedResult;
      try {
        const result = await operation();
        return disposed ? disposedResult : result;
      } catch {
        return failedResult;
      }
    });
    tail = task.then(() => undefined, () => undefined);
    return task;
  };

  const restore = (scope: unknown): Promise<HoidConversationHistoryAuthorityRestoreResult> =>
    enqueue<HoidConversationHistoryAuthorityRestoreResult>(
      () => restoreMethod.call(selection.backend, scope),
      blocked("authority-disposed"),
      blocked("backend-failed"),
    );

  const save = (
    expectedRevision: number,
    messages: unknown,
    scope: unknown,
  ): Promise<HoidConversationHistoryAuthoritySaveResult> => {
    if (!validExpectedRevision(expectedRevision)) {
      return Promise.resolve(Object.freeze({
        status: "invalid-input",
        reason: "invalid-revision",
      }));
    }
    return enqueue<HoidConversationHistoryAuthoritySaveResult>(
      () => saveMethod.call(selection.backend, expectedRevision, messages, scope),
      blocked("authority-disposed"),
      blocked("backend-failed"),
    );
  };

  const clear = (
    expectedRevision: number,
  ): Promise<HoidConversationHistoryAuthorityClearResult> => {
    if (!validExpectedRevision(expectedRevision)) {
      return Promise.resolve(Object.freeze({
        status: "invalid-input",
        reason: "invalid-revision",
      }));
    }
    return enqueue<HoidConversationHistoryAuthorityClearResult>(
      () => clearMethod.call(selection.backend, expectedRevision),
      blocked("authority-disposed"),
      blocked("backend-failed"),
    );
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    const release = (): void => {
      if (released) return;
      released = true;
      activeAuthorityIds.delete(authorityId);
    };
    void tail.then(release, release);
  };

  return Object.freeze({ kind, restore, save, clear, dispose });
}
