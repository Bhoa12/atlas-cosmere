import { getHoidEditionProgressPolicy } from "./editionStructure";
import {
  validateHoidCursorProgressSnapshot,
  type HoidCursorProgressPosition,
  type HoidCursorProgressSnapshot,
} from "./cursorProgressLedger";
import {
  createHoidReadingCursor,
  getHoidReadingManifest,
  validateHoidReadingCursor,
  type HoidReadingCursor,
} from "./readingManifest";
import type {
  HoidCursorProgressStore,
  HoidCursorStoreLoadResult,
} from "./cursorSqliteProgressStore";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./cursorProgressFingerprint";

type StoreFailureReason = Extract<
  HoidCursorStoreLoadResult,
  { status: "unavailable" }
>["reason"];

export type HoidCursorCoordinatorResult =
  | Readonly<{
      status: "ready";
      operation: "loaded" | "migrated" | "refreshed" | "updated" | "unchanged";
      snapshot: HoidCursorProgressSnapshot;
    }>
  | Readonly<{ status: "conflict"; snapshot: HoidCursorProgressSnapshot }>
  | Readonly<{
      status: "rejected";
      reason:
        | "unknown-work"
        | "invalid-cursor"
        | "regression-requires-confirmation"
        | "already-completed"
        | "reopen-requires-confirmation"
        | "not-completed"
        | "unsupported-position"
        | "invalid-update"
        | "non-sequential-reader-advance"
        | "completion-requires-explicit-confirmation";
    }>
  | Readonly<{
      status: "unavailable";
      reason: StoreFailureReason | "corrupt-v2" | "clock-error" | "revision-exhausted";
    }>;

export type HoidCursorCorrectionConfirmation = Readonly<{
  confirmed: true;
  reopenCompleted?: true;
}>;

export type HoidReopenConfirmation = Readonly<{ confirmed: true }>;

const MAX_ORDER = 1_000_000;
const MAX_REVISION = Number.MAX_SAFE_INTEGER - 1;

type PositionInput =
  | Readonly<{ bookId: string; cursor: HoidReadingCursor }>
  | Readonly<{ bookId: string; completed: true }>;

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}


function canonicalConfirmation(
  value: unknown,
  allowReopen: boolean,
): Readonly<{ confirmed: true; reopenCompleted: boolean }> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const allowed = allowReopen
      ? new Set(["confirmed", "reopenCompleted"])
      : new Set(["confirmed"]);
    const keys = Reflect.ownKeys(value);
    if (!keys.includes("confirmed") || keys.length > allowed.size) return null;

    const record = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }

    if (record.confirmed !== true) return null;
    if (
      Object.prototype.hasOwnProperty.call(record, "reopenCompleted") &&
      record.reopenCompleted !== true
    ) return null;

    return Object.freeze({
      confirmed: true as const,
      reopenCompleted: record.reopenCompleted === true,
    });
  } catch {
    return null;
  }
}

function isKnownWork(bookId: unknown): bookId is string {
  return typeof bookId === "string" &&
    bookId.length > 0 &&
    bookId.length <= 256 &&
    bookId === bookId.trim() &&
    getHoidEditionProgressPolicy(bookId).kind !== "unknown";
}

/**
 * Coordinates edition-bound progress mutations.
 *
 * The coordinator is provider- and platform-independent. It accepts only
 * manifest-validated cursors, serializes local operations and relies on the
 * store compare-and-swap contract for cross-instance conflict detection.
 */
export class HoidCursorProgressCoordinator {
  private snapshot: HoidCursorProgressSnapshot | null = null;
  private initialization: Promise<HoidCursorCoordinatorResult> | null = null;
  private queue: Promise<void> = Promise.resolve();
  private readonly progressListeners = new Set<() => void>();

  constructor(
    private readonly store: HoidCursorProgressStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  getSnapshot(): HoidCursorProgressSnapshot | null {
    return this.snapshot;
  }

  /**
   * Subscribe to committed progress changes in this coordinator. The event is
   * payload-free and is emitted only after a successful durable commit or when
   * refresh discovers a different committed snapshot from another coordinator.
   */
  subscribe(listener: () => void): () => void {
    if (typeof listener !== "function") return () => {};
    this.progressListeners.add(listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.progressListeners.delete(listener);
    };
  }

  private notifyProgressChanged(): void {
    for (const listener of [...this.progressListeners]) {
      try {
        listener();
      } catch {
        // A UI or gateway listener must never roll back a durable ledger commit.
      }
    }
  }

  private sameProgressSnapshot(
    left: HoidCursorProgressSnapshot,
    right: HoidCursorProgressSnapshot,
  ): boolean {
    return left.revision === right.revision &&
      JSON.stringify(left.positions) === JSON.stringify(right.positions);
  }

  initialize(): Promise<HoidCursorCoordinatorResult> {
    if (this.snapshot) {
      return Promise.resolve(Object.freeze({
        status: "ready" as const,
        operation: "loaded" as const,
        snapshot: this.snapshot,
      }));
    }
    if (this.initialization) return this.initialization;

    const pending = this.store.load().then(result => this.acceptLoad(result)).catch(() => {
      this.snapshot = null;
      this.initialization = null;
      return Object.freeze({
        status: "unavailable" as const,
        reason: "storage-error" as const,
      });
    });
    this.initialization = pending;
    return pending;
  }

  /**
   * Reload the durable store instead of trusting the coordinator's in-memory
   * snapshot. Conversation and recommendation gateways use this at both sides
   * of asynchronous work so another coordinator or app window cannot leave
   * spoiler authorization bound to a stale cursor.
   */
  refresh(): Promise<HoidCursorCoordinatorResult> {
    return this.serialize(async () => {
      try {
        if (this.initialization) await this.initialization;

        // Clear the cache before the durable read. Concurrent initialize()
        // calls then join this same in-flight load instead of returning the
        // stale snapshot that the refresh is replacing.
        const previousSnapshot = this.snapshot;
        this.snapshot = null;
        const pending = this.store.load()
          .then(result => this.acceptLoad(result))
          .catch(() => {
            this.snapshot = null;
            this.initialization = null;
            return Object.freeze({ status: "unavailable" as const, reason: "storage-error" as const });
          });
        this.initialization = pending;
        const loaded = await pending;
        if (this.initialization === pending) this.initialization = null;
        if (loaded.status !== "ready") return loaded;
        if (previousSnapshot && !this.sameProgressSnapshot(previousSnapshot, loaded.snapshot)) {
          this.notifyProgressChanged();
        }

        return Object.freeze({
          status: "ready" as const,
          operation: "refreshed" as const,
          snapshot: loaded.snapshot,
        });
      } catch {
        this.snapshot = null;
        this.initialization = null;
        return Object.freeze({ status: "unavailable" as const, reason: "storage-error" as const });
      }
    });
  }

  /** Advance to a later validated cursor. It can never move a reader backwards. */
  advance(bookId: string, cursorValue: unknown): Promise<HoidCursorCoordinatorResult> {
    return this.serialize(async () => {
      if (!isKnownWork(bookId)) return this.rejected("unknown-work");
      const validated = validateHoidReadingCursor(cursorValue);
      if (validated.status !== "valid" || validated.cursor.bookId !== bookId) {
        return this.rejected("invalid-cursor");
      }

      const loaded = await this.initialize();
      if (loaded.status !== "ready" || !this.snapshot) return loaded;
      const existing = this.snapshot.positions.find(position => position.bookId === bookId);

      if (existing && "completed" in existing) return this.rejected("already-completed");
      if (existing && "cursor" in existing) {
        if (validated.cursor.ordinal < existing.cursor.ordinal) {
          return this.rejected("regression-requires-confirmation");
        }
        if (validated.cursor.ordinal === existing.cursor.ordinal) {
          return existing.cursor.unitId === validated.cursor.unitId &&
            existing.cursor.manifestId === validated.cursor.manifestId
            ? this.unchanged()
            : this.rejected("invalid-cursor");
        }
      }

      return this.commitPosition({ bookId, cursor: validated.cursor });
    });
  }

  /**
   * Reload and bind the durable snapshot to the progress identity that
   * authorized opening the chapter. Called only from serialized mutations.
   */
  private async loadSnapshotBoundToProgress(
    expectedRevision: number,
    expectedFingerprint: string,
  ): Promise<HoidCursorCoordinatorResult> {
    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      typeof expectedFingerprint !== "string" ||
      !/^[a-f0-9]{64}$/.test(expectedFingerprint)
    ) return this.rejected("invalid-update");

    try {
      const pendingInitialization = this.initialization;
      if (pendingInitialization) {
        await pendingInitialization;
        if (this.initialization === pendingInitialization) this.initialization = null;
      }

      // Never trust the cached React/coordinator snapshot for this explicit
      // mutation. Reload the durable ledger inside the same serialized queue.
      const previousSnapshot = this.snapshot;
      this.snapshot = null;
      const pending = this.store.load()
        .then(result => this.acceptLoad(result))
        .catch(() => {
          this.snapshot = null;
          this.initialization = null;
          return Object.freeze({ status: "unavailable" as const, reason: "storage-error" as const });
        });
      this.initialization = pending;
      const loaded = await pending;
      if (this.initialization === pending) this.initialization = null;
      if (loaded.status !== "ready") return loaded;
      if (previousSnapshot && !this.sameProgressSnapshot(previousSnapshot, loaded.snapshot)) {
        this.notifyProgressChanged();
      }

      const projection = projectHoidCursorProgressSnapshot(loaded.snapshot);
      if (projection.status !== "ready") {
        return Object.freeze({ status: "unavailable" as const, reason: "corrupt-v2" as const });
      }
      if (
        projection.revision !== expectedRevision ||
        fingerprintHoidCursorProgressProjection(projection) !== expectedFingerprint
      ) return Object.freeze({ status: "conflict" as const, snapshot: loaded.snapshot });

      return Object.freeze({
        status: "ready" as const,
        operation: "refreshed" as const,
        snapshot: loaded.snapshot,
      });
    } catch {
      this.snapshot = null;
      this.initialization = null;
      return Object.freeze({ status: "unavailable" as const, reason: "storage-error" as const });
    }
  }

  /**
   * Register a chapter as read after explicit user confirmation. The chapter
   * must be the one that was next when the reader opened it. The persisted
   * cursor then moves to the following chapter, because a cursor denotes the
   * chapter currently open in Atlas (not the last completed chapter).
   */
  markChapterReadIfCurrent(
    bookId: string,
    completedChapterNumber: number,
    expectedRevision: number,
    expectedFingerprint: string,
  ): Promise<HoidCursorCoordinatorResult> {
    return this.serialize(async () => {
      if (!isKnownWork(bookId)) return this.rejected("unknown-work");
      if (!Number.isSafeInteger(completedChapterNumber) || completedChapterNumber < 1) {
        return this.rejected("invalid-cursor");
      }
      const manifestResult = getHoidReadingManifest(bookId);
      if (manifestResult.status !== "ready") return this.rejected("unsupported-position");
      const manifest = manifestResult.manifest;
      const completedUnit = manifest.units.find(unit => unit.chapterNumber === completedChapterNumber);
      if (!completedUnit) return this.rejected("invalid-cursor");

      const nextUnit = manifest.units.find(unit => unit.chapterNumber === completedChapterNumber + 1);
      if (!nextUnit) {
        if (
          manifest.coverage === "verified-numeric-chapters" &&
          manifest.units[manifest.units.length - 1]?.chapterNumber === completedChapterNumber
        ) return this.rejected("completion-requires-explicit-confirmation");
        return this.rejected("unsupported-position");
      }

      const bound = await this.loadSnapshotBoundToProgress(expectedRevision, expectedFingerprint);
      if (bound.status !== "ready") return bound;
      const existing = bound.snapshot.positions.find(position => position.bookId === bookId);
      if (existing && "completed" in existing) return this.rejected("already-completed");

      const expectedOpenChapter = existing && "cursor" in existing
        ? existing.cursor.chapterNumber + 1
        : 1;
      if (completedChapterNumber !== expectedOpenChapter) {
        return this.rejected("non-sequential-reader-advance");
      }

      const nextCursor = createHoidReadingCursor(bookId, completedChapterNumber + 1);
      if (nextCursor.status !== "ready") return this.rejected("unsupported-position");
      return this.commitPosition({ bookId, cursor: nextCursor.cursor });
    });
  }

  /**
   * Explicitly complete a work after its final verified numbered chapter has
   * been read. Completion is never inferred from opening or scrolling.
   */
  completeAfterReadingIfCurrent(
    bookId: string,
    completedChapterNumber: number,
    expectedRevision: number,
    expectedFingerprint: string,
  ): Promise<HoidCursorCoordinatorResult> {
    return this.serialize(async () => {
      if (!isKnownWork(bookId)) return this.rejected("unknown-work");
      if (!Number.isSafeInteger(completedChapterNumber) || completedChapterNumber < 1) {
        return this.rejected("invalid-cursor");
      }
      const manifestResult = getHoidReadingManifest(bookId);
      if (
        manifestResult.status !== "ready" ||
        manifestResult.manifest.coverage !== "verified-numeric-chapters"
      ) return this.rejected("unsupported-position");
      const finalUnit = manifestResult.manifest.units[manifestResult.manifest.units.length - 1];
      if (!finalUnit || finalUnit.chapterNumber !== completedChapterNumber) {
        return this.rejected("non-sequential-reader-advance");
      }

      const bound = await this.loadSnapshotBoundToProgress(expectedRevision, expectedFingerprint);
      if (bound.status !== "ready") return bound;
      const existing = bound.snapshot.positions.find(position => position.bookId === bookId);
      if (existing && "completed" in existing) return this.unchanged();

      const expectedOpenChapter = existing && "cursor" in existing
        ? existing.cursor.chapterNumber + 1
        : 1;
      if (completedChapterNumber !== expectedOpenChapter) {
        return this.rejected("non-sequential-reader-advance");
      }

      return this.commitPosition({ bookId, completed: true });
    });
  }

  /** Completion is a separate explicit reader action, never inferred from a cursor. */
  complete(bookId: string): Promise<HoidCursorCoordinatorResult> {
    return this.serialize(async () => {
      if (!isKnownWork(bookId)) return this.rejected("unknown-work");
      const loaded = await this.initialize();
      if (loaded.status !== "ready" || !this.snapshot) return loaded;

      const existing = this.snapshot.positions.find(position => position.bookId === bookId);
      if (existing && "completed" in existing) return this.unchanged();
      return this.commitPosition({ bookId, completed: true });
    });
  }

  /**
   * Reopen a completed work at its first verified unit.
   * The caller must obtain explicit user confirmation before invoking this.
   */
  reopenCompletedWork(
    bookId: string,
    confirmation: HoidReopenConfirmation,
  ): Promise<HoidCursorCoordinatorResult> {
    return this.serialize(async () => {
      if (canonicalConfirmation(confirmation, false) === null) {
        return this.rejected("reopen-requires-confirmation");
      }
      if (!isKnownWork(bookId)) return this.rejected("unknown-work");
      const loaded = await this.initialize();
      if (loaded.status !== "ready" || !this.snapshot) return loaded;

      const existing = this.snapshot.positions.find(position => position.bookId === bookId);
      if (!existing || !("completed" in existing)) return this.rejected("not-completed");

      const first = createHoidReadingCursor(bookId, 1);
      if (first.status !== "ready") return this.rejected("unsupported-position");
      return this.commitPosition({ bookId, cursor: first.cursor });
    });
  }

  /**
   * Apply a deliberate correction. Unlike advance(), this may move backwards,
   * but only with explicit confirmation. Reopening a completed work additionally
   * requires reopenCompleted: true.
   */
  correctCursor(
    bookId: string,
    cursorValue: unknown,
    confirmation: HoidCursorCorrectionConfirmation,
  ): Promise<HoidCursorCoordinatorResult> {
    return this.serialize(async () => {
      const acceptedConfirmation = canonicalConfirmation(confirmation, true);
      if (acceptedConfirmation === null) {
        return this.rejected("regression-requires-confirmation");
      }
      if (!isKnownWork(bookId)) return this.rejected("unknown-work");
      const validated = validateHoidReadingCursor(cursorValue);
      if (validated.status !== "valid" || validated.cursor.bookId !== bookId) {
        return this.rejected("invalid-cursor");
      }

      const loaded = await this.initialize();
      if (loaded.status !== "ready" || !this.snapshot) return loaded;
      const existing = this.snapshot.positions.find(position => position.bookId === bookId);

      if (existing && "completed" in existing && acceptedConfirmation.reopenCompleted !== true) {
        return this.rejected("reopen-requires-confirmation");
      }
      if (existing && "cursor" in existing &&
        existing.cursor.manifestId === validated.cursor.manifestId &&
        existing.cursor.unitId === validated.cursor.unitId) {
        return this.unchanged();
      }
      return this.commitPosition({ bookId, cursor: validated.cursor });
    });
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation, operation);
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }

  private acceptLoad(result: HoidCursorStoreLoadResult): HoidCursorCoordinatorResult {
    if (result.status === "unavailable") {
      this.snapshot = null;
      this.initialization = null;
      return Object.freeze({ status: "unavailable", reason: result.reason });
    }

    const validation = validateHoidCursorProgressSnapshot(result.snapshot);
    if (validation.status !== "valid") {
      this.snapshot = null;
      this.initialization = null;
      return Object.freeze({ status: "unavailable", reason: "corrupt-v2" });
    }

    this.snapshot = validation.snapshot;
    return Object.freeze({
      status: "ready",
      operation: result.migratedFromV1 ? "migrated" : "loaded",
      snapshot: validation.snapshot,
    });
  }

  private async commitPosition(position: PositionInput): Promise<HoidCursorCoordinatorResult> {
    if (!this.snapshot) return Object.freeze({ status: "unavailable", reason: "storage-error" });
    if (this.snapshot.revision >= MAX_REVISION) {
      return Object.freeze({ status: "unavailable", reason: "revision-exhausted" });
    }

    let timestamp: string;
    try {
      timestamp = this.now();
    } catch {
      return Object.freeze({ status: "unavailable", reason: "clock-error" });
    }
    if (!canonicalTimestamp(timestamp)) {
      return Object.freeze({ status: "unavailable", reason: "clock-error" });
    }

    const existing = this.snapshot.positions.find(item => item.bookId === position.bookId);
    const order = existing?.order ?? this.snapshot.positions.reduce(
      (maximum, item) => Math.max(maximum, item.order ?? -1),
      -1,
    ) + 1;
    if (!Number.isSafeInteger(order) || order < 0 || order > MAX_ORDER) {
      return this.rejected("invalid-update");
    }

    const positions: HoidCursorProgressPosition[] = [
      ...this.snapshot.positions.filter(item => item.bookId !== position.bookId),
      Object.freeze({ ...position, order }),
    ];
    const candidate = {
      schemaVersion: 2,
      revision: this.snapshot.revision + 1,
      positions,
      updatedAt: timestamp,
    };
    const validated = validateHoidCursorProgressSnapshot(candidate);
    if (validated.status !== "valid") return this.rejected("invalid-update");

    const expectedRevision = this.snapshot.revision;
    try {
      const written = await this.store.compareAndSwap(expectedRevision, validated.snapshot);
      if (written) {
        this.snapshot = validated.snapshot;
        // The store has durably accepted the compare-and-swap before listeners fire.
        this.notifyProgressChanged();
        return Object.freeze({
          status: "ready",
          operation: "updated",
          snapshot: validated.snapshot,
        });
      }
      return await this.refreshConflict();
    } catch {
      this.snapshot = null;
      this.initialization = null;
      return Object.freeze({ status: "unavailable", reason: "storage-error" });
    }
  }

  private async refreshConflict(): Promise<HoidCursorCoordinatorResult> {
    const previousSnapshot = this.snapshot;
    try {
      const loaded = await this.store.load();
      if (loaded.status === "unavailable") {
        this.snapshot = null;
        this.initialization = null;
        return Object.freeze({ status: "unavailable", reason: loaded.reason });
      }
      const validation = validateHoidCursorProgressSnapshot(loaded.snapshot);
      if (validation.status !== "valid") {
        this.snapshot = null;
        this.initialization = null;
        return Object.freeze({ status: "unavailable", reason: "corrupt-v2" });
      }
      this.snapshot = validation.snapshot;
      if (previousSnapshot && !this.sameProgressSnapshot(previousSnapshot, validation.snapshot)) {
        this.notifyProgressChanged();
      }
      return Object.freeze({ status: "conflict", snapshot: validation.snapshot });
    } catch {
      this.snapshot = null;
      this.initialization = null;
      return Object.freeze({ status: "unavailable", reason: "storage-error" });
    }
  }

  private unchanged(): HoidCursorCoordinatorResult {
    if (!this.snapshot) return Object.freeze({ status: "unavailable", reason: "storage-error" });
    return Object.freeze({ status: "ready", operation: "unchanged", snapshot: this.snapshot });
  }

  private rejected(
    reason: Extract<HoidCursorCoordinatorResult, { status: "rejected" }>["reason"],
  ): HoidCursorCoordinatorResult {
    return Object.freeze({ status: "rejected", reason });
  }
}

export function createHoidCursorProgressCoordinator(
  store: HoidCursorProgressStore,
  now?: () => string,
): HoidCursorProgressCoordinator {
  return new HoidCursorProgressCoordinator(store, now);
}
