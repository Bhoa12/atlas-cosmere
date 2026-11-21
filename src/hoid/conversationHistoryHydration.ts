import {
  HOID_STATIC_GREETING_ID,
  HOID_STATIC_GREETING_KIND,
  HOID_STATIC_GREETING_TEXT,
  isHoidConversationMessageVisible,
  isHoidConversationProgressScope,
  sameHoidConversationProgressScope,
  type HoidConversationProgressScope,
} from "./conversationHistoryPolicy";

export const HOID_CONVERSATION_HISTORY_SCHEMA_VERSION = 1 as const;
export const HOID_CONVERSATION_HISTORY_KIND = "hoid-conversation-history" as const;

const MAX_HISTORY_MESSAGES = 200;
const MAX_MESSAGE_ID_LENGTH = 128;
const MAX_MESSAGE_TEXT_LENGTH = 50_000;
const MAX_TOTAL_TEXT_LENGTH = 250_000;

export type HoidPersistableUserMessage = Readonly<{
  id: string;
  emisor: "usuario";
  texto: string;
}>;

export type HoidPersistableAssistantMessage = Readonly<{
  id: string;
  emisor: "hoid";
  texto: string;
  progressScope: HoidConversationProgressScope;
}>;

export type HoidPersistableGreeting = Readonly<{
  id: typeof HOID_STATIC_GREETING_ID;
  emisor: "hoid";
  kind: typeof HOID_STATIC_GREETING_KIND;
  texto: typeof HOID_STATIC_GREETING_TEXT;
}>;

export type HoidPersistableConversationMessage =
  | HoidPersistableUserMessage
  | HoidPersistableAssistantMessage
  | HoidPersistableGreeting;

export type HoidConversationHistorySnapshot = Readonly<{
  schemaVersion: typeof HOID_CONVERSATION_HISTORY_SCHEMA_VERSION;
  kind: typeof HOID_CONVERSATION_HISTORY_KIND;
  progressScope: HoidConversationProgressScope;
  messages: readonly HoidPersistableConversationMessage[];
}>;

export type HoidConversationHistorySnapshotResult =
  | Readonly<{ status: "ready"; snapshot: HoidConversationHistorySnapshot }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-progress" | "invalid-messages";
    }>;

export type HoidConversationHistoryHydrationResult =
  | Readonly<{
      status: "ready";
      messages: readonly HoidPersistableConversationMessage[];
      savedProgressScope: HoidConversationProgressScope;
      droppedAssistantCount: 0;
    }>
  | Readonly<{
      status: "stale";
      messages: readonly (HoidPersistableUserMessage | HoidPersistableGreeting)[];
      savedProgressScope: HoidConversationProgressScope;
      droppedAssistantCount: number;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-envelope"
        | "unsupported-version"
        | "invalid-progress"
        | "invalid-messages"
        | "duplicate-message-id";
    }>;

type CanonicalRecord = Record<string, unknown>;

function canonicalRecord(value: unknown, allowedKeys: readonly string[]): CanonicalRecord | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.length) return null;

    const result = Object.create(null) as CanonicalRecord;
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

function canonicalDenseArray(value: unknown): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length > MAX_HISTORY_MESSAGES ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (
        typeof key !== "string" ||
        !/^(0|[1-9][0-9]*)$/u.test(key) ||
        Number(key) >= value.length
      ) return null;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function validMessageId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_MESSAGE_ID_LENGTH &&
    value === value.trim() &&
    !/[\u0000-\u001F\u007F]/u.test(value)
  );
}

function validMessageText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_MESSAGE_TEXT_LENGTH
  );
}

function canonicalMessage(
  value: unknown,
  savedProgressScope: HoidConversationProgressScope,
): HoidPersistableConversationMessage | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const roleDescriptor = Object.getOwnPropertyDescriptor(value, "emisor");
    if (
      !roleDescriptor ||
      !Object.prototype.hasOwnProperty.call(roleDescriptor, "value") ||
      roleDescriptor.enumerable !== true
    ) return null;

    if (roleDescriptor.value === "usuario") {
      const record = canonicalRecord(value, ["id", "emisor", "texto"]);
      if (
        !record ||
        !validMessageId(record.id) ||
        record.id === HOID_STATIC_GREETING_ID ||
        record.emisor !== "usuario" ||
        !validMessageText(record.texto)
      ) return null;
      return Object.freeze({
        id: record.id,
        emisor: "usuario",
        texto: record.texto,
      });
    }

    if (roleDescriptor.value !== "hoid") return null;

    if (isHoidConversationMessageVisible(value, null)) {
      const record = canonicalRecord(value, ["id", "emisor", "kind", "texto"]);
      if (
        !record ||
        record.id !== HOID_STATIC_GREETING_ID ||
        record.emisor !== "hoid" ||
        record.kind !== HOID_STATIC_GREETING_KIND ||
        record.texto !== HOID_STATIC_GREETING_TEXT
      ) return null;
      return Object.freeze({
        id: HOID_STATIC_GREETING_ID,
        emisor: "hoid",
        kind: HOID_STATIC_GREETING_KIND,
        texto: HOID_STATIC_GREETING_TEXT,
      });
    }

    const record = canonicalRecord(value, ["id", "emisor", "texto", "progressScope"]);
    if (
      !record ||
      !validMessageId(record.id) ||
      record.id === HOID_STATIC_GREETING_ID ||
      record.emisor !== "hoid" ||
      !validMessageText(record.texto) ||
      !isHoidConversationProgressScope(record.progressScope) ||
      !sameHoidConversationProgressScope(record.progressScope, savedProgressScope) ||
      !isHoidConversationMessageVisible(value, savedProgressScope)
    ) return null;

    return Object.freeze({
      id: record.id,
      emisor: "hoid",
      texto: record.texto,
      progressScope: Object.freeze({
        revision: savedProgressScope.revision,
        fingerprint: savedProgressScope.fingerprint,
      }),
    });
  } catch {
    return null;
  }
}

function canonicalMessages(
  value: unknown,
  savedProgressScope: HoidConversationProgressScope,
): Readonly<{
  messages: readonly HoidPersistableConversationMessage[];
  totalTextLength: number;
}> | null {
  const rawMessages = canonicalDenseArray(value);
  if (!rawMessages) return null;

  const messages: HoidPersistableConversationMessage[] = [];
  const ids = new Set<string>();
  let greetingCount = 0;
  let totalTextLength = 0;

  for (const rawMessage of rawMessages) {
    const message = canonicalMessage(rawMessage, savedProgressScope);
    if (!message || ids.has(message.id)) return null;
    if (message.id === HOID_STATIC_GREETING_ID) greetingCount += 1;
    if (greetingCount > 1) return null;

    totalTextLength += message.texto.length;
    if (totalTextLength > MAX_TOTAL_TEXT_LENGTH) return null;

    ids.add(message.id);
    messages.push(message);
  }

  return Object.freeze({
    messages: Object.freeze(messages),
    totalTextLength,
  });
}

/**
 * Creates a metadata-only, versioned snapshot. This is a pure boundary helper;
 * it does not write to storage or claim that chat persistence exists.
 *
 * Version 1 deliberately stores text-only messages. Citations, segments,
 * layouts, recommendation cards and provider payloads require a separately
 * reviewed future schema version and are rejected rather than silently lost.
 */
export function createHoidConversationHistorySnapshot(
  messagesInput: unknown,
  progressScopeInput: unknown,
): HoidConversationHistorySnapshotResult {
  if (!isHoidConversationProgressScope(progressScopeInput)) {
    return Object.freeze({ status: "invalid", reason: "invalid-progress" });
  }

  const progressScope = Object.freeze({
    revision: progressScopeInput.revision,
    fingerprint: progressScopeInput.fingerprint,
  });
  const canonical = canonicalMessages(messagesInput, progressScope);
  if (!canonical) return Object.freeze({ status: "invalid", reason: "invalid-messages" });

  return Object.freeze({
    status: "ready",
    snapshot: Object.freeze({
      schemaVersion: HOID_CONVERSATION_HISTORY_SCHEMA_VERSION,
      kind: HOID_CONVERSATION_HISTORY_KIND,
      progressScope,
      messages: canonical.messages,
    }),
  });
}

/**
 * Hydrates only a recognized v1 envelope. A stale progress scope never exposes
 * old assistant prose: user-authored messages and the exact static greeting
 * survive, while every scoped assistant answer is omitted. Malformed records
 * invalidate the complete snapshot; there is no legacy or partial fallback.
 */
export function hydrateHoidConversationHistorySnapshot(
  snapshotInput: unknown,
  currentProgressScopeInput: unknown,
): HoidConversationHistoryHydrationResult {
  const envelope = canonicalRecord(snapshotInput, [
    "schemaVersion",
    "kind",
    "progressScope",
    "messages",
  ]);
  if (!envelope) return Object.freeze({ status: "invalid", reason: "invalid-envelope" });
  if (
    envelope.schemaVersion !== HOID_CONVERSATION_HISTORY_SCHEMA_VERSION ||
    envelope.kind !== HOID_CONVERSATION_HISTORY_KIND
  ) return Object.freeze({ status: "invalid", reason: "unsupported-version" });
  if (!isHoidConversationProgressScope(envelope.progressScope)) {
    return Object.freeze({ status: "invalid", reason: "invalid-progress" });
  }

  const savedProgressScope = Object.freeze({
    revision: envelope.progressScope.revision,
    fingerprint: envelope.progressScope.fingerprint,
  });
  const canonical = canonicalMessages(envelope.messages, savedProgressScope);
  if (!canonical) return Object.freeze({ status: "invalid", reason: "invalid-messages" });

  if (
    isHoidConversationProgressScope(currentProgressScopeInput) &&
    sameHoidConversationProgressScope(savedProgressScope, currentProgressScopeInput)
  ) {
    return Object.freeze({
      status: "ready",
      messages: canonical.messages,
      savedProgressScope,
      droppedAssistantCount: 0,
    });
  }

  const safeMessages = canonical.messages.filter(message =>
    message.emisor === "usuario" || message.id === HOID_STATIC_GREETING_ID,
  );
  const droppedAssistantCount = canonical.messages.length - safeMessages.length;
  return Object.freeze({
    status: "stale",
    messages: Object.freeze(safeMessages),
    savedProgressScope,
    droppedAssistantCount,
  });
}
