import { isKnownHoidSource } from "./bibliography";

export type HoidAnswerBookScope = Readonly<{
  mode: "single-work" | "cross-work";
  bookIds: readonly string[];
}>;

const BOOK_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/u;
const MAX_SCOPED_BOOKS = 4;

function exactScopeRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 2 || !keys.includes("mode") || !keys.includes("bookIds")) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (key !== "mode" && key !== "bookIds") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalBookIds(value: unknown, minimum: number): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length < minimum || value.length > MAX_SCOPED_BOOKS ||
        Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const ids: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true || typeof descriptor.value !== "string") return null;
      const id = descriptor.value;
      if (id !== id.trim() || !BOOK_ID_PATTERN.test(id) || !isKnownHoidSource(id) || seen.has(id)) return null;
      seen.add(id);
      ids.push(id);
    }
    return Object.freeze(ids.sort());
  } catch {
    return null;
  }
}

export function canonicalizeHoidAnswerBookScope(value: unknown): HoidAnswerBookScope | null {
  const record = exactScopeRecord(value);
  if (!record || (record.mode !== "single-work" && record.mode !== "cross-work")) return null;
  const bookIds = canonicalBookIds(record.bookIds, record.mode === "single-work" ? 1 : 2);
  if (!bookIds || (record.mode === "single-work" && bookIds.length !== 1)) return null;
  return Object.freeze({ mode: record.mode, bookIds });
}

export function claimEvidenceMatchesHoidBookScope(
  evidenceBookIds: readonly string[],
  scope: HoidAnswerBookScope | undefined,
): boolean {
  if (!scope) return true;
  return evidenceBookIds.length > 0 && evidenceBookIds.every(bookId => scope.bookIds.includes(bookId));
}

export function selectedEvidenceSatisfiesHoidBookScope(
  selectedBookIds: readonly string[],
  scope: HoidAnswerBookScope | undefined,
): boolean {
  if (!scope || selectedBookIds.length === 0) return !scope;
  const selected = new Set(selectedBookIds);
  return selectedBookIds.every(id => scope.bookIds.includes(id)) &&
    scope.bookIds.every(id => selected.has(id)) &&
    (scope.mode !== "single-work" || selected.size === 1);
}
