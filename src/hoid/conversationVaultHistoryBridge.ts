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

export type HoidConversationVaultHistorySaveResult =
  | Readonly<{
      status: "invalid-history";
      reason: "invalid-progress" | "invalid-messages";
    }>
  | Extract<HoidConversationVaultResult, { status: "saved" | "conflict" | "blocked" }>;

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
      reason: VaultBlockedReason | "invalid-history-snapshot";
    }>;

export type HoidConversationVaultHistoryBridge = Readonly<{
  save(
    expectedRevision: number,
    messages: unknown,
    progressScope: unknown,
  ): Promise<HoidConversationVaultHistorySaveResult>;
  restore(currentProgressScope: unknown): Promise<HoidConversationVaultHistoryRestoreResult>;
  clear(expectedRevision: number): ReturnType<HoidConversationVault["clear"]>;
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
    const created = createHoidConversationHistorySnapshot(messages, progressScope);
    if (created.status !== "ready") {
      return Object.freeze({ status: "invalid-history", reason: created.reason });
    }
    let saved: HoidConversationVaultResult;
    try {
      saved = await vault.save(sessionId, expectedRevision, created.snapshot);
    } catch {
      return Object.freeze({ status: "blocked", reason: "blob-store-unavailable" });
    }
    if (
      saved.status === "saved" ||
      saved.status === "conflict" ||
      saved.status === "blocked"
    ) return saved;
    return Object.freeze({ status: "blocked", reason: "codec-rejected" });
  };

  const restore = async (
    currentProgressScope: unknown,
  ): Promise<HoidConversationVaultHistoryRestoreResult> => {
    let restored: HoidConversationVaultResult;
    try {
      restored = await vault.restore(sessionId);
    } catch {
      return Object.freeze({ status: "blocked", reason: "blob-store-unavailable" });
    }
    if (restored.status === "empty" || restored.status === "blocked") return restored;
    if (restored.status !== "ready") {
      return Object.freeze({ status: "blocked", reason: "invalid-history-snapshot" });
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

  return Object.freeze({
    save,
    restore,
    clear: async (expectedRevision: number) => {
      try {
        return await vault.clear(sessionId, expectedRevision);
      } catch {
        return Object.freeze({ status: "blocked", reason: "blob-store-unavailable" });
      }
    },
  });
}
