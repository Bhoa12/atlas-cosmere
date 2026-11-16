import {
  HoidProgressLedger,
  type HoidProgressLedgerSnapshot,
  type HoidProgressResult,
  type HoidProgressStore,
} from "./progressLedger";

export type AtlasPersistedReadingProgress = Readonly<{
  chaptersByBook: Readonly<Record<string, number>>;
  completedByBook: Readonly<Record<string, boolean>>;
}>;

export type HoidProgressCoordinatorResult =
  | Readonly<{
      status: "ready";
      operation: "loaded" | "updated" | "unchanged";
      snapshot: HoidProgressLedgerSnapshot;
    }>
  | Readonly<{ status: "conflict"; snapshot: HoidProgressLedgerSnapshot }>
  | Readonly<{
      status: "rejected";
      reason: Extract<HoidProgressResult, { status: "rejected" }>["reason"];
    }>
  | Readonly<{
      status: "unavailable";
      reason: "corrupt-ledger" | "storage-error";
    }>;

export type HoidProgressChapterOptions = Readonly<{
  /** Must be set by an explicit user action that corrects an earlier cursor. */
  allowRegression?: true;
  /** Must be set by an explicit user action that reopens a completed work. */
  reopenCompleted?: true;
}>;

/**
 * Converts a validated ledger snapshot into Atlas-compatible maps.
 * Null-prototype dictionaries prevent special work IDs from changing
 * authorization state through Object.prototype.
 */
export function atlasProgressFromSnapshot(
  snapshot: HoidProgressLedgerSnapshot,
): AtlasPersistedReadingProgress {
  const chapters = Object.create(null) as Record<string, number>;
  const completed = Object.create(null) as Record<string, boolean>;

  for (const position of snapshot.positions) {
    if (position.completed === true) completed[position.bookId] = true;
    else if (typeof position.chapter === "number") chapters[position.bookId] = position.chapter;
  }

  return Object.freeze({
    chaptersByBook: Object.freeze(chapters),
    completedByBook: Object.freeze(completed),
  });
}

/**
 * Serializes user progress writes before they reach the optimistic ledger.
 * A failed read or write never falls back to an in-memory authorization state.
 */
export class HoidProgressCoordinator {
  private readonly ledger: HoidProgressLedger;
  private snapshot: HoidProgressLedgerSnapshot | null = null;
  private initialization: Promise<HoidProgressCoordinatorResult> | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    store: HoidProgressStore,
    now?: () => string,
  ) {
    this.ledger = new HoidProgressLedger(store, now);
  }

  getSnapshot(): HoidProgressLedgerSnapshot | null {
    return this.snapshot;
  }

  initialize(): Promise<HoidProgressCoordinatorResult> {
    if (this.snapshot) {
      return Promise.resolve(Object.freeze({
        status: "ready" as const,
        operation: "loaded" as const,
        snapshot: this.snapshot,
      }));
    }
    if (this.initialization) return this.initialization;

    const pending = this.ledger.read().then(result => {
      if (result.status === "ready") {
        this.snapshot = result.snapshot;
        return Object.freeze({
          status: "ready" as const,
          operation: "loaded" as const,
          snapshot: result.snapshot,
        });
      }
      this.snapshot = null;
      this.initialization = null;
      return Object.freeze({
        status: "unavailable" as const,
        reason: result.reason,
      });
    }).catch(() => {
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

  setChapter(
    bookId: string,
    chapter: number,
    options: HoidProgressChapterOptions = {},
  ): Promise<HoidProgressCoordinatorResult> {
    return this.serialize(async () => {
      const loaded = await this.initialize();
      if (loaded.status !== "ready" || !this.snapshot) return loaded;

      const existing = this.snapshot.positions.find(position => position.bookId === bookId);
      return this.applyUpdate({
        expectedRevision: this.snapshot.revision,
        bookId,
        chapter,
        ...(existing?.chapter !== undefined && chapter < existing.chapter && options.allowRegression === true
          ? { allowRegression: true }
          : {}),
        ...(existing?.completed === true && options.reopenCompleted === true
          ? { reopenCompleted: true, allowRegression: true }
          : {}),
      });
    });
  }

  setCompleted(
    bookId: string,
    completed: boolean,
  ): Promise<HoidProgressCoordinatorResult> {
    return this.serialize(async () => {
      const loaded = await this.initialize();
      if (loaded.status !== "ready" || !this.snapshot) return loaded;

      const existing = this.snapshot.positions.find(position => position.bookId === bookId);
      if (!completed) {
        if (existing?.completed !== true) {
          return Object.freeze({
            status: "ready" as const,
            operation: "unchanged" as const,
            snapshot: this.snapshot,
          });
        }

        // Reopening is an explicit UI action. The ledger still validates that
        // chapter 1 is supported by the inspected edition before persisting it.
        return this.applyUpdate({
          expectedRevision: this.snapshot.revision,
          bookId,
          chapter: 1,
          allowRegression: true,
          reopenCompleted: true,
        });
      }

      return this.applyUpdate({
        expectedRevision: this.snapshot.revision,
        bookId,
        complete: true,
        confirmCompletion: true,
      });
    });
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation, operation);
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }

  private async applyUpdate(input: Record<string, unknown>): Promise<HoidProgressCoordinatorResult> {
    const result = await this.ledger.update(input);

    if (result.status === "updated" || result.status === "unchanged") {
      this.snapshot = result.snapshot;
      return Object.freeze({
        status: "ready",
        operation: result.status,
        snapshot: result.snapshot,
      });
    }

    if (result.status === "conflict") {
      const latest = await this.ledger.read();
      if (latest.status !== "ready") {
        this.snapshot = null;
        this.initialization = null;
        return Object.freeze({ status: "unavailable", reason: latest.reason });
      }
      this.snapshot = latest.snapshot;
      return Object.freeze({ status: "conflict", snapshot: latest.snapshot });
    }

    if (result.status === "rejected") {
      return Object.freeze({ status: "rejected", reason: result.reason });
    }

    return Object.freeze({ status: "unavailable", reason: "storage-error" });
  }
}
