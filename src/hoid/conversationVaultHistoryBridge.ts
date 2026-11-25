import {
  createHoidConversationHistorySnapshot,
  hydrateHoidConversationHistorySnapshot,
  type HoidPersistableConversationMessage,
} from "./conversationHistoryHydration";
import type { HoidConversationProgressScope } from "./conversationHistoryPolicy";
import type { HoidConversationVault, HoidConversationVaultResult } from "./conversationVault";

const SESSION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/u;

function canonicalVault(value: unknown): HoidConversationVault | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== 3 ||
      !keys.includes("restore") ||
      !keys.includes("save") ||
      !keys.includes("clear")
    ) return null;

    const restore = Object.getOwnPropertyDescriptor(value, "restore");
    const save = Object.getOwnPropertyDescriptor(value, "save");
    const clear = Object.getOwnPropertyDescriptor(value, "clear");
    if (
      !restore || !save || !clear ||
      !Object.prototype.hasOwnProperty.call(restore, "value") ||
      !Object.prototype.hasOwnProperty.call(save, "value") ||
      !Object.prototype.hasOwnProperty.call(clear, "value") ||
      restore.enumerable !== true ||
      save.enumerable !== true ||
      clear.enumerable !== true ||
      typeof restore.value !== "function" ||
      typeof save.value !== "function" ||
      typeof clear.value !== "function"
    ) return null;

    const restoreMethod = restore.value as HoidConversationVault["restore"];
    const saveMethod = save.value as HoidConversationVault["save"];
    const clearMethod = clear.value as HoidConversationVault["clear"];
    return Object.freeze({
      restore: (sessionId: string) => restoreMethod.call(value, sessionId),
      save: (sessionId: string, expectedRevision: number, snapshot: unknown) =>
        saveMethod.call(value, sessionId, expectedRevision, snapshot),
      clear: (sessionId: string, expectedRevision: number) =>
        clearMethod.call(value, sessionId, expectedRevision),
    });
  } catch {
    return null;
  }
}

type VaultBlockedReason = Extract<
  HoidConversationVaultResult,
  { status: "blocked" }
>["reason"];

const MAX_EXPECTED_REVISION = Number.MAX_SAFE_INTEGER - 1;

const VAULT_BLOCKED_REASONS: readonly VaultBlockedReason[] = [
  "invalid-session",
  "invalid-revision",
  "checkpoint-unavailable",
  "blob-store-unavailable",
  "checkpoint-envelope-mismatch",
  "invalid-envelope",
  "aad-mismatch",
  "key-unavailable",
  "encryption-failed",
  "decryption-failed",
  "invalid-plaintext",
  "codec-rejected",
  "checkpoint-commit-failed",
];

function exactDataRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some(key => typeof key !== "string" || !keys.includes(key))
    ) return null;
    const record = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }
    return record;
  } catch {
    return null;
  }
}

function validRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validExpectedRevision(value: unknown): value is number {
  return validRevision(value) && value <= MAX_EXPECTED_REVISION;
}

/** Runtime validation for values crossing the vault adapter boundary. */
function canonicalVaultResult(value: unknown): HoidConversationVaultResult | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const statusDescriptor = Object.getOwnPropertyDescriptor(value, "status");
    if (
      !statusDescriptor ||
      !Object.prototype.hasOwnProperty.call(statusDescriptor, "value") ||
      statusDescriptor.enumerable !== true
    ) return null;

    switch (statusDescriptor.value) {
      case "empty": {
        const record = exactDataRecord(value, ["status", "revision"]);
        if (!record || !validRevision(record.revision)) return null;
        return Object.freeze({ status: "empty", revision: record.revision });
      }
      case "ready": {
        const record = exactDataRecord(value, ["status", "revision", "snapshot"]);
        if (!record || !validRevision(record.revision) || record.revision < 1) return null;
        return Object.freeze({ status: "ready", revision: record.revision, snapshot: record.snapshot });
      }
      case "saved":
      case "cleared": {
        const record = exactDataRecord(value, ["status", "revision"]);
        if (!record || !validRevision(record.revision) || record.revision < 1) return null;
        return Object.freeze({ status: statusDescriptor.value, revision: record.revision });
      }
      case "conflict": {
        const record = exactDataRecord(value, ["status", "revision"]);
        if (!record || !(record.revision === null || validRevision(record.revision))) return null;
        return Object.freeze({ status: "conflict", revision: record.revision });
      }
      case "blocked": {
        const record = exactDataRecord(value, ["status", "reason"]);
        if (
          !record ||
          typeof record.reason !== "string" ||
          !VAULT_BLOCKED_REASONS.includes(record.reason as VaultBlockedReason)
        ) return null;
        return Object.freeze({ status: "blocked", reason: record.reason as VaultBlockedReason });
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export type HoidConversationVaultHistorySaveResult =
  | Readonly<{
      status: "invalid-history";
      reason: "invalid-progress" | "invalid-messages";
    }>
  | Readonly<{ status: "invalid-input"; reason: "invalid-revision" }>
  | Extract<HoidConversationVaultResult, { status: "saved" | "conflict" }>
  | Readonly<{ status: "blocked"; reason: VaultBlockedReason | "invalid-vault-result" }>;

export type HoidConversationVaultHistoryClearResult =
  | Readonly<{ status: "invalid-input"; reason: "invalid-revision" }>
  | Extract<HoidConversationVaultResult, { status: "cleared" | "conflict" }>
  | Readonly<{ status: "blocked"; reason: VaultBlockedReason | "invalid-vault-result" }>;

export type HoidConversationVaultHistoryRestoreResult =
  | Extract<HoidConversationVaultResult, { status: "empty" }>
  | Readonly<{
      status: "ready";
      revision: number;
      messages: readonly HoidPersistableConversationMessage[];
      savedProgressScope: HoidConversationProgressScope;
      droppedAssistantCount: 0;
    }>
  | Readonly<{
      status: "stale";
      revision: number;
      messages: readonly HoidPersistableConversationMessage[];
      savedProgressScope: HoidConversationProgressScope;
      droppedAssistantCount: number;
    }>
  | Readonly<{
      status: "blocked";
      reason: VaultBlockedReason | "invalid-history-snapshot" | "invalid-vault-result";
    }>;

export type HoidConversationVaultHistoryBridge = Readonly<{
  save(
    expectedRevision: number,
    messages: unknown,
    progressScope: unknown,
  ): Promise<HoidConversationVaultHistorySaveResult>;
  restore(currentProgressScope: unknown): Promise<HoidConversationVaultHistoryRestoreResult>;
  clear(expectedRevision: number): Promise<HoidConversationVaultHistoryClearResult>;
}>;

/**
 * Session-bound bridge between encrypted vault persistence and the existing
 * progress-scoped history policy. Restore never exposes the raw snapshot:
 * assistant prose is filtered against the live progress scope first.
 */
export function createHoidConversationVaultHistoryBridge(
  vaultInput: unknown,
  sessionId: string,
): HoidConversationVaultHistoryBridge | null {
  const vault = canonicalVault(vaultInput);
  if (!vault || typeof sessionId !== "string" || !SESSION_ID_PATTERN.test(sessionId)) return null;

  const save = async (
    expectedRevision: number,
    messages: unknown,
    progressScope: unknown,
  ): Promise<HoidConversationVaultHistorySaveResult> => {
    if (!validExpectedRevision(expectedRevision)) {
      return Object.freeze({ status: "invalid-input", reason: "invalid-revision" });
    }
    const created = createHoidConversationHistorySnapshot(messages, progressScope);
    if (created.status !== "ready") {
      return Object.freeze({ status: "invalid-history", reason: created.reason });
    }
    let rawSaved: unknown;
    try {
      rawSaved = await vault.save(sessionId, expectedRevision, created.snapshot);
    } catch {
      return Object.freeze({ status: "blocked", reason: "blob-store-unavailable" });
    }
    const saved = canonicalVaultResult(rawSaved);
    if (!saved) return Object.freeze({ status: "blocked", reason: "invalid-vault-result" });
    if (saved.status === "blocked" || saved.status === "conflict") return saved;
    if (saved.status === "saved" && saved.revision === expectedRevision + 1) return saved;
    return Object.freeze({ status: "blocked", reason: "invalid-vault-result" });
  };

  const restore = async (
    currentProgressScope: unknown,
  ): Promise<HoidConversationVaultHistoryRestoreResult> => {
    let rawRestored: unknown;
    try {
      rawRestored = await vault.restore(sessionId);
    } catch {
      return Object.freeze({ status: "blocked", reason: "blob-store-unavailable" });
    }
    const restored = canonicalVaultResult(rawRestored);
    if (!restored) return Object.freeze({ status: "blocked", reason: "invalid-vault-result" });
    if (restored.status === "empty" || restored.status === "blocked") return restored;
    if (restored.status !== "ready") {
      return Object.freeze({ status: "blocked", reason: "invalid-vault-result" });
    }

    const hydrated = hydrateHoidConversationHistorySnapshot(
      restored.snapshot,
      currentProgressScope,
    );
    if (hydrated.status === "invalid") {
      return Object.freeze({ status: "blocked", reason: "invalid-history-snapshot" });
    }

    if (hydrated.status === "ready") {
      return Object.freeze({
        status: "ready",
        revision: restored.revision,
        messages: hydrated.messages,
        savedProgressScope: hydrated.savedProgressScope,
        droppedAssistantCount: 0,
      });
    }

    return Object.freeze({
      status: "stale",
      revision: restored.revision,
      messages: hydrated.messages,
      savedProgressScope: hydrated.savedProgressScope,
      droppedAssistantCount: hydrated.droppedAssistantCount,
    });
  };

  const clear = async (
    expectedRevision: number,
  ): Promise<HoidConversationVaultHistoryClearResult> => {
    if (!validExpectedRevision(expectedRevision)) {
      return Object.freeze({ status: "invalid-input", reason: "invalid-revision" });
    }
    let rawCleared: unknown;
    try {
      rawCleared = await vault.clear(sessionId, expectedRevision);
    } catch {
      return Object.freeze({ status: "blocked", reason: "blob-store-unavailable" });
    }
    const cleared = canonicalVaultResult(rawCleared);
    if (!cleared) return Object.freeze({ status: "blocked", reason: "invalid-vault-result" });
    if (cleared.status === "blocked" || cleared.status === "conflict") return cleared;
    if (cleared.status === "cleared" && cleared.revision === expectedRevision + 1) return cleared;
    return Object.freeze({ status: "blocked", reason: "invalid-vault-result" });
  };

  return Object.freeze({ save, restore, clear });
}
