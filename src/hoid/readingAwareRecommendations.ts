import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import type { HoidCursorReadingContext, HoidCursorReadingContextPosition } from "./cursorReadingContext";
import type { HoidRecommendation } from "./recommendations";

const MAX_RECOMMENDATIONS = 20;
const CATALOG = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title]));
const CONTEXT_KEYS = [
  "revision",
  "updatedAt",
  "positions",
  "startedCount",
  "trackableWorkCount",
  "trackableUnstartedCount",
  "untrackedWorkCount",
  "catalogSize",
  "unitScope",
] as const;

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = allowedKeys,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
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

function canonicalDenseArray(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length > maximum || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) return null;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

type CanonicalPosition = Readonly<{
  bookId: string;
  title: string;
  status: "in-progress" | "completed";
  currentChapter?: number;
  completedThroughChapter?: number | null;
  order?: number;
}>;

function canonicalPosition(value: unknown): CanonicalPosition | null {
  const record = canonicalRecord(
    value,
    ["bookId", "title", "status", "currentChapter", "completedThroughChapter", "completedThrough", "order"],
    ["bookId", "title", "status"],
  );
  if (!record) return null;
  const bookId = record.bookId;
  const title = record.title;
  if (
    typeof bookId !== "string" ||
    typeof title !== "string" ||
    CATALOG.get(bookId) !== title
  ) return null;
  const order = record.order;
  if (order !== undefined && (
    typeof order !== "number" || !Number.isSafeInteger(order) || order < 0 || order > 1_000_000
  )) return null;

  if (record.status === "completed") {
    if (
      Object.keys(record).length !== (order === undefined ? 4 : 5) ||
      record.completedThrough !== "entire-work" ||
      Object.prototype.hasOwnProperty.call(record, "currentChapter") ||
      Object.prototype.hasOwnProperty.call(record, "completedThroughChapter")
    ) return null;
    return Object.freeze({
      bookId,
      title,
      status: "completed",
      ...(order === undefined ? {} : { order }),
    });
  }

  if (record.status !== "in-progress") return null;
  const currentChapter = record.currentChapter;
  const completedThroughChapter = record.completedThroughChapter;
  if (
    Object.keys(record).length !== (order === undefined ? 5 : 6) ||
    Object.prototype.hasOwnProperty.call(record, "completedThrough") ||
    typeof currentChapter !== "number" ||
    !Number.isSafeInteger(currentChapter) ||
    currentChapter < 1 ||
    !(
      completedThroughChapter === null ||
      (typeof completedThroughChapter === "number" &&
        Number.isSafeInteger(completedThroughChapter) &&
        completedThroughChapter === currentChapter - 1)
    ) ||
    (currentChapter === 1 && completedThroughChapter !== null) ||
    (currentChapter > 1 && completedThroughChapter !== currentChapter - 1)
  ) return null;

  return Object.freeze({
    bookId,
    title,
    status: "in-progress",
    currentChapter,
    completedThroughChapter,
    ...(order === undefined ? {} : { order }),
  });
}

function canonicalContext(value: unknown): readonly CanonicalPosition[] | null {
  const record = canonicalRecord(value, CONTEXT_KEYS);
  if (!record || Object.keys(record).length !== CONTEXT_KEYS.length) return null;
  if (
    typeof record.revision !== "number" ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0 ||
    !(record.updatedAt === null || (
      typeof record.updatedAt === "string" &&
      Number.isFinite(Date.parse(record.updatedAt))
    )) ||
    typeof record.startedCount !== "number" ||
    !Number.isSafeInteger(record.startedCount) ||
    typeof record.trackableWorkCount !== "number" ||
    !Number.isSafeInteger(record.trackableWorkCount) ||
    typeof record.trackableUnstartedCount !== "number" ||
    !Number.isSafeInteger(record.trackableUnstartedCount) ||
    typeof record.untrackedWorkCount !== "number" ||
    !Number.isSafeInteger(record.untrackedWorkCount) ||
    record.unitScope !== "verified-numbered-chapters-only" ||
    record.catalogSize !== HOID_SOURCE_BIBLIOGRAPHY.length ||
    record.trackableWorkCount < 0 ||
    record.trackableWorkCount > record.catalogSize ||
    record.trackableUnstartedCount < 0 ||
    record.trackableUnstartedCount > record.trackableWorkCount ||
    record.untrackedWorkCount !== record.catalogSize - record.trackableWorkCount
  ) return null;

  const rawPositions = canonicalDenseArray(record.positions, 256);
  if (!rawPositions || rawPositions.length !== record.startedCount) return null;
  const positions: CanonicalPosition[] = [];
  const seen = new Set<string>();
  for (const rawPosition of rawPositions) {
    const position = canonicalPosition(rawPosition);
    if (!position || seen.has(position.bookId)) return null;
    seen.add(position.bookId);
    positions.push(position);
  }
  return Object.freeze(positions);
}

function canonicalUnreadCandidates(value: unknown, started: ReadonlySet<string>): readonly HoidRecommendation[] | null {
  const rawItems = canonicalDenseArray(value, HOID_SOURCE_BIBLIOGRAPHY.length);
  if (!rawItems) return null;
  const result: HoidRecommendation[] = [];
  const seen = new Set<string>();
  let lastCatalogIndex = -1;
  for (const raw of rawItems) {
    const item = canonicalRecord(raw, ["sourceId", "title", "reason"]);
    if (!item || Object.keys(item).length !== 3) return null;
    const sourceId = item.sourceId;
    const title = item.title;
    if (
      typeof sourceId !== "string" ||
      typeof title !== "string" ||
      item.reason !== "unread-source" ||
      CATALOG.get(sourceId) !== title ||
      started.has(sourceId) ||
      seen.has(sourceId)
    ) return null;
    const catalogIndex = HOID_SOURCE_BIBLIOGRAPHY.findIndex(work => work.id === sourceId);
    if (catalogIndex <= lastCatalogIndex) return null;
    lastCatalogIndex = catalogIndex;
    seen.add(sourceId);
    result.push(Object.freeze({ sourceId, title, reason: "unread-source" }));
  }
  return Object.freeze(result);
}

/**
 * Prioritizes resuming works already present in the authoritative reading
 * snapshot, then appends metadata-only catalogue discovery candidates.
 * It never infers canonical reading order or narrative dependencies.
 */
export function composeHoidReadingAwareRecommendations(
  contextInput: HoidCursorReadingContext | unknown,
  unreadCandidatesInput: unknown,
  limit = 3,
): readonly HoidRecommendation[] | null {
  if (
    typeof limit !== "number" ||
    !Number.isSafeInteger(limit) ||
    limit < 0 ||
    limit > MAX_RECOMMENDATIONS
  ) return null;

  const positions = canonicalContext(contextInput);
  if (!positions) return null;
  const started = new Set(positions.map(position => position.bookId));
  const unread = canonicalUnreadCandidates(unreadCandidatesInput, started);
  if (!unread) return null;

  const active = positions
    .filter((position): position is CanonicalPosition & {
      status: "in-progress";
      currentChapter: number;
      completedThroughChapter: number | null;
    } => position.status === "in-progress")
    .sort((left, right) =>
      (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER) ||
      left.bookId.localeCompare(right.bookId)
    )
    .map(position => Object.freeze({
      sourceId: position.bookId,
      title: position.title,
      reason: "resume-current-work" as const,
      currentChapter: position.currentChapter,
      completedThroughChapter: position.completedThroughChapter,
    }));

  return Object.freeze([...active, ...unread].slice(0, limit));
}
