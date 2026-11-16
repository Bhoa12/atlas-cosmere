export interface PlanEntry {
  readonly bookId: string;
  readonly title: string;
  readonly order: number;
}

export interface PlanProgress {
  readonly bookId: string;
  readonly chapter: number;
}

export type ReadingPlanResult =
  | {
      readonly kind: "recommendation";
      readonly bookId: string;
      readonly title: string;
      readonly order: number;
      readonly reasonCode: "next-uncompleted-entry-in-explicit-plan";
    }
  | {
      readonly kind: "abstain";
      readonly reason:
        | "invalid-plan"
        | "invalid-progress"
        | "current-book-not-in-plan"
        | "no-next-entry";
    };

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_PLAN_ENTRIES = 100;
const MAX_CATALOG_IDS = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function isProgress(value: unknown): value is PlanProgress {
  return isRecord(value) &&
    isId(value.bookId) &&
    Number.isSafeInteger(value.chapter) &&
    (value.chapter as number) >= 1;
}

function readCatalog(value: unknown): Set<string> | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CATALOG_IDS) {
    return null;
  }
  const ids = new Set<string>();
  for (const item of value) {
    if (!isId(item) || ids.has(item)) return null;
    ids.add(item);
  }
  return ids;
}

function readPlan(value: unknown, catalog: ReadonlySet<string>): PlanEntry[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PLAN_ENTRIES) {
    return null;
  }

  const bookIds = new Set<string>();
  const orders = new Set<number>();
  const entries: PlanEntry[] = [];

  for (const item of value) {
    if (!isRecord(item) ||
        !isId(item.bookId) ||
        !catalog.has(item.bookId) ||
        typeof item.title !== "string" ||
        item.title.trim().length === 0 ||
        item.title.length > 120 ||
        !Number.isSafeInteger(item.order) ||
        (item.order as number) < 1 ||
        bookIds.has(item.bookId) ||
        orders.has(item.order as number)) {
      return null;
    }

    bookIds.add(item.bookId);
    orders.add(item.order as number);
    entries.push({
      bookId: item.bookId,
      title: item.title.trim(),
      order: item.order as number,
    });
  }

  return entries.sort((a, b) => a.order - b.order);
}

function readCompleted(value: unknown, catalog: ReadonlySet<string>): Set<string> | null {
  if (!Array.isArray(value) || value.length > MAX_CATALOG_IDS) return null;
  const completed = new Set<string>();
  for (const item of value) {
    if (!isId(item) || !catalog.has(item) || completed.has(item)) return null;
    completed.add(item);
  }
  return completed;
}

/**
 * Recommends only the next unfinished entry in a plan explicitly supplied
 * by the reader or application. It never infers a universal Cosmere order.
 */
export function recommendNextInPlan(
  plan: unknown,
  progress: unknown,
  completedBookIds: unknown,
  catalogBookIds: unknown,
): ReadingPlanResult {
  if (!isProgress(progress)) {
    return { kind: "abstain", reason: "invalid-progress" };
  }

  const catalog = readCatalog(catalogBookIds);
  if (!catalog) return { kind: "abstain", reason: "invalid-plan" };

  const entries = readPlan(plan, catalog);
  const completed = readCompleted(completedBookIds, catalog);
  if (!entries || !completed) {
    return { kind: "abstain", reason: "invalid-plan" };
  }

  const current = entries.find((entry) => entry.bookId === progress.bookId);
  if (!current) {
    return { kind: "abstain", reason: "current-book-not-in-plan" };
  }

  const next = entries.find((entry) =>
    entry.order > current.order && !completed.has(entry.bookId),
  );
  if (!next) return { kind: "abstain", reason: "no-next-entry" };

  return {
    kind: "recommendation",
    bookId: next.bookId,
    title: next.title,
    order: next.order,
    reasonCode: "next-uncompleted-entry-in-explicit-plan",
  };
}
