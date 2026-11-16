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
        | "storage-error";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every(key => allowed.has(key));
}

function canonicalPositions(value: unknown): readonly Readonly<ReadingPosition>[] | null {
  if (!Array.isArray(value) || value.length > MAX_POSITIONS) return null;

  const validated = validEditionBoundReadingPositions(value);
  if (validated === null || validated.length !== value.length) return null;

  const seen = new Set<string>();
  const positions: ReadingPosition[] = [];

  for (const raw of value) {
    if (!isRecord(raw) || !hasOnlyKeys(raw, ALLOWED_POSITION_KEYS)) return null;
    if (typeof raw.bookId !== "string" || raw.bookId.length === 0 || raw.bookId !== raw.bookId.trim()) return null;
    if (seen.has(raw.bookId)) return null;
    seen.add(raw.bookId);

    if (getHoidEditionProgressPolicy(raw.bookId).kind === "unknown") return null;

    if (raw.completed === true) {
      if (raw.chapter !== undefined) return null;
      if (raw.order !== undefined && (!Number.isSafeInteger(raw.order) || (raw.order as number) < 0 || (raw.order as number) > 1_000_000)) return null;
      positions.push(Object.freeze({
        bookId: raw.bookId,
        completed: true,
        ...(raw.order === undefined ? {} : { order: raw.order as number }),
      }));
      continue;
    }

    if (raw.completed !== undefined) return null;
    if (typeof raw.chapter !== "number" || !Number.isSafeInteger(raw.chapter) || raw.chapter < 1) return null;
    if (raw.order !== undefined && (!Number.isSafeInteger(raw.order) || (raw.order as number) < 0 || (raw.order as number) > 1_000_000)) return null;

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
  if (!isRecord(value) || !hasOnlyKeys(value, new Set(["schemaVersion", "revision", "positions", "updatedAt"]))) return null;
  if (value.schemaVersion !== 1) return null;
  if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 0 || (value.revision as number) > MAX_REVISION) return null;
  const revision = value.revision as number;
  const positions = canonicalPositions(value.positions);
  if (positions === null) return null;

  const updatedAt = value.updatedAt;
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
    if (!isRecord(input) || !hasOnlyKeys(input, ALLOWED_UPDATE_KEYS)) {
      return Object.freeze({ status: "rejected", reason: "invalid-update" });
    }

    const expectedRevision = input.expectedRevision;
    const bookId = input.bookId;
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

    const isCompletion = input.complete === true;
    const hasChapter = input.chapter !== undefined;
    if (isCompletion === hasChapter) {
      return Object.freeze({ status: "rejected", reason: "invalid-update" });
    }
    if (input.complete !== undefined && input.complete !== true) {
      return Object.freeze({ status: "rejected", reason: "invalid-update" });
    }
    for (const key of ["confirmCompletion", "allowRegression", "reopenCompleted"] as const) {
      if (input[key] !== undefined && input[key] !== true) {
        return Object.freeze({ status: "rejected", reason: "invalid-update" });
      }
    }
    if (isCompletion && input.confirmCompletion !== true) {
      return Object.freeze({ status: "rejected", reason: "completion-not-confirmed" });
    }
    if (!isCompletion && input.confirmCompletion !== undefined) {
      return Object.freeze({ status: "rejected", reason: "invalid-update" });
    }
    if (isCompletion && (input.allowRegression === true || input.reopenCompleted === true)) {
      return Object.freeze({ status: "rejected", reason: "invalid-update" });
    }
    if (input.reopenCompleted === true && !hasChapter) {
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
      const chapter = input.chapter;
      if (typeof chapter !== "number" || !Number.isSafeInteger(chapter) || chapter < 1) {
        return Object.freeze({ status: "rejected", reason: "unsupported-position" });
      }
      const validated = canonicalPositions([{ bookId, chapter }]);
      if (!validated || validated.length !== 1) {
        return Object.freeze({ status: "rejected", reason: "unsupported-position" });
      }
      if (input.reopenCompleted === true && existing?.completed !== true) {
        return Object.freeze({ status: "rejected", reason: "invalid-update" });
      }
      if (existing?.completed === true && input.reopenCompleted !== true) {
        return Object.freeze({ status: "rejected", reason: "already-completed" });
      }
      if (
        existing?.chapter !== undefined &&
        chapter < existing.chapter &&
        input.allowRegression !== true
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
      : { bookId, chapter: input.chapter as number };
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
      const written = await this.store.compareAndSwap(expectedRevision, next);
      if (!written) return Object.freeze({ status: "conflict", expectedRevision });
    } catch {
      return Object.freeze({ status: "rejected", reason: "storage-error" });
    }

    return Object.freeze({ status: "updated", snapshot: next });
  }
}
