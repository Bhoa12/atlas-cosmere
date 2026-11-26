import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { sha256Hex } from "./sha256";

/**
 * Reader-owned ordering preferences. These values are local personalization,
 * not narrative authority: they can reorder or limit already-authorized
 * display items, but they cannot create a route, unlock a work or change
 * spoiler eligibility.
 */
export type HoidReaderRecommendationPreferences = Readonly<{
  schemaVersion: 1;
  revision: number;
  /** Ordered list: earlier works receive higher display priority. */
  priorityWorkIds: readonly string[];
  /** These works remain eligible but are placed after neutral items. */
  deprioritizedWorkIds: readonly string[];
  maxItems: 1 | 3 | 5;
}>;

export type HoidReaderRecommendationPreferencesValidation =
  | Readonly<{
      status: "valid";
      preferences: HoidReaderRecommendationPreferences;
      fingerprint: string;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-shape"
        | "invalid-revision"
        | "invalid-work"
        | "duplicate-work"
        | "conflicting-work-priority"
        | "invalid-limit";
    }>;

export type HoidPreferenceRankedRecommendationProjection =
  | Readonly<{
      status: "ready";
      items: readonly Readonly<{
        key: string;
        pathTitle: string;
        workId: string;
        workTitle: string;
        whyNow: string;
        selection: "manual-reader-selection-required";
        rationaleAuthority: "signed-editorial-catalogue";
      }>[];
      eligibleItemCount: number;
      displayedItemCount: number;
      preferenceRevision: number;
      preferenceFingerprint: string;
    }>
  | Readonly<{
      status: "withheld";
      reason: "invalid-projection" | "invalid-preferences" | "source-withheld";
    }>;

/**
 * A local persistence adapter may implement this contract with SQLite or
 * another app-owned store. compareAndSwap must be atomic and must never send
 * preferences to an AI provider or remote recommendation service.
 */
export type HoidReaderRecommendationPreferencesStorePort = Readonly<{
  read(): Promise<unknown>;
  compareAndSwap(
    expectedRevision: number,
    next: HoidReaderRecommendationPreferences,
  ): Promise<"saved" | "conflict" | "unavailable">;
}>;

const WORKS = new Map(HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work]));
const MAX_PREFERENCE_WORKS = HOID_SOURCE_BIBLIOGRAPHY.length;
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const ITEM_KEYS = Object.freeze([
  "key",
  "pathTitle",
  "workId",
  "workTitle",
  "whyNow",
  "selection",
  "rationaleAuthority",
]);

const DEFAULT_PREFERENCES: HoidReaderRecommendationPreferences = Object.freeze({
  schemaVersion: 1,
  revision: 0,
  priorityWorkIds: Object.freeze([]),
  deprioritizedWorkIds: Object.freeze([]),
  maxItems: 5,
});

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length ||
      ownKeys.some(key => typeof key !== "string" || !keys.includes(key))
    ) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
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

function denseWorkIds(value: unknown): readonly string[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length > MAX_PREFERENCE_WORKS ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string" ||
        !WORKS.has(descriptor.value) ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (
        typeof key !== "string" ||
        !/^(0|[1-9][0-9]*)$/u.test(key) ||
        Number(key) >= value.length
      ) return null;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function safeText(value: unknown, maximum: number): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/u.test(value);
}

function preferencesFingerprint(
  preferences: HoidReaderRecommendationPreferences,
): string {
  return sha256Hex(JSON.stringify([
    "hoid-reader-recommendation-preferences-v1",
    preferences.revision,
    preferences.priorityWorkIds,
    preferences.deprioritizedWorkIds,
    preferences.maxItems,
  ]));
}

export function getDefaultHoidReaderRecommendationPreferences():
  HoidReaderRecommendationPreferences {
  return DEFAULT_PREFERENCES;
}

export function validateHoidReaderRecommendationPreferences(
  value: unknown,
): HoidReaderRecommendationPreferencesValidation {
  const raw = exactRecord(value, [
    "schemaVersion",
    "revision",
    "priorityWorkIds",
    "deprioritizedWorkIds",
    "maxItems",
  ]);
  if (!raw || raw.schemaVersion !== 1) {
    return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  }
  if (
    typeof raw.revision !== "number" ||
    !Number.isSafeInteger(raw.revision) ||
    raw.revision < 0
  ) {
    return Object.freeze({ status: "invalid", reason: "invalid-revision" });
  }

  const priorityWorkIds = denseWorkIds(raw.priorityWorkIds);
  const deprioritizedWorkIds = denseWorkIds(raw.deprioritizedWorkIds);
  if (!priorityWorkIds || !deprioritizedWorkIds) {
    return Object.freeze({ status: "invalid", reason: "invalid-work" });
  }

  const priority = new Set(priorityWorkIds);
  const deprioritized = new Set(deprioritizedWorkIds);
  if (priority.size !== priorityWorkIds.length ||
      deprioritized.size !== deprioritizedWorkIds.length) {
    return Object.freeze({ status: "invalid", reason: "duplicate-work" });
  }
  if ([...priority].some(workId => deprioritized.has(workId))) {
    return Object.freeze({ status: "invalid", reason: "conflicting-work-priority" });
  }

  if (raw.maxItems !== 1 && raw.maxItems !== 3 && raw.maxItems !== 5) {
    return Object.freeze({ status: "invalid", reason: "invalid-limit" });
  }

  const preferences: HoidReaderRecommendationPreferences = Object.freeze({
    schemaVersion: 1,
    revision: raw.revision,
    priorityWorkIds,
    deprioritizedWorkIds,
    maxItems: raw.maxItems,
  });
  return Object.freeze({
    status: "valid",
    preferences,
    fingerprint: preferencesFingerprint(preferences),
  });
}

function canonicalDisplayItem(value: unknown) {
  const raw = exactRecord(value, ITEM_KEYS);
  if (!raw) return null;
  const work = typeof raw.workId === "string" ? WORKS.get(raw.workId) : undefined;
  if (
    typeof raw.key !== "string" ||
    !ID_PATTERN.test(raw.key) ||
    !safeText(raw.pathTitle, 120) ||
    !work ||
    raw.workTitle !== work.title ||
    !safeText(raw.whyNow, 600) ||
    raw.selection !== "manual-reader-selection-required" ||
    raw.rationaleAuthority !== "signed-editorial-catalogue"
  ) return null;
  return Object.freeze({
    key: raw.key,
    pathTitle: raw.pathTitle,
    workId: work.id,
    workTitle: work.title,
    whyNow: raw.whyNow,
    selection: "manual-reader-selection-required" as const,
    rationaleAuthority: "signed-editorial-catalogue" as const,
  });
}

function denseDisplayItems(value: unknown) {
  try {
    if (
      !Array.isArray(value) ||
      value.length < 1 ||
      value.length > 5 ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const items = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      const item = canonicalDisplayItem(descriptor.value);
      if (!item || seen.has(item.key)) return null;
      seen.add(item.key);
      items.push(item);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (
        typeof key !== "string" ||
        !/^(0|[1-9][0-9]*)$/u.test(key) ||
        Number(key) >= value.length
      ) return null;
    }
    return Object.freeze(items);
  } catch {
    return null;
  }
}

/**
 * Applies local reader preferences only after the signed display projection
 * has been produced. The function can reorder or truncate that projection;
 * it cannot add works, alter rationales, create navigation targets or change
 * the upstream spoiler decision.
 */
export function rankHoidCuratedPathRecommendationsForReader(
  projectionInput: unknown,
  preferencesInput: unknown = DEFAULT_PREFERENCES,
): HoidPreferenceRankedRecommendationProjection {
  const preferences = validateHoidReaderRecommendationPreferences(preferencesInput);
  if (preferences.status !== "valid") {
    return Object.freeze({ status: "withheld", reason: "invalid-preferences" });
  }

  const projection = exactRecord(projectionInput, ["status", "items"]);
  if (!projection || projection.status !== "ready") {
    const withheldProjection = exactRecord(projectionInput, ["status", "reason"]);
    return withheldProjection?.status === "withheld"
      ? Object.freeze({ status: "withheld", reason: "source-withheld" })
      : Object.freeze({ status: "withheld", reason: "invalid-projection" });
  }

  const items = denseDisplayItems(projection.items);
  if (!items) return Object.freeze({ status: "withheld", reason: "invalid-projection" });

  const priority = new Map(
    preferences.preferences.priorityWorkIds.map((workId, index) => [workId, index]),
  );
  const deprioritized = new Set(preferences.preferences.deprioritizedWorkIds);
  const ranked = items.map((item, originalIndex) => ({ item, originalIndex }));
  ranked.sort((left, right) => {
    const leftPriority = priority.get(left.item.workId);
    const rightPriority = priority.get(right.item.workId);
    if (leftPriority !== undefined && rightPriority !== undefined) {
      return leftPriority - rightPriority || left.originalIndex - right.originalIndex;
    }
    if (leftPriority !== undefined) return -1;
    if (rightPriority !== undefined) return 1;

    const leftDeferred = deprioritized.has(left.item.workId);
    const rightDeferred = deprioritized.has(right.item.workId);
    if (leftDeferred !== rightDeferred) return leftDeferred ? 1 : -1;
    return left.originalIndex - right.originalIndex;
  });

  const displayedItems = Object.freeze(
    ranked.slice(0, preferences.preferences.maxItems).map(entry => entry.item),
  );
  return Object.freeze({
    status: "ready",
    items: displayedItems,
    eligibleItemCount: items.length,
    displayedItemCount: displayedItems.length,
    preferenceRevision: preferences.preferences.revision,
    preferenceFingerprint: preferences.fingerprint,
  });
}
