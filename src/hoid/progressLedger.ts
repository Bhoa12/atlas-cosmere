import { getHoidEditionProgressPolicy } from "./editionStructure";
import { validEditionBoundReadingPositions } from "./editionProgressValidation";
import type { ReadingPosition } from "./types";

export type HoidProgressLedgerSnapshot = Readonly<{
  schemaVersion: 1;
  revision: number;
  positions: readonly Readonly<ReadingPosition>[];
  updatedAt: string | null;
}>;

/**
 * Implementations must make compareAndSwap atomic across all clients sharing
 * the same ledger. A local read followed by an unconditional write is not a
 * conforming adapter.
 */
export interface HoidProgressStore {
  read(): Promise<unknown>;
  compareAndSwap(expectedRevision: number, next: HoidProgressLedgerSnapshot): Promise<boolean>;
}

export type HoidProgressUpdate = Readonly<{
  expectedRevision: number;
  bookId: string;
  chapter?: number;
  complete?: true;
  confirmCompletion?: true;
  allowRegression?: true;
  reopenCompleted?: true;
}>;

export type HoidProgressResult =
  | Readonly<{ status: "updated" | "unchanged"; snapshot: HoidProgressLedgerSnapshot }>
  | Readonly<{ status: "conflict"; expectedRevision: number }>
  | Readonly<{
      status: "rejected";
      reason:
        | "invalid-update"
        | "unknown-work"
        | "unsupported-position"
        | "completion-not-confirmed"
        | "already-completed"
        | "regression-requires-confirmation"
        | "corrupt-ledger"
        | "invalid-clock"
        | "storage-error"
        | "invalid-store-result";
    }>;

export type HoidProgressReadResult =
  | Readonly<{ status: "ready"; snapshot: HoidProgressLedgerSnapshot }>
  | Readonly<{ status: "unavailable"; reason: "corrupt-ledger" | "storage-error" }>;

const MAX_POSITIONS = 256;
const MAX_REVISION = Number.MAX_SAFE_INTEGER - 1;
const ALLOWED_UPDATE_KEYS = new Set([
  "expectedRevision",
  "bookId",
  "chapter",
  "complete",
  "confirmCompletion",
  "allowRegression",
  "reopenCompleted",
]);
const ALLOWED_POSITION_KEYS = new Set(["bookId", "chapter", "completed", "order"]);
const ALLOWED_UPDATE_KEYS = new Set([
  "expectedRevision",
  "bookId",
  "chapter",
  "complete",
  "confirmCompletion",
  "allowRegression",
  "reopenCompleted",
]);
const ALLOWED_SNAPSHOT_KEYS = new Set(["schemaVersion", "revision", "positions", "updatedAt"]);

/**
 * Copy a plain data record without reading properties through normal access.
 * Getters, symbols, inherited fields, non-enumerable fields and hostile proxies
 * are rejected. The returned object has no prototype and cannot run user code
 * when a field is read.
 */
function canonicalDataRecord(
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

/** Copy a dense JSON-like array without invoking indexed getters or proxy traps
 * outside this guarded boundary. Sparse arrays and custom/symbol properties
 * are rejected rather than normalized.
 */
function canonicalArray(value: unknown, maxLength: number): unknown[] | null {
  try {
    if (!Array.isArray(value)) return null;
    const length = value.length;
    if (!Number.isSafeInteger(length) || length < 0 || length > maxLength) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1 || !keys.includes("length")) return null;
    for (const key of keys) {
      if (key === "length") continue;
      if (
        typeof key !== "string" ||
        !/^(0|[1-9][0-9]*)$/.test(key) ||
        Number(key) >= length
      ) return null;
    }

    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalPositions(value: unknown): readonly Readonly<ReadingPosition>[] | null {
  const entries = canonicalArray(value, MAX_POSITIONS);
  if (entries === null) return null;

  const records: Record<string, unknown>[] = [];
  for (const entry of entries) {
    const record = canonicalDataRecord(entry, ALLOWED_POSITION_KEYS);
    if (record === null) return null;
    records.push(record);
  }

  // Revalidate against the edition catalogue after hostile values have been
  // copied into inert, null-prototype records.
  const validated = validEditionBoundReadingPositions(records);
  if (validated === null || validated.length !== records.length) return null;

  const seen = new Set<string>();
  const positions: ReadingPosition[] = [];

  for (const raw of records) {
    if (!Object.prototype.hasOwnProperty.call(raw, "bookId")) return null;
    if (typeof raw.bookId !== "string" || raw.bookId.length === 0 || raw.bookId !== raw.bookId.trim()) return null;
    if (seen.has(raw.bookId)) return null;
    seen.add(raw.bookId);

    if (getHoidEditionProgressPolicy(raw.bookId).kind === "unknown") return null;

    if (raw.completed === true) {
      if (Object.prototype.hasOwnProperty.call(raw, "chapter")) return null;
      if (
        raw.order !== undefined &&
        (typeof raw.order !== "number" || !Number.isSafeInteger(raw.order) || raw.order < 0 || raw.order > 1_000_000)
      ) return null;
      positions.push(Object.freeze({
        bookId: raw.bookId,
        completed: true,
        ...(raw.order === undefined ? {} : { order: raw.order as number }),
      }));
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(raw, "completed")) return null;
    if (typeof raw.chapter !== "number" || !Number.isSafeInteger(raw.chapter) || raw.chapter < 1) return null;
    if (
      raw.order !== undefined &&
      (typeof raw.order !== "number" || !Number.isSafeInteger(raw.order) || raw.order < 0 || raw.order > 1_000_000)
    ) return null;

    positions.push(Object.freeze({
      bookId: raw.bookId,
      chapter: raw.chapter,
      ...(raw.order === undefined ? {} : { order: raw.order as number }),
    }));
  }

  positions.sort((a, b) => a.bookId.localeCompare(b.bookId));
  return Object.freeze(positions);
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function canonicalSnapshot(value: unknown): HoidProgressLedgerSnapshot | null {
  const record = canonicalDataRecord(value, ALLOWED_SNAPSHOT_KEYS);
  if (record === null) return null;
  if (record.schemaVersion !== 1) return null;
  if (!Number.isSafeInteger(record.revision) || (record.revision as number) < 0 || (record.revision as number) > MAX_REVISION) return null;
  const revision = record.revision as number;
  const positions = canonicalPositions(record.positions);
  if (positions === null) return null;

  const updatedAt = record.updatedAt;
  if (updatedAt !== null && !isCanonicalTimestamp(updatedAt)) return null;
  if ((revision === 0 && (updatedAt !== null || positions.length !== 0)) || (revision > 0 && updatedAt === null)) return null;

  return Object.freeze({
    schemaVersion: 1,
    revision,
    positions,
    updatedAt: updatedAt as string | null,
  });
}

export function emptyHoidProgressLedger(): HoidProgressLedgerSnapshot {
  return Object.freeze({
    schemaVersion: 1,
    revision: 0,
    positions: Object.freeze([]),
    updatedAt: null,
  });
}

/**
 * Versioned progress service. The store is injected, so SQLite, AsyncStorage,
 * a remote database or a test adapter can be used without changing policy.
 * All writes are optimistic and require the revision the caller last read.
 */
export class HoidProgressLedger {
  constructor(
    private readonly store: HoidProgressStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async read(): Promise<HoidProgressReadResult> {
    let raw: unknown;
    try {
      raw = await this.store.read();
    } catch {
      return Object.freeze({ status: "unavailable", reason: "storage-error" });
    }

    const snapshot = canonicalSnapshot(raw);
    if (!snapshot) return Object.freeze({ status: "unavailable", reason: "corrupt-ledger" });
    return Object.freeze({ status: "ready", snapshot });
  }

  async update(input: unknown): Promise<HoidProgressResult> {
    const record = canonicalDataRecord(input, ALLOWED_UPDATE_KEYS);
    if (record === null) {
      return Object.freeze({ status: "rejected", reason: "invalid-update" });
    }

    const expectedRevision = record.expectedRevision;
    const bookId = record.bookId;
    if (
      typeof expectedRevision !== "number" ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      expectedRevision > MAX_REVISION ||
      typeof bookId !== "string" ||
      !bookId ||
      bookId !== bookId.trim()
    ) return Object.freeze({ status: "rejected", reason: "invalid-update" });

    if (getHoidEditionProgressPolicy(bookId).kind === "unknown") {
      return Object.freeze({ status: "rejected", reason: "unknown-work" });
    }

    const isCompletion = record.complete === true;
    const hasChapter = record.chapter !== undefined;
    if (isCompletion === hasChapter) {
      return Object.freeze({ status: "rejected", reason: "invalid-update" });
    }
    if (record.complete !== undefined && record.complete !== true) {
      return Object.freeze({ status: "rejected", reason: "invalid-update" });
    }
    for (const key of ["confirmCompletion", "allowRegression", "reopenCompleted"] as const) {
      if (input[key] !== undefined && input[key] !== true) {
        return Object.freeze({ status: "rejected", reason: "invalid-update" });
      }
    }
    if (isCompletion && record.confirmCompletion !== true) {
      return Object.freeze({ status: "rejected", reason: "completion-not-confirmed" });
    }
    if (!isCompletion && record.confirmCompletion !== undefined) {
      return Object.freeze({ status: "rejected", reason: "invalid-update" });
    }
    if (isCompletion && (record.allowRegression === true || record.reopenCompleted === true)) {
      return Object.freeze({ status: "rejected", reason: "invalid-update" });
    }
    if (record.reopenCompleted === true && !hasChapter) {
      return Object.freeze({ status: "rejected", reason: "invalid-update" });
    }

    let current: HoidProgressLedgerSnapshot;
    try {
      const raw = await this.store.read();
      const parsed = canonicalSnapshot(raw);
      if (!parsed) return Object.freeze({ status: "rejected", reason: "corrupt-ledger" });
      current = parsed;
    } catch {
      return Object.freeze({ status: "rejected", reason: "storage-error" });
    }

    if (current.revision !== expectedRevision) {
      return Object.freeze({ status: "conflict", expectedRevision });
    }

    const existing = current.positions.find(position => position.bookId === bookId);
    if (isCompletion) {
      if (existing?.completed === true) {
        return Object.freeze({ status: "unchanged", snapshot: current });
      }
    } else {
      const chapter = record.chapter;
      if (typeof chapter !== "number" || !Number.isSafeInteger(chapter) || chapter < 1) {
        return Object.freeze({ status: "rejected", reason: "unsupported-position" });
      }
      const validated = canonicalPositions([{ bookId, chapter }]);
      if (!validated || validated.length !== 1) {
        return Object.freeze({ status: "rejected", reason: "unsupported-position" });
      }
      if (record.reopenCompleted === true && existing?.completed !== true) {
        return Object.freeze({ status: "rejected", reason: "invalid-update" });
      }
      if (existing?.completed === true && record.reopenCompleted !== true) {
        return Object.freeze({ status: "rejected", reason: "already-completed" });
      }
      if (
        existing?.chapter !== undefined &&
        chapter < existing.chapter &&
        record.allowRegression !== true
      ) {
        return Object.freeze({ status: "rejected", reason: "regression-requires-confirmation" });
      }
      if (existing?.chapter === chapter) {
        return Object.freeze({ status: "unchanged", snapshot: current });
      }
    }

    if (current.revision >= MAX_REVISION) {
      return Object.freeze({ status: "rejected", reason: "corrupt-ledger" });
    }

    let updatedAt: string;
    try {
      updatedAt = this.now();
    } catch {
      return Object.freeze({ status: "rejected", reason: "invalid-clock" });
    }
    if (!isCanonicalTimestamp(updatedAt)) {
      return Object.freeze({ status: "rejected", reason: "invalid-clock" });
    }

    const nextPosition: ReadingPosition = isCompletion
      ? { bookId, completed: true }
      : { bookId, chapter: record.chapter as number };
    const positions = current.positions
      .filter(position => position.bookId !== bookId)
      .concat(nextPosition)
      .sort((a, b) => a.bookId.localeCompare(b.bookId));
    const next = canonicalSnapshot({
      schemaVersion: 1,
      revision: current.revision + 1,
      positions,
      updatedAt,
    });
    if (!next) return Object.freeze({ status: "rejected", reason: "corrupt-ledger" });

    try {
      const written: unknown = await this.store.compareAndSwap(expectedRevision, next);
      if (written === false) return Object.freeze({ status: "conflict", expectedRevision });
      // A JavaScript adapter can violate its TypeScript declaration at runtime.
      // Only the literal boolean true proves that the adapter accepted the write.
      if (written !== true) return Object.freeze({ status: "rejected", reason: "invalid-store-result" });
    } catch {
      return Object.freeze({ status: "rejected", reason: "storage-error" });
    }

    return Object.freeze({ status: "updated", snapshot: next });
  }
}
