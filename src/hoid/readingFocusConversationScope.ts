import type { HoidAnswerBookScope } from "./answerScope";
import {
  buildHoidAnswerScopeSelection,
  type HoidAnswerScopeMode,
} from "./answerScopeSelection";
import {
  resolveHoidReadingFocus,
  type HoidReadingFocus,
  type HoidReadingFocusChoice,
} from "./readingFocus";

export type HoidReadingFocusConversationScopeRequest = Readonly<{
  progress: unknown;
  answerScopeMode: HoidAnswerScopeMode;
  answerScopeBookIds: readonly string[];
  selectedFocusBookId?: string;
}>;

export type HoidReadingFocusConversationScopeResolution =
  | Readonly<{
      status: "ready";
      scope: HoidAnswerBookScope;
      focus: HoidReadingFocus | null;
      source: "automatic-focus" | "explicit-single-work" | "explicit-cross-work";
    }>
  | Readonly<{
      status: "selection-required";
      reason: "multiple-active-works";
      choices: readonly HoidReadingFocusChoice[];
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-request"
        | "invalid-progress"
        | "no-active-work"
        | "selected-work-not-active"
        | "chapter-structure-unavailable"
        | "invalid-scope";
    }>;

const REQUEST_KEYS = [
  "progress",
  "answerScopeMode",
  "answerScopeBookIds",
  "selectedFocusBookId",
] as const;

function exactDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalBookIds(value: unknown): readonly string[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length > 4 ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const ids: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string" ||
        descriptor.value.length === 0 ||
        descriptor.value !== descriptor.value.trim() ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      ids.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (
        typeof key !== "string" ||
        !/^(0|[1-9][0-9]*)$/u.test(key) ||
        Number(key) >= value.length
      ) return null;
    }
    return Object.freeze(ids);
  } catch {
    return null;
  }
}

function focusFailureReason(
  result: Extract<ReturnType<typeof resolveHoidReadingFocus>, { status: "unavailable" }>,
): Extract<HoidReadingFocusConversationScopeResolution, { status: "unavailable" }>["reason"] {
  switch (result.reason) {
    case "invalid-request":
      return "invalid-request";
    case "invalid-progress":
      return "invalid-progress";
    case "no-active-work":
      return "no-active-work";
    case "selected-work-not-active":
      return "selected-work-not-active";
    case "chapter-structure-unavailable":
      return "chapter-structure-unavailable";
  }
}

/**
 * Derive the exact book scope for a narrative turn from the current cursor-v2
 * snapshot. In automatic mode one active work becomes the implicit single-work
 * scope; multiple active works require an explicit focus choice. Explicit
 * cross-work mode is allowed only when every selected work has active,
 * edition-bound progress and a verified chapter manifest.
 *
 * The returned focus is local display metadata. Callers pass only `scope` to
 * the trusted answer host; focus, chapter numbers, cursors and locators never
 * enter a provider payload. The trusted host still independently authorizes
 * every exact-unit claim against live progress and signed editorial evidence.
 */
export function resolveHoidReadingFocusConversationScope(
  input: unknown,
): HoidReadingFocusConversationScopeResolution {
  const record = exactDataRecord(input, REQUEST_KEYS, [
    "progress",
    "answerScopeMode",
    "answerScopeBookIds",
  ]);
  if (!record) return Object.freeze({ status: "unavailable", reason: "invalid-request" });

  const mode = record.answerScopeMode;
  if (mode !== "automatic" && mode !== "single-work" && mode !== "cross-work") {
    return Object.freeze({ status: "unavailable", reason: "invalid-request" });
  }

  const bookIds = canonicalBookIds(record.answerScopeBookIds);
  if (!bookIds) return Object.freeze({ status: "unavailable", reason: "invalid-request" });

  let selectedFocusBookId: string | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "selectedFocusBookId")) {
    if (
      mode !== "automatic" ||
      typeof record.selectedFocusBookId !== "string" ||
      record.selectedFocusBookId.length === 0 ||
      record.selectedFocusBookId !== record.selectedFocusBookId.trim()
    ) return Object.freeze({ status: "unavailable", reason: "invalid-request" });
    selectedFocusBookId = record.selectedFocusBookId;
  }

  const selection = buildHoidAnswerScopeSelection(mode, bookIds);

  if (mode === "automatic") {
    if (selection.status !== "unscoped") {
      return Object.freeze({ status: "unavailable", reason: "invalid-scope" });
    }
    const resolved = resolveHoidReadingFocus({
      progress: record.progress,
      ...(selectedFocusBookId === undefined ? {} : { selectedBookId: selectedFocusBookId }),
    });
    if (resolved.status === "selection-required") {
      return Object.freeze({
        status: "selection-required",
        reason: "multiple-active-works",
        choices: resolved.choices,
      });
    }
    if (resolved.status === "unavailable") {
      return Object.freeze({
        status: "unavailable",
        reason: focusFailureReason(resolved),
      });
    }
    const scoped = buildHoidAnswerScopeSelection("single-work", [resolved.focus.bookId]);
    if (scoped.status !== "ready") {
      return Object.freeze({ status: "unavailable", reason: "invalid-scope" });
    }
    return Object.freeze({
      status: "ready",
      scope: scoped.scope,
      focus: resolved.focus,
      source: "automatic-focus",
    });
  }

  if (selection.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: "invalid-scope" });
  }

  if (mode === "single-work") {
    const resolved = resolveHoidReadingFocus({
      progress: record.progress,
      selectedBookId: selection.scope.bookIds[0],
    });
    if (resolved.status !== "ready") {
      return Object.freeze({
        status: "unavailable",
        reason: resolved.status === "unavailable"
          ? focusFailureReason(resolved)
          : "invalid-progress",
      });
    }
    return Object.freeze({
      status: "ready",
      scope: selection.scope,
      focus: resolved.focus,
      source: "explicit-single-work",
    });
  }

  for (const bookId of selection.scope.bookIds) {
    const resolved = resolveHoidReadingFocus({
      progress: record.progress,
      selectedBookId: bookId,
    });
    if (resolved.status !== "ready") {
      return Object.freeze({
        status: "unavailable",
        reason: resolved.status === "unavailable"
          ? focusFailureReason(resolved)
          : "invalid-progress",
      });
    }
  }

  return Object.freeze({
    status: "ready",
    scope: selection.scope,
    focus: null,
    source: "explicit-cross-work",
  });
}
