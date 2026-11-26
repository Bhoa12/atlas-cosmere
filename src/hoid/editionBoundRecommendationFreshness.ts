import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import type { HoidCursorProgressProjection } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./cursorProgressFingerprint";

export type HoidRecommendationFreshness =
  | "current"
  | "stale"
  | "invalid-presentation"
  | "invalid-progress";

const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const READY_KEYS = ["status", "progressRevision", "items", "progressFingerprint"] as const;
const SELECTION_KEYS = [
  "status",
  "progressRevision",
  "heading",
  "detail",
  "choices",
  "progressFingerprint",
] as const;
const NO_SAFE_NEXT_WORK_KEYS = [
  "status",
  "reason",
  "progressRevision",
  "heading",
  "detail",
  "progressFingerprint",
] as const;
const MAX_RECOMMENDATIONS = HOID_SOURCE_BIBLIOGRAPHY.length;

/**
 * Copy a plain data record without reading properties through normal access.
 * Accessors, symbols, unexpected keys and throwing proxy traps fail closed.
 */
function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowedKeys.includes(key)) return null;
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

function hasExactKeys(
  record: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return Object.keys(record).length === expected.length &&
    expected.every(key => Object.prototype.hasOwnProperty.call(record, key));
}

function isDenseDataArray(value: unknown, maximum: number, minimum = 0): boolean {
  try {
    if (
      !Array.isArray(value) ||
      value.length < minimum ||
      value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return false;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return false;

    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return false;
    }

    for (const key of keys) {
      if (key === "length") continue;
      if (
        typeof key !== "string" ||
        !/^(0|[1-9][0-9]*)$/u.test(key) ||
        Number(key) >= value.length
      ) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify that a screen-ready recommendation is still bound to the exact
 * validated progress projection currently held by the host.
 *
 * This checks freshness only. It does not authenticate recommendation
 * content, authorize narrative evidence, or replace the presentation
 * constructor and navigation handoff. The projection must come from
 * projectHoidCursorProgressSnapshot(), never from provider output.
 */
export function validateHoidEditionBoundRecommendationFreshness(
  presentationInput: unknown,
  currentProjection: HoidCursorProgressProjection,
): HoidRecommendationFreshness {
  if (
    currentProjection.status !== "ready" ||
    !Number.isSafeInteger(currentProjection.revision) ||
    currentProjection.revision < 0
  ) return "invalid-progress";

  const record = canonicalRecord(presentationInput, [
    ...READY_KEYS,
    "heading",
    "detail",
    "choices",
    "reason",
  ]);
  if (!record || typeof record.status !== "string") return "invalid-presentation";

  const expectedKeys = record.status === "ready"
    ? READY_KEYS
    : record.status === "selection-required"
      ? SELECTION_KEYS
      : record.status === "no-safe-next-work"
        ? NO_SAFE_NEXT_WORK_KEYS
        : null;
  if (!expectedKeys || !hasExactKeys(record, expectedKeys)) return "invalid-presentation";

  if (
    typeof record.progressRevision !== "number" ||
    !Number.isSafeInteger(record.progressRevision) ||
    record.progressRevision < 0 ||
    typeof record.progressFingerprint !== "string" ||
    !FINGERPRINT_PATTERN.test(record.progressFingerprint)
  ) return "invalid-presentation";

  if (record.status === "ready") {
    if (!isDenseDataArray(record.items, MAX_RECOMMENDATIONS)) return "invalid-presentation";
  } else if (record.status === "selection-required") {
    if (
      typeof record.heading !== "string" ||
      typeof record.detail !== "string" ||
      !isDenseDataArray(record.choices, MAX_RECOMMENDATIONS, 2)
    ) return "invalid-presentation";
  } else if (record.status === "no-safe-next-work") {
    if (
      record.reason !== "no-active-work" ||
      typeof record.heading !== "string" ||
      typeof record.detail !== "string"
    ) return "invalid-presentation";
  } else {
    return "invalid-presentation";
  }

  const expectedFingerprint = fingerprintHoidCursorProgressProjection(currentProjection);
  return record.progressRevision === currentProjection.revision &&
    record.progressFingerprint === expectedFingerprint
    ? "current"
    : "stale";
}
