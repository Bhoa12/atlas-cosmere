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

const trustedBackends = new WeakSet<object>();
const activeAuthorityIds = new Set<string>();

export type HoidConversationHistoryAuthorityKind =
  | "sqlite-history-v1"
  | "vault-history-v1";

export type HoidConversationHistoryAuthorityBlocked = Readonly<{
  status: "blocked";
  reason: "authority-disposed" | "backend-failed";
}>;

export type HoidConversationHistoryAuthorityInvalidRevision = Readonly<{
  status: "invalid-input";
  reason: "invalid-authority-revision";
}>;

export type HoidConversationHistoryAuthorityRestoreResult =
  | HoidConversationHistoryLoadResult
  | HoidConversationVaultHistoryRestoreResult
  | HoidConversationHistoryAuthorityBlocked;

export type HoidConversationHistoryAuthoritySaveResult =
  | HoidConversationHistorySaveResult
  | HoidConversationVaultHistorySaveResult
  | HoidConversationHistoryAuthorityInvalidRevision
  | HoidConversationHistoryAuthorityBlocked;

export type HoidConversationHistoryAuthorityClearResult =
  | HoidConversationVaultHistoryClearResult
  | Readonly<{ status: "unsupported"; reason: "backend-does-not-support-tombstone" }>
  | HoidConversationHistoryAuthorityInvalidRevision
  | HoidConversationHistoryAuthorityBlocked>;

/**
 * A backend port is deliberately singular: one authority instance receives
 * exactly one selected backend, never a list of fallbacks or dual writers.
 */
export type HoidConversationHistoryAuthorityBackendPort = Readonly<{
  kind: HoidConversationHistoryAuthorityKind;
  restore: (
    currentProgressScope: unknown,
  ) => Promise<
    HoidConversationHistoryLoadResult | HoidConversationVaultHistoryRestoreResult
  >;
  save: (
    expectedRevision: number,
    messages: unknown,
    currentProgressScope: unknown,
  ) => Promise<HoidConversationHistorySaveResult | HoidConversationVaultHistorySaveResult>;
  clear: (
    expectedRevision: number,
  ) => Promise<
    HoidConversationVaultHistoryClearResult |
    Readonly<{ status: "unsupported"; reason: "backend-does-not-support-tombstone" }>
  >;
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

/**
 * Adapts the existing encrypted SQLite history store to the common authority
 * contract. Revision 0 means create-only; positive revisions map directly to
 * the SQLite storage revision. SQLite v1 has no tombstone operation, so clear
 * is explicitly unsupported rather than simulated by an empty conversation.
 */
export function createHoidSqliteConversationHistoryAuthorityBackend(
  store: HoidConversationHistoryStorePort,
  key: HoidConversationStorageKey,
): HoidConversationHistoryAuthorityBackendPort {
  const backend: HoidConversationHistoryAuthorityBackendPort = Object.freeze({
    kind: "sqlite-history-v1",
    restore: (scope: unknown) => loadHoidConversationHistory(store, key, scope),
    save: async (
      expectedRevision: number,
      messages: unknown,
      scope: unknown,
    ): Promise<HoidConversationHistorySaveResult> => {
      if (!validExpectedRevision(expectedRevision)) {
        return Object.freeze({
          status: "invalid-input",
          reason: "invalid-storage-revision",
        });
      }
      const created = createHoidConversationHistorySnapshot(messages, scope);
      if (created.status !== "ready") {
        return Object.freeze({ status: "invalid-snapshot" });
      }
      return saveHoidConversationHistory(
        store,
        key,
        expectedRevision === 0 ? null : expectedRevision,
        created.snapshot,
        scope,
      );
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
    restore: (scope: unknown) => bridge.restore(scope),
    save: (revision: number, messages: unknown, scope: unknown) =>
      bridge.save(revision, messages, scope),
    clear: (revision: number) => bridge.clear(revision),
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

  const blocked = (reason: "authority-disposed" | "backend-failed") =>
    Object.freeze({ status: "blocked" as const, reason });

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
    enqueue(
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
        reason: "invalid-authority-revision",
      }));
    }
    return enqueue(
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
        reason: "invalid-authority-revision",
      }));
    }
    return enqueue(
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
