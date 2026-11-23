import type { ReadingPosition } from "./types";
import { sha256Hex } from "./sha256";

/** Minimal validated projection required to fingerprint a v2 cursor snapshot. */
export type HoidCursorProgressFingerprintProjection = Readonly<{
  revision: number;
  reading: readonly ReadingPosition[];
  startedBookIds: readonly string[];
}>;

/**
 * A correlation receipt attached by the cursor-native runtime to authorized
 * answers. It is a freshness binding, not a signature or narrative grant.
 */
export type HoidCursorAnswerProgressBinding = Readonly<{
  schemaVersion: 1;
  revision: number;
  fingerprint: string;
}>;

const BINDING_KEYS = ["schemaVersion", "revision", "fingerprint"] as const;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

/**
 * Stable fingerprint shared by the conversation gateway, knowledge graph and
 * cursor-answer receipt. Position and started-work ordering are canonicalized
 * so equivalent validated projections produce the same digest.
 */
export function fingerprintHoidCursorProgressProjection(
  projection: HoidCursorProgressFingerprintProjection,
): string {
  const positions = projection.reading
    .map((position): readonly [string, number | null, boolean, number | null] => [
      position.bookId,
      typeof position.chapter === "number" ? position.chapter : null,
      position.completed === true,
      typeof position.order === "number" ? position.order : null,
    ])
    .sort((left, right) => left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0);
  const started = [...projection.startedBookIds].sort();
  return sha256Hex(JSON.stringify([
    "hoid-cursor-progress-fingerprint-v1",
    projection.revision,
    positions,
    started,
  ]));
}

/** Create a receipt only from a projection already validated by the cursor facade. */
export function createHoidCursorAnswerProgressBinding(
  projection: HoidCursorProgressFingerprintProjection,
): HoidCursorAnswerProgressBinding {
  return Object.freeze({
    schemaVersion: 1,
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
  });
}

function canonicalBinding(value: unknown): HoidCursorAnswerProgressBinding | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== BINDING_KEYS.length) return null;

    const record = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !(BINDING_KEYS as readonly string[]).includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }
    for (const key of BINDING_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) return null;
    }

    if (
      record.schemaVersion !== 1 ||
      typeof record.revision !== "number" ||
      !Number.isSafeInteger(record.revision) ||
      record.revision < 0 ||
      typeof record.fingerprint !== "string" ||
      !SHA256_PATTERN.test(record.fingerprint)
    ) return null;

    return Object.freeze({
      schemaVersion: 1,
      revision: record.revision,
      fingerprint: record.fingerprint,
    });
  } catch {
    return null;
  }
}

/**
 * Compare an untrusted receipt against the exact projection used by the
 * presenter. "stale" means structurally valid but bound to another snapshot;
 * "invalid" means the receipt itself is malformed or accessor-backed.
 */
export function validateHoidCursorAnswerProgressBinding(
  value: unknown,
  projection: HoidCursorProgressFingerprintProjection,
): "match" | "stale" | "invalid" {
  const binding = canonicalBinding(value);
  if (!binding) return "invalid";

  const expected = createHoidCursorAnswerProgressBinding(projection);
  return binding.revision === expected.revision && binding.fingerprint === expected.fingerprint
    ? "match"
    : "stale";
}
