export type ProgressStatus = "reading" | "paused" | "completed";

export interface ProgressCatalogBook {
  readonly bookId: string;
  readonly chapterCount?: number;
}

export interface BookProgress {
  readonly bookId: string;
  readonly chapter: number;
  readonly status: ProgressStatus;
  readonly revision: number;
}

export interface ProgressLedger {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly entries: readonly BookProgress[];
}

export type ProgressCommand =
  | {
      readonly type: "set-position";
      readonly bookId: string;
      readonly chapter: number;
      readonly expectedRevision: number;
      readonly confirmedCorrection?: true;
    }
  | {
      readonly type: "set-status";
      readonly bookId: string;
      readonly status: ProgressStatus;
      readonly expectedRevision: number;
      readonly confirmed?: true;
    };

export type ProgressUpdateResult =
  | {
      readonly kind: "updated";
      readonly ledger: ProgressLedger;
      readonly expectedRevision: number;
    }
  | {
      readonly kind: "unchanged";
      readonly ledger: ProgressLedger;
    }
  | {
      readonly kind: "abstain";
      readonly reason:
        | "invalid-catalog"
        | "invalid-ledger"
        | "invalid-command"
        | "unknown-book"
        | "stale-revision"
        | "position-regression"
        | "reopen-unconfirmed"
        | "completion-unconfirmed"
        | "completion-before-final-chapter"
        | "chapter-out-of-range"
        | "no-existing-progress"
        | "progress-limit";
    };

export interface ProgressStore {
  read(): Promise<unknown>;
  /**
   * Atomically writes next only if the persisted ledger still has
   * expectedRevision. Implementations must not perform a blind overwrite.
   */
  compareAndSwap(expectedRevision: number, next: ProgressLedger): Promise<boolean>;
}

export type PersistProgressResult =
  | Exclude<ProgressUpdateResult, { readonly kind: "updated" }>
  | {
      readonly kind: "updated";
      readonly ledger: ProgressLedger;
      readonly expectedRevision: number;
    }
  | {
      readonly kind: "abstain";
      readonly reason: "concurrent-update" | "storage-failure";
    };

export type SelectedBookProgress =
  | {
      readonly kind: "progress";
      readonly progress: { readonly bookId: string; readonly chapter: number };
      readonly status: ProgressStatus;
      readonly revision: number;
    }
  | {
      readonly kind: "abstain";
      readonly reason: "invalid-catalog" | "invalid-ledger" | "unknown-book" | "no-progress";
    };

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_CATALOG_BOOKS = 500;
const MAX_PROGRESS_ENTRIES = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function freezeLedger(revision: number, entries: readonly BookProgress[]): ProgressLedger {
  const frozenEntries = entries
    .map((entry) => Object.freeze({ ...entry }))
    .sort((a, b) => a.bookId.localeCompare(b.bookId));
  return Object.freeze({
    schemaVersion: 1 as const,
    revision,
    entries: Object.freeze(frozenEntries),
  });
}

export function emptyProgressLedger(): ProgressLedger {
  return freezeLedger(0, []);
}

function readCatalog(value: unknown): Map<string, ProgressCatalogBook> | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CATALOG_BOOKS) {
    return null;
  }

  const catalog = new Map<string, ProgressCatalogBook>();
  for (const item of value) {
    if (!isRecord(item) ||
        !(hasExactKeys(item, ["bookId"]) || hasExactKeys(item, ["bookId", "chapterCount"])) ||
        !isId(item.bookId) ||
        (item.chapterCount !== undefined && !isPositiveInteger(item.chapterCount)) ||
        catalog.has(item.bookId)) {
      return null;
    }
    catalog.set(item.bookId, Object.freeze({
      bookId: item.bookId,
      ...(item.chapterCount === undefined ? {} : { chapterCount: item.chapterCount as number }),
    }));
  }
  return catalog;
}

function readLedger(
  value: unknown,
  catalog: ReadonlyMap<string, ProgressCatalogBook>,
): ProgressLedger | null {
  if (value === null) return emptyProgressLedger();
  if (!isRecord(value) ||
      !hasExactKeys(value, ["schemaVersion", "revision", "entries"]) ||
      value.schemaVersion !== 1 ||
      !isNonNegativeInteger(value.revision) ||
      !Array.isArray(value.entries) ||
      value.entries.length > MAX_PROGRESS_ENTRIES ||
      (value.revision === 0 && value.entries.length !== 0)) {
    return null;
  }

  const seen = new Set<string>();
  const entries: BookProgress[] = [];
  for (const item of value.entries) {
    if (!isRecord(item) ||
        !hasExactKeys(item, ["bookId", "chapter", "status", "revision"]) ||
        !isId(item.bookId) ||
        !isPositiveInteger(item.chapter) ||
        (item.status !== "reading" && item.status !== "paused" && item.status !== "completed") ||
        !isPositiveInteger(item.revision) ||
        item.revision > value.revision ||
        seen.has(item.bookId)) {
      return null;
    }

    const catalogBook = catalog.get(item.bookId);
    if (!catalogBook ||
        (catalogBook.chapterCount !== undefined && item.chapter > catalogBook.chapterCount)) {
      return null;
    }

    seen.add(item.bookId);
    entries.push({
      bookId: item.bookId,
      chapter: item.chapter,
      status: item.status,
      revision: item.revision,
    });
  }

  return freezeLedger(value.revision, entries);
}

/** Validates and returns a detached, immutable progress snapshot. */
export function parseProgressLedger(
  value: unknown,
  catalogInput: unknown,
): ProgressLedger | null {
  const catalog = readCatalog(catalogInput);
  return catalog ? readLedger(value, catalog) : null;
}

function readCommand(value: unknown): ProgressCommand | null {
  if (!isRecord(value) || !isId(value.bookId) || !isNonNegativeInteger(value.expectedRevision)) {
    return null;
  }

  if (value.type === "set-position") {
    const keys = value.confirmedCorrection === undefined
      ? ["type", "bookId", "chapter", "expectedRevision"]
      : ["type", "bookId", "chapter", "expectedRevision", "confirmedCorrection"];
    if (!hasExactKeys(value, keys) ||
        !isPositiveInteger(value.chapter) ||
        (value.confirmedCorrection !== undefined && value.confirmedCorrection !== true)) {
      return null;
    }
    return {
      type: "set-position",
      bookId: value.bookId,
      chapter: value.chapter,
      expectedRevision: value.expectedRevision,
      ...(value.confirmedCorrection === true ? { confirmedCorrection: true as const } : {}),
    };
  }

  if (value.type === "set-status") {
    const keys = value.confirmed === undefined
      ? ["type", "bookId", "status", "expectedRevision"]
      : ["type", "bookId", "status", "expectedRevision", "confirmed"];
    if (!hasExactKeys(value, keys) ||
        (value.status !== "reading" && value.status !== "paused" && value.status !== "completed") ||
        (value.confirmed !== undefined && value.confirmed !== true)) {
      return null;
    }
    return {
      type: "set-status",
      bookId: value.bookId,
      status: value.status,
      expectedRevision: value.expectedRevision,
      ...(value.confirmed === true ? { confirmed: true as const } : {}),
    };
  }

  return null;
}

/**
 * Pure, provider-independent reducer for a multi-book reader progress ledger.
 * Position never moves backwards unless the caller explicitly confirms a correction.
 */
export function applyProgressCommand(
  ledgerInput: unknown,
  commandInput: unknown,
  catalogInput: unknown,
): ProgressUpdateResult {
  const catalog = readCatalog(catalogInput);
  if (!catalog) return { kind: "abstain", reason: "invalid-catalog" };

  const ledger = readLedger(ledgerInput, catalog);
  if (!ledger) return { kind: "abstain", reason: "invalid-ledger" };

  const command = readCommand(commandInput);
  if (!command) return { kind: "abstain", reason: "invalid-command" };

  if (!catalog.has(command.bookId)) {
    return { kind: "abstain", reason: "unknown-book" };
  }
  if (command.expectedRevision !== ledger.revision) {
    return { kind: "abstain", reason: "stale-revision" };
  }
  if (!Number.isSafeInteger(ledger.revision + 1)) {
    return { kind: "abstain", reason: "progress-limit" };
  }

  const current = ledger.entries.find((entry) => entry.bookId === command.bookId);
  const catalogBook = catalog.get(command.bookId)!;
  const nextRevision = ledger.revision + 1;

  if (command.type === "set-position") {
    if (catalogBook.chapterCount !== undefined && command.chapter > catalogBook.chapterCount) {
      return { kind: "abstain", reason: "chapter-out-of-range" };
    }
    if (!current && ledger.entries.length >= MAX_PROGRESS_ENTRIES) {
      return { kind: "abstain", reason: "progress-limit" };
    }

    if (current?.status === "completed" && command.confirmedCorrection !== true) {
      return { kind: "abstain", reason: "reopen-unconfirmed" };
    }
    if (current && command.chapter < current.chapter && command.confirmedCorrection !== true) {
      return { kind: "abstain", reason: "position-regression" };
    }
    if (current &&
        command.chapter === current.chapter &&
        current.status === "reading") {
      return { kind: "unchanged", ledger };
    }

    const nextEntry: BookProgress = {
      bookId: command.bookId,
      chapter: command.chapter,
      status: "reading",
      revision: nextRevision,
    };
    const entries = current
      ? ledger.entries.map((entry) => entry.bookId === command.bookId ? nextEntry : entry)
      : [...ledger.entries, nextEntry];

    return {
      kind: "updated",
      ledger: freezeLedger(nextRevision, entries),
      expectedRevision: ledger.revision,
    };
  }

  if (!current) return { kind: "abstain", reason: "no-existing-progress" };

  if (command.status === "completed") {
    if (command.confirmed !== true) {
      return { kind: "abstain", reason: "completion-unconfirmed" };
    }
    if (catalogBook.chapterCount !== undefined && current.chapter < catalogBook.chapterCount) {
      return { kind: "abstain", reason: "completion-before-final-chapter" };
    }
  } else if (current.status === "completed" && command.confirmed !== true) {
    return { kind: "abstain", reason: "reopen-unconfirmed" };
  }

  if (current.status === command.status) return { kind: "unchanged", ledger };

  const nextEntry: BookProgress = {
    ...current,
    status: command.status,
    revision: nextRevision,
  };
  const entries = ledger.entries.map((entry) => entry.bookId === command.bookId ? nextEntry : entry);
  return {
    kind: "updated",
    ledger: freezeLedger(nextRevision, entries),
    expectedRevision: ledger.revision,
  };
}

/** Selects the exact per-book progress record used by spoiler filters. */
export function selectBookProgress(
  ledgerInput: unknown,
  bookId: unknown,
  catalogInput: unknown,
): SelectedBookProgress {
  const catalog = readCatalog(catalogInput);
  if (!catalog) return { kind: "abstain", reason: "invalid-catalog" };
  if (!isId(bookId) || !catalog.has(bookId)) {
    return { kind: "abstain", reason: "unknown-book" };
  }

  const ledger = readLedger(ledgerInput, catalog);
  if (!ledger) return { kind: "abstain", reason: "invalid-ledger" };

  const entry = ledger.entries.find((candidate) => candidate.bookId === bookId);
  if (!entry) return { kind: "abstain", reason: "no-progress" };

  return {
    kind: "progress",
    progress: Object.freeze({ bookId: entry.bookId, chapter: entry.chapter }),
    status: entry.status,
    revision: entry.revision,
  };
}

/** Returns only explicitly completed IDs for the existing metadata-only reading planner. */
export function completedBookIds(ledger: ProgressLedger): readonly string[] {
  return Object.freeze(
    ledger.entries
      .filter((entry) => entry.status === "completed")
      .map((entry) => entry.bookId),
  );
}

/**
 * Loads, reduces, and atomically persists one command. The storage adapter
 * must implement compare-and-swap against the global ledger revision.
 */
export async function persistProgressCommand(
  store: ProgressStore,
  command: unknown,
  catalog: unknown,
): Promise<PersistProgressResult> {
  if (!store || typeof store.read !== "function" || typeof store.compareAndSwap !== "function") {
    return { kind: "abstain", reason: "storage-failure" };
  }

  try {
    const current = await store.read();
    const result = applyProgressCommand(current, command, catalog);
    if (result.kind !== "updated") return result;

    const saved = await store.compareAndSwap(result.expectedRevision, result.ledger);
    if (!saved) return { kind: "abstain", reason: "concurrent-update" };
    return result;
  } catch {
    return { kind: "abstain", reason: "storage-failure" };
  }
}
