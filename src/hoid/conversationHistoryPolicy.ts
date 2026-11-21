export const HOID_STATIC_GREETING_ID = "hoid-static-greeting-v1";
export const HOID_STATIC_GREETING_KIND = "static-greeting" as const;
export const HOID_STATIC_GREETING_TEXT =
  "Saludos, viajero de mundos. Soy Sagaz. Estoy usando el runtime estricto con el progreso de lectura vinculado a la edición. El registro editorial todavía está vacío, así que no inventaré hechos ni recurriré a respuestas libres.";

export type HoidConversationProgressScope = Readonly<{
  revision: number;
  fingerprint: string;
}>;

export type HoidConversationHistoryMessage = Readonly<{
  id?: string;
  emisor: "usuario" | "hoid";
  texto?: string;
  kind?: typeof HOID_STATIC_GREETING_KIND;
  progressScope?: unknown;
}>;

const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const MAX_MESSAGE_ID_LENGTH = 128;
const MAX_MESSAGE_TEXT_LENGTH = 50_000;

function hasOwnDataString(
  value: object,
  key: string,
  maximumLength: number,
): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return Boolean(
    descriptor &&
    Object.prototype.hasOwnProperty.call(descriptor, "value") &&
    descriptor.enumerable === true &&
    typeof descriptor.value === "string" &&
    descriptor.value.length > 0 &&
    descriptor.value.length <= maximumLength
  );
}

function hasOwnDataValue(value: object, key: string, expected: string): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return Boolean(
    descriptor &&
    Object.prototype.hasOwnProperty.call(descriptor, "value") &&
    descriptor.enumerable === true &&
    descriptor.value === expected
  );
}

function isCanonicalStaticGreeting(value: object): boolean {
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 4 ||
    !keys.includes("id") ||
    !keys.includes("emisor") ||
    !keys.includes("kind") ||
    !keys.includes("texto")
  ) return false;

  return (
    hasOwnDataValue(value, "id", HOID_STATIC_GREETING_ID) &&
    hasOwnDataValue(value, "emisor", "hoid") &&
    hasOwnDataValue(value, "kind", HOID_STATIC_GREETING_KIND) &&
    hasOwnDataValue(value, "texto", HOID_STATIC_GREETING_TEXT)
  );
}

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
 * User messages must be ordinary, bounded records. Every Hoid message must
 * carry the exact current progress scope, except one canonical static greeting.
 * The greeting's identity, kind, text and complete key set are fixed so an
 * untrusted restoration path cannot reuse its marker for arbitrary prose.
 */
export function isHoidConversationMessageVisible(value: unknown, currentScope: unknown): boolean {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;

    const role = Object.getOwnPropertyDescriptor(value, "emisor");
    if (!role || !Object.prototype.hasOwnProperty.call(role, "value") || role.enumerable !== true) return false;

    if (role.value === "usuario") {
      return (
        hasOwnDataString(value, "id", MAX_MESSAGE_ID_LENGTH) &&
        hasOwnDataString(value, "texto", MAX_MESSAGE_TEXT_LENGTH) &&
        !Object.prototype.hasOwnProperty.call(value, "progressScope") &&
        !Object.prototype.hasOwnProperty.call(value, "kind")
      );
    }
    if (role.value !== "hoid") return false;
    if (
      !hasOwnDataString(value, "id", MAX_MESSAGE_ID_LENGTH) ||
      !hasOwnDataString(value, "texto", MAX_MESSAGE_TEXT_LENGTH)
    ) return false;

    const scope = Object.getOwnPropertyDescriptor(value, "progressScope");
    if (scope) {
      if (
        !Object.prototype.hasOwnProperty.call(scope, "value") ||
        scope.enumerable !== true ||
        Object.prototype.hasOwnProperty.call(value, "kind") ||
        hasOwnDataValue(value, "id", HOID_STATIC_GREETING_ID)
      ) return false;
      return sameHoidConversationProgressScope(scope.value, currentScope);
    }

    return isCanonicalStaticGreeting(value);
  } catch {
    return false;
  }
}

/** Filters stale or unscoped assistant answers before the chat list is rendered. */
export function filterVisibleHoidMessages<T extends HoidConversationHistoryMessage>(
  messages: readonly T[],
  currentScope: unknown,
): T[] {
  try {
    if (!Array.isArray(messages)) return [];
    const visible: T[] = [];
    let greetingSeen = false;
    for (const message of messages) {
      if (!isHoidConversationMessageVisible(message, currentScope)) continue;
      if (message !== null && typeof message === "object" && isCanonicalStaticGreeting(message)) {
        if (greetingSeen) continue;
        greetingSeen = true;
      }
      visible.push(message);
    }
    return visible;
  } catch {
    return [];
  }
}

/** Removes stale assistant answers without mutating user-authored history. */
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
