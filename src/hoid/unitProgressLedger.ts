import { getHoidEditionProgressPolicy } from "./editionStructure";
import {
  validateHoidUnitProgressCursor,
  type HoidUnitProgressCursor,
} from "./unitProgressCursor";

export type HoidUnitProgressPosition =
  | Readonly<{ bookId: string; cursor: HoidUnitProgressCursor; order?: number }>
  | Readonly<{ bookId: string; completed: true; order?: number }>;

export type HoidUnitProgressSnapshot = Readonly<{
  schemaVersion: 3;
  revision: number;
  positions: readonly HoidUnitProgressPosition[];
  updatedAt: string | null;
}>;

/**
 * A durable adapter must implement compareAndSwap atomically across every
 * coordinator sharing the same store. A read followed by an unconditional
 * write is not a conforming implementation.
 */
export interface HoidUnitProgressStore {
  read(): Promise<unknown>;
  compareAndSwap(expectedRevision: number, next: HoidUnitProgressSnapshot): Promise<boolean>;
}

export type HoidUnitProgressValidation =
  | Readonly<{ status: "valid"; snapshot: HoidUnitProgressSnapshot }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-shape"
        | "invalid-revision"
        | "invalid-position"
        | "duplicate-book"
        | "duplicate-order"
        | "unknown-work"
        | "invalid-timestamp"
        | "invalid-revision-state";
    }>;

export type HoidUnitProgressResult =
  | Readonly<{
      status: "ready";
      operation: "loaded" | "updated" | "unchanged";
      snapshot: HoidUnitProgressSnapshot;
    }>
  | Readonly<{
      status: "conflict";
      expectedRevision: number;
      snapshot?: HoidUnitProgressSnapshot;
    }>
  | Readonly<{
      status: "rejected";
      reason:
        | "invalid-input"
        | "unknown-work"
        | "invalid-cursor"
        | "unsupported-position"
        | "progress-confirmation-required"
        | "already-positioned"
        | "already-completed"
        | "non-sequential-advance"
        | "regression-requires-confirmation";
    }>
  | Readonly<{
      status: "unavailable";
      reason: "corrupt-ledger" | "storage-error" | "clock-error" | "revision-exhausted";
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

    const keys = Reflect.ownKeys(value);
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
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
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
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

function canonicalPosition(value: unknown): HoidUnitProgressPosition | null {
  const record = canonicalRecord(value, POSITION_KEYS);
  if (!record) return null;

  const bookId = record.bookId;
  if (
    typeof bookId !== "string" ||
    bookId.length < 1 ||
    bookId.length > 256 ||
    bookId !== bookId.trim()
  ) return null;

  if (getHoidEditionProgressPolicy(bookId).kind === "unknown") return null;

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
  const cursor = validateHoidUnitProgressCursor(record.cursor);
  if (cursor.status !== "valid" || cursor.cursor.reference.bookId !== bookId) return null;

  return Object.freeze({
    bookId,
    cursor: cursor.cursor,
    ...(order === undefined ? {} : { order }),
  });
}

/** Validate untrusted v3 data and revalidate every cursor against its edition manifest. */
export function validateHoidUnitProgressSnapshot(value: unknown): HoidUnitProgressValidation {
  const record = canonicalRecord(value, SNAPSHOT_KEYS);
  if (!record || record.schemaVersion !== 3) {
    return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  }
  if (
    typeof record.revision !== "number" ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0 ||
    record.revision > MAX_REVISION
  ) return Object.freeze({ status: "invalid", reason: "invalid-revision" });

  const rawPositions = canonicalDenseArray(record.positions);
  if (!rawPositions) return Object.freeze({ status: "invalid", reason: "invalid-shape" });

  const positions: HoidUnitProgressPosition[] = [];
  const seenBooks = new Set<string>();
  const seenOrders = new Set<number>();
  for (const raw of rawPositions) {
    const position = canonicalPosition(raw);
    if (!position) {
      const candidate = canonicalRecord(raw, POSITION_KEYS);
      if (
        candidate &&
        typeof candidate.bookId === "string" &&
        getHoidEditionProgressPolicy(candidate.bookId).kind === "unknown"
      ) return Object.freeze({ status: "invalid", reason: "unknown-work" });
      return Object.freeze({ status: "invalid", reason: "invalid-position" });
    }
    if (seenBooks.has(position.bookId)) {
      return Object.freeze({ status: "invalid", reason: "duplicate-book" });
    }
    seenBooks.add(position.bookId);
    if (position.order !== undefined) {
      if (seenOrders.has(position.order)) {
        return Object.freeze({ status: "invalid", reason: "duplicate-order" });
      }
      seenOrders.add(position.order);
    }
    positions.push(position);
  }

  positions.sort((left, right) => left.bookId.localeCompare(right.bookId));
  if (record.updatedAt !== null && !canonicalTimestamp(record.updatedAt)) {
    return Object.freeze({ status: "invalid", reason: "invalid-timestamp" });
  }
  const revision = record.revision as number;
  if (
    (revision === 0 && (record.updatedAt !== null || positions.length !== 0)) ||
    (revision > 0 && record.updatedAt === null)
  ) return Object.freeze({ status: "invalid", reason: "invalid-revision-state" });

  return Object.freeze({
    status: "valid",
    snapshot: Object.freeze({
      schemaVersion: 3,
      revision,
      positions: Object.freeze(positions),
      updatedAt: record.updatedAt as string | null,
    }),
  });
}

export function emptyHoidUnitProgressSnapshot(): HoidUnitProgressSnapshot {
  return Object.freeze({
    schemaVersion: 3,
    revision: 0,
    positions: Object.freeze([]),
    updatedAt: null,
  });
}

function canonicalConfirmation(value: unknown): boolean {
  const record = canonicalRecord(value, new Set(["confirmed"]));
  return record !== null &&
    Reflect.ownKeys(record).length === 1 &&
    record.confirmed === true;
}

function validRevision(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_REVISION;
}

function validBookId(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    value === value.trim() &&
    getHoidEditionProgressPolicy(value).kind !== "unknown";
}

function validateCursorForBook(bookId: string, value: unknown): HoidUnitProgressResult | null {
  const validation = validateHoidUnitProgressCursor(value);
  if (validation.status === "valid" && validation.cursor.reference.bookId === bookId) return null;
  if (validation.status === "invalid" && validation.reason === "unknown-work") {
    return Object.freeze({ status: "rejected", reason: "unknown-work" });
  }
  if (
    validation.status === "invalid" &&
    (validation.reason === "segmentation-unverified" || validation.reason === "non-contiguous-prefix")
  ) return Object.freeze({ status: "rejected", reason: "unsupported-position" });
  return Object.freeze({ status: "rejected", reason: "invalid-cursor" });
}

function sameCursor(left: HoidUnitProgressCursor, right: HoidUnitProgressCursor): boolean {
  return left.reference.bookId === right.reference.bookId &&
    left.reference.unitId === right.reference.unitId &&
    left.reference.ordinal === right.reference.ordinal &&
    left.reference.identityFingerprint === right.reference.identityFingerprint;
}

function nextOrder(positions: readonly HoidUnitProgressPosition[]): number | null {
  const values = positions.map(position => position.order).filter((value): value is number => value !== undefined);
  const next = values.length === 0 ? 0 : Math.max(...values) + 1;
  return next <= MAX_ORDER ? next : null;
}

/**
 * Provider-neutral v3 ledger for exact unit cursors.
 *
 * The current open unit is stored, while its preceding verified ordinal prefix
 * is the completed boundary. Advancing requires an explicit reader action and
 * exactly the next ordinal. Completion remains a separate user attestation;
 * the final numbered unit never proves that unnumbered EPUB sections are read.
 */
export class HoidUnitProgressLedger {
  constructor(
    private readonly store: HoidUnitProgressStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async read(): Promise<HoidUnitProgressResult> {
    let raw: unknown;
    try {
      raw = await this.store.read();
    } catch {
      return Object.freeze({ status: "unavailable", reason: "storage-error" });
    }
    const validation = validateHoidUnitProgressSnapshot(raw);
    if (validation.status !== "valid") {
      return Object.freeze({ status: "unavailable", reason: "corrupt-ledger" });
    }
    return Object.freeze({ status: "ready", operation: "loaded", snapshot: validation.snapshot });
  }

  /** Set a reader-declared starting unit; earlier units are an explicit attestation. */
  async setInitialCursor(
    bookId: string,
    cursorValue: unknown,
    expectedRevision: number,
    confirmation: unknown,
  ): Promise<HoidUnitProgressResult> {
    if (!validBookId(bookId)) return Object.freeze({ status: "rejected", reason: "unknown-work" });
    if (!validRevision(expectedRevision)) return Object.freeze({ status: "rejected", reason: "invalid-input" });
    if (!canonicalConfirmation(confirmation)) {
      return Object.freeze({ status: "rejected", reason: "progress-confirmation-required" });
    }
    const cursorError = validateCursorForBook(bookId, cursorValue);
    if (cursorError) return cursorError;
    const cursor = validateHoidUnitProgressCursor(cursorValue);
    if (cursor.status !== "valid") return Object.freeze({ status: "rejected", reason: "invalid-cursor" });

    const loaded = await this.read();
    if (loaded.status !== "ready") return loaded;
    if (loaded.snapshot.revision !== expectedRevision) {
      return Object.freeze({ status: "conflict", expectedRevision, snapshot: loaded.snapshot });
    }
    if (loaded.snapshot.positions.some(position => position.bookId === bookId)) {
      return Object.freeze({ status: "rejected", reason: "already-positioned" });
    }
    const order = nextOrder(loaded.snapshot.positions);
    if (order === null) return Object.freeze({ status: "unavailable", reason: "revision-exhausted" });
    return this.commit(loaded.snapshot, [
      ...loaded.snapshot.positions,
      Object.freeze({ bookId, cursor: cursor.cursor, order }),
    ], expectedRevision);
  }

  /** Advance one exact unit only; skipped or backward units require a separate correction. */
  async advance(
    bookId: string,
    cursorValue: unknown,
    expectedRevision: number,
    confirmation: unknown,
  ): Promise<HoidUnitProgressResult> {
    if (!validBookId(bookId)) return Object.freeze({ status: "rejected", reason: "unknown-work" });
    if (!validRevision(expectedRevision)) return Object.freeze({ status: "rejected", reason: "invalid-input" });
    if (!canonicalConfirmation(confirmation)) {
      return Object.freeze({ status: "rejected", reason: "progress-confirmation-required" });
    }
    const cursorError = validateCursorForBook(bookId, cursorValue);
    if (cursorError) return cursorError;
    const cursor = validateHoidUnitProgressCursor(cursorValue);
    if (cursor.status !== "valid") return Object.freeze({ status: "rejected", reason: "invalid-cursor" });

    const loaded = await this.read();
    if (loaded.status !== "ready") return loaded;
    if (loaded.snapshot.revision !== expectedRevision) {
      return Object.freeze({ status: "conflict", expectedRevision, snapshot: loaded.snapshot });
    }
    const existing = loaded.snapshot.positions.find(position => position.bookId === bookId);
    if (!existing) {
      if (cursor.cursor.reference.ordinal !== 1) {
        return Object.freeze({ status: "rejected", reason: "non-sequential-advance" });
      }
      const order = nextOrder(loaded.snapshot.positions);
      if (order === null) return Object.freeze({ status: "unavailable", reason: "revision-exhausted" });
      return this.commit(loaded.snapshot, [
        ...loaded.snapshot.positions,
        Object.freeze({ bookId, cursor: cursor.cursor, order }),
      ], expectedRevision);
    }
    if ("completed" in existing) {
      return Object.freeze({ status: "rejected", reason: "already-completed" });
    }
    const current = existing.cursor.reference;
    const next = cursor.cursor.reference;
    if (next.ordinal === current.ordinal && sameCursor(existing.cursor, cursor.cursor)) {
      return Object.freeze({ status: "ready", operation: "unchanged", snapshot: loaded.snapshot });
    }
    if (next.ordinal <= current.ordinal) {
      return Object.freeze({ status: "rejected", reason: "regression-requires-confirmation" });
    }
    if (next.ordinal !== current.ordinal + 1) {
      return Object.freeze({ status: "rejected", reason: "non-sequential-advance" });
    }
    return this.replacePosition(loaded.snapshot, bookId, Object.freeze({
      bookId,
      cursor: cursor.cursor,
      ...(existing.order === undefined ? {} : { order: existing.order }),
    }), expectedRevision);
  }

  /** Explicitly correct a cursor after the reader confirms the new boundary. */
  async correctCursor(
    bookId: string,
    cursorValue: unknown,
    expectedRevision: number,
    confirmation: unknown,
  ): Promise<HoidUnitProgressResult> {
    if (!validBookId(bookId)) return Object.freeze({ status: "rejected", reason: "unknown-work" });
    if (!validRevision(expectedRevision)) return Object.freeze({ status: "rejected", reason: "invalid-input" });
    if (!canonicalConfirmation(confirmation)) {
      return Object.freeze({ status: "rejected", reason: "progress-confirmation-required" });
    }
    const cursorError = validateCursorForBook(bookId, cursorValue);
    if (cursorError) return cursorError;
    const cursor = validateHoidUnitProgressCursor(cursorValue);
    if (cursor.status !== "valid") return Object.freeze({ status: "rejected", reason: "invalid-cursor" });

    const loaded = await this.read();
    if (loaded.status !== "ready") return loaded;
    if (loaded.snapshot.revision !== expectedRevision) {
      return Object.freeze({ status: "conflict", expectedRevision, snapshot: loaded.snapshot });
    }
    const existing = loaded.snapshot.positions.find(position => position.bookId === bookId);
    if (existing && "completed" in existing) {
      return Object.freeze({ status: "rejected", reason: "already-completed" });
    }
    if (existing && sameCursor(existing.cursor, cursor.cursor)) {
      return Object.freeze({ status: "ready", operation: "unchanged", snapshot: loaded.snapshot });
    }
    const order = existing?.order ?? nextOrder(loaded.snapshot.positions);
    if (order === null || order === undefined) {
      return Object.freeze({ status: "unavailable", reason: "revision-exhausted" });
    }
    return this.replacePosition(loaded.snapshot, bookId, Object.freeze({
      bookId,
      cursor: cursor.cursor,
      order,
    }), expectedRevision);
  }

  /** Completion is never inferred from a numbered cursor or a partial manifest. */
  async complete(
    bookId: string,
    expectedRevision: number,
    confirmation: unknown,
  ): Promise<HoidUnitProgressResult> {
    if (!validBookId(bookId)) return Object.freeze({ status: "rejected", reason: "unknown-work" });
    if (!validRevision(expectedRevision)) return Object.freeze({ status: "rejected", reason: "invalid-input" });
    if (!canonicalConfirmation(confirmation)) {
      return Object.freeze({ status: "rejected", reason: "progress-confirmation-required" });
    }
    const loaded = await this.read();
    if (loaded.status !== "ready") return loaded;
    if (loaded.snapshot.revision !== expectedRevision) {
      return Object.freeze({ status: "conflict", expectedRevision, snapshot: loaded.snapshot });
    }
    const existing = loaded.snapshot.positions.find(position => position.bookId === bookId);
    if (existing && "completed" in existing) {
      return Object.freeze({ status: "ready", operation: "unchanged", snapshot: loaded.snapshot });
    }
    const order = existing?.order ?? nextOrder(loaded.snapshot.positions);
    if (order === null || order === undefined) {
      return Object.freeze({ status: "unavailable", reason: "revision-exhausted" });
    }
    return this.replacePosition(loaded.snapshot, bookId, Object.freeze({
      bookId,
      completed: true as const,
      order,
    }), expectedRevision);
  }

  private replacePosition(
    current: HoidUnitProgressSnapshot,
    bookId: string,
    replacement: HoidUnitProgressPosition,
    expectedRevision: number,
  ): Promise<HoidUnitProgressResult> {
    const exists = current.positions.some(position => position.bookId === bookId);
    const positions = exists
      ? current.positions.map(position => position.bookId === bookId ? replacement : position)
      : [...current.positions, replacement];
    return this.commit(current, positions, expectedRevision);
  }

  private async commit(
    current: HoidUnitProgressSnapshot,
    positions: readonly HoidUnitProgressPosition[],
    expectedRevision: number,
  ): Promise<HoidUnitProgressResult> {
    if (current.revision >= MAX_REVISION) {
      return Object.freeze({ status: "unavailable", reason: "revision-exhausted" });
    }
    let updatedAt: string;
    try {
      updatedAt = this.now();
    } catch {
      return Object.freeze({ status: "unavailable", reason: "clock-error" });
    }
    if (!canonicalTimestamp(updatedAt)) {
      return Object.freeze({ status: "unavailable", reason: "clock-error" });
    }
    const candidate = {
      schemaVersion: 3 as const,
      revision: current.revision + 1,
      positions,
      updatedAt,
    };
    const validation = validateHoidUnitProgressSnapshot(candidate);
    if (validation.status !== "valid") {
      return Object.freeze({ status: "unavailable", reason: "corrupt-ledger" });
    }
    try {
      const written = await this.store.compareAndSwap(expectedRevision, validation.snapshot);
      if (!written) {
        const latest = await this.read();
        return latest.status === "ready"
          ? Object.freeze({ status: "conflict", expectedRevision, snapshot: latest.snapshot })
          : latest;
      }
      return Object.freeze({ status: "ready", operation: "updated", snapshot: validation.snapshot });
    } catch {
      return Object.freeze({ status: "unavailable", reason: "storage-error" });
    }
  }
}
