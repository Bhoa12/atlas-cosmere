import {
  createHoidConversationHistorySnapshot,
  hydrateHoidConversationHistorySnapshot,
  type HoidPersistableConversationMessage,
  type HoidConversationProgressScope,
} from "./conversationHistoryHydration";
import type { HoidConversationVault, HoidConversationVaultResult } from "./conversationVault";

const SESSION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,95}$/u;

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
  vault: HoidConversationVault,
  sessionId: string,
): HoidConversationVaultHistoryBridge | null {
  if (
    vault === null ||
    typeof vault !== "object" ||
    typeof vault.restore !== "function" ||
    typeof vault.save !== "function" ||
    typeof vault.clear !== "function" ||
    typeof sessionId !== "string" ||
    !SESSION_ID_PATTERN.test(sessionId)
  ) return null;

  const save = async (
    expectedRevision: number,
    messages: unknown,
    progressScope: unknown,
  ): Promise<HoidConversationVaultHistorySaveResult> => {
    const created = createHoidConversationHistorySnapshot(messages, progressScope);
    if (created.status !== "ready") {
      return Object.freeze({ status: "invalid-history", reason: created.reason });
    }
    return vault.save(sessionId, expectedRevision, created.snapshot);
  };

  const restore = async (
    currentProgressScope: unknown,
  ): Promise<HoidConversationVaultHistoryRestoreResult> => {
    const restored = await vault.restore(sessionId);
    if (restored.status === "empty" || restored.status === "blocked") return restored;

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
    clear: (expectedRevision: number) => vault.clear(sessionId, expectedRevision),
  });
}
