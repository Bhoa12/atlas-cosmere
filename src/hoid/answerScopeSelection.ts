import {
  canonicalizeHoidAnswerBookScope,
  type HoidAnswerBookScope,
} from "./answerScope";
import { isKnownHoidSource } from "./bibliography";

export type HoidAnswerScopeMode = "automatic" | "single-work" | "cross-work";

export type HoidAnswerScopeSelection = Readonly<{
  mode: HoidAnswerScopeMode;
  bookIds: readonly string[];
}>;

export type HoidAnswerScopeSelectionResult =
  | Readonly<{ status: "unscoped" }>
  | Readonly<{ status: "ready"; scope: HoidAnswerBookScope }>
  | Readonly<{
      status: "incomplete";
      reason: "one-work-required" | "two-to-four-works-required" | "invalid-selection";
    }>;

const MAX_CROSS_WORK_SELECTION = 4;

/**
 * Convert temporary screen selection into the closed runtime scope contract.
 * Selection is a narrowing preference only; it never grants evidence access.
 */
export function buildHoidAnswerScopeSelection(
  mode: HoidAnswerScopeMode,
  bookIds: readonly string[],
): HoidAnswerScopeSelectionResult {
  try {
    if (!Array.isArray(bookIds) || Object.getPrototypeOf(bookIds) !== Array.prototype) {
      return Object.freeze({ status: "incomplete", reason: "invalid-selection" });
    }

    if (mode === "automatic") {
      return bookIds.length === 0
        ? Object.freeze({ status: "unscoped" })
        : Object.freeze({ status: "incomplete", reason: "invalid-selection" });
    }

    if (mode === "single-work" && bookIds.length !== 1) {
      return Object.freeze({ status: "incomplete", reason: "one-work-required" });
    }
    if (mode === "cross-work" && (bookIds.length < 2 || bookIds.length > MAX_CROSS_WORK_SELECTION)) {
      return Object.freeze({ status: "incomplete", reason: "two-to-four-works-required" });
    }

    // Pass the original array to the descriptor-based canonicalizer. Spreading
    // first would execute accessor elements before the trust boundary checks them.
    const scope = canonicalizeHoidAnswerBookScope({ mode, bookIds });
    return scope
      ? Object.freeze({ status: "ready", scope })
      : Object.freeze({ status: "incomplete", reason: "invalid-selection" });
  } catch {
    return Object.freeze({ status: "incomplete", reason: "invalid-selection" });
  }
}

/** Pure reducer for the temporary work chips shown by HoidScreen. */
export function toggleHoidAnswerScopeBook(
  selection: HoidAnswerScopeSelection,
  bookId: string,
): HoidAnswerScopeSelection {
  if (
    selection.mode === "automatic" ||
    !isKnownHoidSource(bookId) ||
    typeof bookId !== "string"
  ) return Object.freeze({ mode: selection.mode, bookIds: Object.freeze([...selection.bookIds]) });

  const current = [...selection.bookIds];
  const existingIndex = current.indexOf(bookId);
  if (existingIndex >= 0) {
    current.splice(existingIndex, 1);
  } else if (selection.mode === "single-work") {
    current.splice(0, current.length, bookId);
  } else if (current.length < MAX_CROSS_WORK_SELECTION) {
    current.push(bookId);
  }

  return Object.freeze({
    mode: selection.mode,
    bookIds: Object.freeze(current),
  });
}

/** Stable UI identity; it is not an authorization token or provider credential. */
export function fingerprintHoidAnswerScopeSelection(
  result: HoidAnswerScopeSelectionResult,
): string {
  if (result.status === "unscoped") return "automatic";
  if (result.status === "incomplete") return `incomplete:${result.reason}`;
  return `${result.scope.mode}:${result.scope.bookIds.join(",")}`;
}
