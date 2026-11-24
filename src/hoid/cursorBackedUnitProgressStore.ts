import {
  validateHoidCursorProgressSnapshot,
} from "./cursorProgressLedger";
import type {
  HoidCursorProgressStore,
  HoidCursorStoreLoadResult,
} from "./cursorSqliteProgressStore";
import { getHoidReadingManifest } from "./readingManifest";
import { createHoidUnitProgressCursor } from "./unitProgressCursor";
import {
  validateHoidUnitProgressSnapshot,
  type HoidUnitProgressSnapshot,
  type HoidUnitProgressStore,
} from "./unitProgressLedger";
import { HoidUnitProgressCoordinator } from "./unitProgressCoordinator";

export interface HoidCursorProgressInvalidationSource {
  subscribe(listener: () => void): () => void;
}

export interface HoidTrustedProgressInvalidationPort {
  subscribe(listener: () => void): () => void;
}

export type HoidCursorToUnitProgressProjection =
  | Readonly<{
      status: "ready";
      snapshot: HoidUnitProgressSnapshot;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-cursor-snapshot"
        | "manifest-mismatch"
        | "unit-cursor-unavailable"
        | "invalid-unit-snapshot";
      bookId?: string;
    }>;

type DataMethod = (...args: unknown[]) => unknown;

function captureDataMethod(value: unknown, name: string): DataMethod | null {
  try {
    if (value === null || (typeof value !== "object" && typeof value !== "function")) return null;
    let current: object | null = value as object;
    while (current !== null) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as DataMethod).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Projects the application's durable v2 reader cursor into the exact-unit v3
 * shape consumed by the signed conversation runtime.
 *
 * The source v2 snapshot is validated first. Every partial position must then
 * resolve to the same edition manifest, chapter label, unit ID and ordinal.
 * No chapter number is guessed and no position is silently dropped.
 */
export function projectHoidCursorProgressToUnitProgress(
  value: unknown,
): HoidCursorToUnitProgressProjection {
  const validated = validateHoidCursorProgressSnapshot(value);
  if (validated.status !== "valid") {
    return Object.freeze({ status: "unavailable", reason: "invalid-cursor-snapshot" });
  }

  const positions: HoidUnitProgressSnapshot["positions"][number][] = [];
  for (const position of validated.snapshot.positions) {
    if ("completed" in position && position.completed === true) {
      positions.push(Object.freeze({ bookId: position.bookId, completed: true }));
      continue;
    }

    const cursor = position.cursor;
    const manifest = getHoidReadingManifest(position.bookId);
    if (
      manifest.status !== "ready" ||
      manifest.manifest.manifestId !== cursor.manifestId
    ) {
      return Object.freeze({
        status: "unavailable",
        reason: "manifest-mismatch",
        bookId: position.bookId,
      });
    }

    const created = createHoidUnitProgressCursor(position.bookId, {
      chapterNumber: cursor.chapterNumber,
      unitId: cursor.unitId,
    });
    if (
      created.status !== "ready" ||
      created.cursor.reference.bookId !== position.bookId ||
      created.cursor.reference.unitId !== cursor.unitId ||
      created.cursor.reference.ordinal !== cursor.ordinal ||
      created.cursor.reference.chapterNumber !== cursor.chapterNumber
    ) {
      return Object.freeze({
        status: "unavailable",
        reason: "unit-cursor-unavailable",
        bookId: position.bookId,
      });
    }

    positions.push(Object.freeze({
      bookId: position.bookId,
      cursor: created.cursor,
    }));
  }

  // Preserve the durable revision and timestamp so freshness checks observe
  // every reader commit. UI-only ordering metadata is intentionally omitted.
  const candidate = Object.freeze({
    schemaVersion: 3 as const,
    revision: validated.snapshot.revision,
    positions: Object.freeze(positions),
    updatedAt: validated.snapshot.updatedAt,
  });
  const unitValidation = validateHoidUnitProgressSnapshot(candidate);
  if (unitValidation.status !== "valid") {
    return Object.freeze({ status: "unavailable", reason: "invalid-unit-snapshot" });
  }

  return Object.freeze({ status: "ready", snapshot: unitValidation.snapshot });
}

/**
 * Read-only adapter over the exact SQLite cursor ledger owned by Atlas.
 *
 * The signed answer runtime only reads progress. Mutations continue to flow
 * through HoidCursorProgressCoordinator; this adapter deliberately rejects
 * compare-and-swap writes so two independent ledgers cannot diverge.
 */
export class HoidCursorBackedUnitProgressStore implements HoidUnitProgressStore {
  private readonly loadCursorSnapshot: () => Promise<HoidCursorStoreLoadResult>;

  constructor(cursorStore: HoidCursorProgressStore) {
    const load = captureDataMethod(cursorStore, "load");
    if (!load) throw new TypeError("Cursor progress store is unavailable");
    this.loadCursorSnapshot = () => Promise.resolve(
      load() as Promise<HoidCursorStoreLoadResult>,
    );
  }

  async read(): Promise<unknown> {
    let loaded: HoidCursorStoreLoadResult;
    try {
      loaded = await this.loadCursorSnapshot();
    } catch {
      return null;
    }
    if (loaded.status !== "ready") return null;

    const projected = projectHoidCursorProgressToUnitProgress(loaded.snapshot);
    return projected.status === "ready" ? projected.snapshot : null;
  }

  async compareAndSwap(
    _expectedRevision: number,
    _next: HoidUnitProgressSnapshot,
  ): Promise<boolean> {
    return false;
  }
}

export type HoidCursorBackedUnitProgressRuntime = Readonly<{
  coordinator: HoidUnitProgressCoordinator;
  progressInvalidation: HoidTrustedProgressInvalidationPort;
}>;

/**
 * Creates the read-only exact-unit coordinator used by the trusted host.
 *
 * The invalidation source must be the same cursor coordinator that receives
 * Atlas reader commits. Its subscribe method is captured as a data method and
 * delegated without forwarding any progress payload.
 */
export function createHoidCursorBackedUnitProgressRuntime(
  cursorStore: HoidCursorProgressStore,
  invalidationSource: HoidCursorProgressInvalidationSource,
  now?: () => string,
): HoidCursorBackedUnitProgressRuntime | null {
  const load = captureDataMethod(cursorStore, "load");
  const subscribe = captureDataMethod(invalidationSource, "subscribe");
  if (!load || !subscribe) return null;

  const readOnlyStore: HoidUnitProgressStore = Object.freeze({
    read: async () => {
      let loaded: HoidCursorStoreLoadResult;
      try {
        loaded = await Promise.resolve(load() as Promise<HoidCursorStoreLoadResult>);
      } catch {
        return null;
      }
      if (loaded.status !== "ready") return null;
      const projected = projectHoidCursorProgressToUnitProgress(loaded.snapshot);
      return projected.status === "ready" ? projected.snapshot : null;
    },
    compareAndSwap: async () => false,
  });

  const progressInvalidation: HoidTrustedProgressInvalidationPort = Object.freeze({
    subscribe(listener: () => void): () => void {
      if (typeof listener !== "function") throw new TypeError("Invalid progress listener");
      const unsubscribe = subscribe(listener);
      if (typeof unsubscribe !== "function") {
        throw new TypeError("Cursor progress invalidation source is unavailable");
      }
      return unsubscribe as () => void;
    },
  });

  return Object.freeze({
    coordinator: new HoidUnitProgressCoordinator(readOnlyStore, now),
    progressInvalidation,
  });
}
