export type HoidConversationProgressScope = Readonly<{
  revision: number;
  fingerprint: string;
}>;

export type HoidConversationHistoryMessage = Readonly<{
  emisor: "usuario" | "hoid";
  progressScope?: unknown;
}>;

const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

/** Runtime validation for a canonical, accessor-free progress identity. */
export function isHoidConversationProgressScope(value: unknown): value is HoidConversationProgressScope {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 2 || !keys.includes("revision") || !keys.includes("fingerprint")) return false;

    const revision = Object.getOwnPropertyDescriptor(value, "revision");
    const fingerprint = Object.getOwnPropertyDescriptor(value, "fingerprint");
    if (
      !revision || !fingerprint ||
      !Object.prototype.hasOwnProperty.call(revision, "value") ||
      !Object.prototype.hasOwnProperty.call(fingerprint, "value") ||
      revision.enumerable !== true ||
      fingerprint.enumerable !== true
    ) return false;

    return (
      typeof revision.value === "number" &&
      Number.isSafeInteger(revision.value) &&
      revision.value >= 0 &&
      typeof fingerprint.value === "string" &&
      FINGERPRINT_PATTERN.test(fingerprint.value)
    );
  } catch {
    return false;
  }
}

export function sameHoidConversationProgressScope(left: unknown, right: unknown): boolean {
  if (!isHoidConversationProgressScope(left) || !isHoidConversationProgressScope(right)) return false;
  return left.revision === right.revision && left.fingerprint === right.fingerprint;
}

/**
 * User messages and the static greeting are not progress-scoped. Every Hoid
 * response produced from a ready gateway result must carry a valid scope.
 * A present but malformed scope is hidden rather than treated as legacy text.
 */
export function isHoidConversationMessageVisible(value: unknown, currentScope: unknown): boolean {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;

    const role = Object.getOwnPropertyDescriptor(value, "emisor");
    if (!role || !Object.prototype.hasOwnProperty.call(role, "value") || role.enumerable !== true) return false;
    if (role.value === "usuario") return true;
    if (role.value !== "hoid") return false;

    const scope = Object.getOwnPropertyDescriptor(value, "progressScope");
    if (!scope) return true;
    if (!Object.prototype.hasOwnProperty.call(scope, "value") || scope.enumerable !== true) return false;
    return sameHoidConversationProgressScope(scope.value, currentScope);
  } catch {
    return false;
  }
}

/** Filters stale assistant answers before the chat list is rendered. */
export function filterVisibleHoidMessages<T extends HoidConversationHistoryMessage>(
  messages: readonly T[],
  currentScope: unknown,
): T[] {
  if (!Array.isArray(messages)) return [];
  return messages.filter(message => isHoidConversationMessageVisible(message, currentScope));
}

/** Removes stale assistant answers from component state, preserving user text. */
export function pruneStaleHoidMessages<T extends HoidConversationHistoryMessage>(
  messages: readonly T[],
  currentScope: unknown,
): T[] {
  return filterVisibleHoidMessages(messages, currentScope);
}

/** Requires request, gateway result and live coordinator scopes to agree. */
export function canCommitHoidProgressScopedResponse(
  requestScope: unknown,
  responseScope: unknown,
  currentScope: unknown,
): boolean {
  return (
    sameHoidConversationProgressScope(requestScope, responseScope) &&
    sameHoidConversationProgressScope(responseScope, currentScope)
  );
}
