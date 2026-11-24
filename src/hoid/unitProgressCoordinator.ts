import {
  HoidUnitProgressLedger,
  type HoidUnitProgressResult,
  type HoidUnitProgressSnapshot,
  type HoidUnitProgressStore,
} from "./unitProgressLedger";
import type { HoidUnitProgressCursor } from "./unitProgressCursor";

export type HoidUnitProgressCoordinatorResult =
  | Readonly<{
      status: "ready";
      operation: "loaded" | "refreshed" | "updated" | "unchanged";
      snapshot: HoidUnitProgressSnapshot;
    }>
  | Readonly<{
      status: "conflict";
      expectedRevision: number;
      snapshot?: HoidUnitProgressSnapshot;
    }>
  | Readonly<{
      status: "rejected";
      reason: Extract<HoidUnitProgressResult, { status: "rejected" }>["reason"];
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | Extract<HoidUnitProgressResult, { status: "unavailable" }>["reason"]
        | "disposed";
    }>;

export type HoidUnitProgressChangeListener = () => void;

/**
 * Coordinates exact-unit v3 progress without depending on SQLite, Expo,
 * React Native, a model SDK, or a network provider.
 *
 * Every mutation refreshes the durable ledger first and requires the revision
 * displayed by the caller. The ledger/store CAS remains the cross-instance
 * authority; this queue only serializes operations within this coordinator.
 */
export class HoidUnitProgressCoordinator {
  private readonly ledger: HoidUnitProgressLedger;
  private snapshot: HoidUnitProgressSnapshot | null = null;
  private queue: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<HoidUnitProgressChangeListener>();
  private disposed = false;

  constructor(
    store: HoidUnitProgressStore,
    now?: () => string,
  ) {
    this.ledger = new HoidUnitProgressLedger(store, now);
  }

  /** The last validated local snapshot; call refresh before freshness-sensitive work. */
  getSnapshot(): HoidUnitProgressSnapshot | null {
    return this.snapshot;
  }

  /**
   * Subscribe to committed progress changes.
   *
   * The event intentionally has no payload. Listeners must reload and validate
   * the snapshot instead of trusting an event-carried authorization boundary.
   * Listener exceptions never affect a durable write.
   */
  subscribe(listener: HoidUnitProgressChangeListener): () => void {
    if (this.disposed || typeof listener !== "function") return () => {};
    this.listeners.add(listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.listeners.delete(listener);
    };
  }

  /** Load once when no local snapshot exists. This is not a freshness check. */
  initialize(): Promise<HoidUnitProgressCoordinatorResult> {
    return this.serialize(async () => {
      if (this.disposed) return this.unavailable("disposed");
      if (this.snapshot) {
        return Object.freeze({
          status: "ready" as const,
          operation: "loaded" as const,
          snapshot: this.snapshot,
        });
      }
      return this.loadLatest(false);
    });
  }

  /**
   * Re-read durable storage. Conversation and recommendation hosts should call
   * this before dispatch and again before presentation. Another coordinator's
   * write is detected here; SQLite does not provide a spontaneous cross-process
   * notification through this provider-neutral contract.
   */
  refresh(): Promise<HoidUnitProgressCoordinatorResult> {
    return this.serialize(async () => {
      if (this.disposed) return this.unavailable("disposed");
      return this.loadLatest(true);
    });
  }

  setInitialCursor(
    bookId: string,
    cursor: HoidUnitProgressCursor | unknown,
    expectedRevision: number,
    confirmation: unknown,
  ): Promise<HoidUnitProgressCoordinatorResult> {
    return this.mutate(expectedRevision, revision =>
      this.ledger.setInitialCursor(bookId, cursor, revision, confirmation),
    );
  }

  advance(
    bookId: string,
    cursor: HoidUnitProgressCursor | unknown,
    expectedRevision: number,
    confirmation: unknown,
  ): Promise<HoidUnitProgressCoordinatorResult> {
    return this.mutate(expectedRevision, revision =>
      this.ledger.advance(bookId, cursor, revision, confirmation),
    );
  }

  correctCursor(
    bookId: string,
    cursor: HoidUnitProgressCursor | unknown,
    expectedRevision: number,
    confirmation: unknown,
  ): Promise<HoidUnitProgressCoordinatorResult> {
    return this.mutate(expectedRevision, revision =>
      this.ledger.correctCursor(bookId, cursor, revision, confirmation),
    );
  }

  complete(
    bookId: string,
    expectedRevision: number,
    confirmation: unknown,
  ): Promise<HoidUnitProgressCoordinatorResult> {
    return this.mutate(expectedRevision, revision =>
      this.ledger.complete(bookId, revision, confirmation),
    );
  }

  /**
   * Dispose this coordinator without closing the caller-owned store.
   * Existing listeners are notified once so in-flight consumers can invalidate
   * their work; all later operations fail closed.
   */
  dispose(): void {
    if (this.disposed) return;
    this.notifyProgressChanged();
    this.disposed = true;
    this.snapshot = null;
    this.listeners.clear();
  }

  private mutate(
    expectedRevision: number,
    operation: (revision: number) => Promise<HoidUnitProgressResult>,
  ): Promise<HoidUnitProgressCoordinatorResult> {
    return this.serialize(async () => {
      if (this.disposed) return this.unavailable("disposed");

      // Always reload before a write. A stale in-memory coordinator must not
      // overwrite a newer v3 snapshot merely because its local queue is idle.
      const loaded = await this.loadLatest(true);
      if (loaded.status !== "ready") return loaded;
      if (loaded.snapshot.revision !== expectedRevision) {
        return Object.freeze({
          status: "conflict" as const,
          expectedRevision,
          snapshot: loaded.snapshot,
        });
      }

      let result: HoidUnitProgressResult;
      try {
        result = await operation(expectedRevision);
      } catch {
        const refreshed = await this.loadLatest(true);
        return refreshed.status === "unavailable"
          ? refreshed
          : this.unavailable("storage-error");
      }

      if (result.status === "ready") {
        this.acceptSnapshot(result.snapshot);
        return Object.freeze({
          status: "ready" as const,
          operation: result.operation,
          snapshot: result.snapshot,
        });
      }

      if (result.status === "conflict") {
        const refreshed = await this.loadLatest(true);
        if (refreshed.status !== "ready") return refreshed;
        return Object.freeze({
          status: "conflict" as const,
          expectedRevision: result.expectedRevision,
          snapshot: refreshed.snapshot,
        });
      }

      if (result.status === "unavailable") {
        const refreshed = await this.loadLatest(true);
        return refreshed.status === "unavailable"
          ? refreshed
          : Object.freeze({ status: "unavailable" as const, reason: result.reason });
      }

      return Object.freeze({ status: "rejected" as const, reason: result.reason });
    });
  }

  private async loadLatest(
    force: boolean,
  ): Promise<HoidUnitProgressCoordinatorResult> {
    if (this.disposed) return this.unavailable("disposed");
    if (!force && this.snapshot) {
      return Object.freeze({
        status: "ready" as const,
        operation: "loaded" as const,
        snapshot: this.snapshot,
      });
    }

    const previous = this.snapshot;
    const loaded = await this.ledger.read();
    if (this.disposed) return this.unavailable("disposed");

    if (loaded.status !== "ready") {
      this.snapshot = null;
      if (previous) this.notifyProgressChanged();
      return Object.freeze({
        status: "unavailable" as const,
        reason: loaded.reason,
      });
    }

    this.snapshot = loaded.snapshot;
    if (previous && !this.sameSnapshot(previous, loaded.snapshot)) {
      this.notifyProgressChanged();
    }
    return Object.freeze({
      status: "ready" as const,
      operation: force ? "refreshed" as const : "loaded" as const,
      snapshot: loaded.snapshot,
    });
  }

  private acceptSnapshot(next: HoidUnitProgressSnapshot): void {
    const previous = this.snapshot;
    this.snapshot = next;
    if (previous && !this.sameSnapshot(previous, next)) {
      this.notifyProgressChanged();
    }
  }

  private sameSnapshot(
    left: HoidUnitProgressSnapshot,
    right: HoidUnitProgressSnapshot,
  ): boolean {
    // Snapshots are canonicalized by the ledger. Keep the exact identity
    // comparison local; never place fingerprints or unit IDs in event payloads.
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private notifyProgressChanged(): void {
    if (this.disposed) return;
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
        // A UI or gateway listener cannot roll back an already committed write.
      }
    }
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation, operation);
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }

  private unavailable(
    reason: Extract<HoidUnitProgressCoordinatorResult, { status: "unavailable" }>["reason"],
  ): HoidUnitProgressCoordinatorResult {
    return Object.freeze({ status: "unavailable", reason });
  }
}
