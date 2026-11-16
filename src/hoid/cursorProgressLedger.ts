import {
  HoidProgressLedger,
  type HoidProgressStore,
} from "./progressLedger";
import { getHoidEditionProgressPolicy } from "./editionStructure";
import {
  createHoidReadingCursor,
  validateHoidReadingCursor,
  type HoidReadingCursor,
} from "./readingManifest";

export type HoidCursorProgressPosition =
  | Readonly<{ bookId: string; cursor: HoidReadingCursor; order?: number }>
  | Readonly<{ bookId: string; completed: true; order?: number }>;

export type HoidCursorProgressSnapshot = Readonly<{
  schemaVersion: 2;
  revision: number;
  positions: readonly HoidCursorProgressPosition[];
  updatedAt: string | null;
}>;

export type HoidCursorSnapshotValidation =
  | Readonly<{ status: "valid"; snapshot: HoidCursorProgressSnapshot }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-shape"
        | "invalid-revision"
        | "invalid-position"
        | "duplicate-book"
        | "unknown-work"
        | "invalid-timestamp"
        | "invalid-revision-state";
    }>;

export type HoidProgressV1MigrationResult =
  | Readonly<{
      status: "ready";
      migratedFrom: 1;
      sourceRevision: number;
      snapshot: HoidCursorProgressSnapshot;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-legacy-snapshot" | "cursor-unavailable" | "invalid-migrated-snapshot";
      bookId?: string;
    }>;

const MAX_POSITIONS = 256;
const MAX_REVISION = Number.MAX_SAFE_INTEGER - 1;
const MAX_ORDER = 1_000_000;
const SNAPSHOT_KEYS = new Set(["schemaVersion", "revision", "positions", "updatedAt"]);
const POSITION_KEYS = new Set(["bookId", "cursor", "completed", "order"]);

function canonicalRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.has(key)) return null;
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

function canonicalDenseArray(value: unknown): unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length > MAX_POSITIONS) return null;
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
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function canonicalPosition(value: unknown): HoidCursorProgressPosition | null {
  const record = canonicalRecord(value, POSITION_KEYS);
  if (record === null) return null;

  const bookId = record.bookId;
  if (
    typeof bookId !== "string" ||
    bookId.length === 0 ||
    bookId.length > 256 ||
    bookId !== bookId.trim()
  ) return null;

  const policy = getHoidEditionProgressPolicy(bookId);
  if (policy.kind === "unknown") return null;

  const hasCursor = Object.prototype.hasOwnProperty.call(record, "cursor");
  const hasCompleted = Object.prototype.hasOwnProperty.call(record, "completed");
  const hasOrder = Object.prototype.hasOwnProperty.call(record, "order");

  let order: number | undefined;
  if (hasOrder) {
    if (
      typeof record.order !== "number" ||
      !Number.isSafeInteger(record.order) ||
      record.order < 0 ||
      record.order > MAX_ORDER
    ) return null;
    order = record.order;
  }

  if (hasCompleted) {
    if (record.completed !== true || hasCursor) return null;
    return Object.freeze({
      bookId,
      completed: true,
      ...(order === undefined ? {} : { order }),
    });
  }

  if (!hasCursor) return null;
  const cursorResult = validateHoidReadingCursor(record.cursor);
  if (cursorResult.status !== "valid" || cursorResult.cursor.bookId !== bookId) return null;

  return Object.freeze({
    bookId,
    cursor: cursorResult.cursor,
    ...(order === undefined ? {} : { order }),
  });
}

/**
 * Validate and canonicalize an untrusted v2 snapshot.
 * A v2 cursor must resolve against the current edition manifest; a completion
 * must remain an explicit reader-declared state for a catalogued work.
 */
export function validateHoidCursorProgressSnapshot(
  value: unknown,
): HoidCursorSnapshotValidation {
  const record = canonicalRecord(value, SNAPSHOT_KEYS);
  if (record === null) return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  if (record.schemaVersion !== 2) return Object.freeze({ status: "invalid", reason: "invalid-shape" });

  if (
    typeof record.revision !== "number" ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0 ||
    record.revision > MAX_REVISION
  ) return Object.freeze({ status: "invalid", reason: "invalid-revision" });

  const rawPositions = canonicalDenseArray(record.positions);
  if (rawPositions === null) return Object.freeze({ status: "invalid", reason: "invalid-shape" });

  const positions: HoidCursorProgressPosition[] = [];
  const seen = new Set<string>();
  for (const rawPosition of rawPositions) {
    const position = canonicalPosition(rawPosition);
    if (position === null) {
      const rawRecord = canonicalRecord(rawPosition, POSITION_KEYS);
      if (rawRecord && typeof rawRecord.bookId === "string" && getHoidEditionProgressPolicy(rawRecord.bookId).kind === "unknown") {
        return Object.freeze({ status: "invalid", reason: "unknown-work" });
      }
      return Object.freeze({ status: "invalid", reason: "invalid-position" });
    }
    if (seen.has(position.bookId)) return Object.freeze({ status: "invalid", reason: "duplicate-book" });
    seen.add(position.bookId);
    positions.push(position);
  }

  positions.sort((a, b) => a.bookId.localeCompare(b.bookId));

  const updatedAt = record.updatedAt;
  if (updatedAt !== null && !canonicalTimestamp(updatedAt)) {
    return Object.freeze({ status: "invalid", reason: "invalid-timestamp" });
  }
  const revision = record.revision as number;
  if (
    (revision === 0 && (updatedAt !== null || positions.length !== 0)) ||
    (revision > 0 && updatedAt === null)
  ) return Object.freeze({ status: "invalid", reason: "invalid-revision-state" });

  return Object.freeze({
    status: "valid",
    snapshot: Object.freeze({
      schemaVersion: 2,
      revision,
      positions: Object.freeze(positions),
      updatedAt: updatedAt as string | null,
    }),
  });
}

export function emptyHoidCursorProgressSnapshot(): HoidCursorProgressSnapshot {
  return Object.freeze({
    schemaVersion: 2,
    revision: 0,
    positions: Object.freeze([]),
    updatedAt: null,
  });
}

/**
 * Pure, non-destructive v1 -> v2 migration.
 *
 * The legacy ledger validates the complete source snapshot first. Every
 * partial chapter must then resolve to an exact edition-bound cursor. If even
 * one position is ambiguous or unsegmented, the whole migration is withheld;
 * no position is silently dropped and no legacy data is mutated.
 */
export async function migrateHoidProgressV1ToV2(
  legacyValue: unknown,
): Promise<HoidProgressV1MigrationResult> {
  const readOnlyStore: HoidProgressStore = {
    read: async () => legacyValue,
    compareAndSwap: async () => false,
  };
  const legacyResult = await new HoidProgressLedger(readOnlyStore).read();
  if (legacyResult.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: "invalid-legacy-snapshot" });
  }

  const positions: HoidCursorProgressPosition[] = [];
  for (const position of legacyResult.snapshot.positions) {
    if (position.completed === true) {
      positions.push(Object.freeze({
        bookId: position.bookId,
        completed: true,
        ...(position.order === undefined ? {} : { order: position.order }),
      }));
      continue;
    }

    const created = createHoidReadingCursor(position.bookId, position.chapter);
    if (created.status !== "ready") {
      return Object.freeze({
        status: "unavailable",
        reason: "cursor-unavailable",
        bookId: position.bookId,
      });
    }
    positions.push(Object.freeze({
      bookId: position.bookId,
      cursor: created.cursor,
      ...(position.order === undefined ? {} : { order: position.order }),
    }));
  }

  const candidate = {
    schemaVersion: 2,
    revision: legacyResult.snapshot.revision,
    positions,
    updatedAt: legacyResult.snapshot.updatedAt,
  };
  const validated = validateHoidCursorProgressSnapshot(candidate);
  if (validated.status !== "valid") {
    return Object.freeze({ status: "unavailable", reason: "invalid-migrated-snapshot" });
  }

  return Object.freeze({
    status: "ready",
    migratedFrom: 1,
    sourceRevision: legacyResult.snapshot.revision,
    snapshot: validated.snapshot,
  });
}
