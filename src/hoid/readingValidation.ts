import { ReadingPosition } from "./types";

export const DEFAULT_MAX_READING_POSITIONS = 256;
export const DEFAULT_MAX_READING_POSITION_BOOK_ID_LENGTH = 256;
export const DEFAULT_MAX_READING_POSITION_CHAPTER = 100_000_000;
export const DEFAULT_MAX_READING_POSITION_ORDER = 1_000_000;

const ALLOWED_POSITION_KEYS = new Set(["bookId", "chapter", "completed", "order"]);

/**
 * Snapshot only own data properties. Accessors, symbols, proxies that throw,
 * inherited fields and non-plain objects are rejected before values are read.
 */
function canonicalDataRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !ALLOWED_POSITION_KEYS.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Accept only a dense, ordinary array of own data elements.
 *
 * Iteration through a caller-supplied Symbol.iterator can execute arbitrary
 * code before a progress snapshot is validated. Index descriptors avoid
 * invoking custom iterators or accessor-backed array elements.
 */
function canonicalReadingArray(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (
      !lengthDescriptor ||
      !Object.prototype.hasOwnProperty.call(lengthDescriptor, "value") ||
      typeof lengthDescriptor.value !== "number" ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > DEFAULT_MAX_READING_POSITIONS
    ) return null;

    const length = lengthDescriptor.value;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1 || !keys.includes("length")) return null;

    const items: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      items.push(descriptor.value);
    }

    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= length) {
        return null;
      }
    }
    return Object.freeze(items);
  } catch {
    return null;
  }
}

/**
 * Runtime trust boundary for reader progress.
 *
 * A malformed position invalidates the entire snapshot. Silently dropping a
 * malformed entry can be unsafe: a contradictory { chapter, completed: true }
 * record must never be normalized into a completed work, because completion
 * authorizes every chapter in that work.
 *
 * A book may appear only once. Exactly one position form is accepted:
 * - { bookId, chapter, order? }
 * - { bookId, completed: true, order? }
 *
 * Unknown keys, inherited fields, accessors, invalid values and duplicate work
 * IDs fail closed. Edition-specific chapter limits are enforced by the next
 * boundary.
 */
export function validReadingPositions(value: unknown): ReadingPosition[] | null {
  const rawPositions = canonicalReadingArray(value);
  if (rawPositions === null) return null;

  const positions: ReadingPosition[] = [];
  const seenBookIds = new Set<string>();

  for (const rawItem of rawPositions) {
    const item = canonicalDataRecord(rawItem);
    if (item === null || !Object.prototype.hasOwnProperty.call(item, "bookId")) return null;

    const rawBookId = item.bookId;
    if (
      typeof rawBookId !== "string" ||
      rawBookId.length === 0 ||
      rawBookId.length > DEFAULT_MAX_READING_POSITION_BOOK_ID_LENGTH ||
      rawBookId !== rawBookId.trim()
    ) return null;

    const bookId = rawBookId;
    if (seenBookIds.has(bookId)) return null;
    seenBookIds.add(bookId);

    const hasChapter = Object.prototype.hasOwnProperty.call(item, "chapter");
    const hasCompleted = Object.prototype.hasOwnProperty.call(item, "completed");
    if (hasChapter === hasCompleted) return null;

    const order = item.order;
    const hasOrder = Object.prototype.hasOwnProperty.call(item, "order");
    if (
      hasOrder &&
      (typeof order !== "number" ||
        !Number.isSafeInteger(order) ||
        order < 0 ||
        order > DEFAULT_MAX_READING_POSITION_ORDER)
    ) return null;

    if (hasCompleted) {
      if (item.completed !== true) return null;
      positions.push({
        bookId,
        completed: true,
        ...(hasOrder ? { order: order as number } : {}),
      });
      continue;
    }

    const chapter = item.chapter;
    if (
      typeof chapter !== "number" ||
      !Number.isSafeInteger(chapter) ||
      chapter < 0 ||
      chapter > DEFAULT_MAX_READING_POSITION_CHAPTER
    ) return null;

    positions.push({
      bookId,
      chapter,
      ...(hasOrder ? { order: order as number } : {}),
    });
  }

  return positions;
}
