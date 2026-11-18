import { getHoidTopicDefinition, type HoidTopicId } from "./topicTaxonomy";

export type HoidTopicInterestContext = Readonly<{
  schemaVersion: 1;
  kind: "explicit-topic-interests";
  topicIds: readonly HoidTopicId[];
  progressRevision: number;
  progressFingerprint: string;
}>;

export type HoidTopicInterestContextValidation =
  | Readonly<{ status: "valid"; context: HoidTopicInterestContext }>
  | Readonly<{
      status: "unavailable";
      reason: "missing-context" | "invalid-context" | "invalid-progress" | "stale-context";
    }>;

const MAX_SELECTED_TOPICS = 8;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function canonicalRecord(value: unknown, expectedKeys: readonly string[]): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== expectedKeys.length) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !expectedKeys.includes(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of expectedKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalTopicIds(value: unknown): readonly HoidTopicId[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < 1 ||
      value.length > MAX_SELECTED_TOPICS ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: HoidTopicId[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string" ||
        !getHoidTopicDefinition(descriptor.value) ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      result.push(descriptor.value as HoidTopicId);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    // Preserve the reader's explicit selection order; it is the recommendation priority.
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function canonicalProgress(value: unknown): Readonly<{ revision: number; fingerprint: string }> | null {
  const record = canonicalRecord(value, ["revision", "fingerprint"]);
  if (
    !record ||
    typeof record.revision !== "number" ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0 ||
    typeof record.fingerprint !== "string" ||
    !SHA256_PATTERN.test(record.fingerprint)
  ) return null;
  return Object.freeze({ revision: record.revision, fingerprint: record.fingerprint });
}

function canonicalContext(value: unknown): HoidTopicInterestContext | null {
  const record = canonicalRecord(value, [
    "schemaVersion",
    "kind",
    "topicIds",
    "progressRevision",
    "progressFingerprint",
  ]);
  if (
    !record ||
    record.schemaVersion !== 1 ||
    record.kind !== "explicit-topic-interests" ||
    typeof record.progressRevision !== "number" ||
    !Number.isSafeInteger(record.progressRevision) ||
    record.progressRevision < 0 ||
    typeof record.progressFingerprint !== "string" ||
    !SHA256_PATTERN.test(record.progressFingerprint)
  ) return null;

  const topicIds = canonicalTopicIds(record.topicIds);
  if (!topicIds) return null;
  return Object.freeze({
    schemaVersion: 1,
    kind: "explicit-topic-interests",
    topicIds,
    progressRevision: record.progressRevision,
    progressFingerprint: record.progressFingerprint,
  });
}

/** Create an ephemeral context from topics explicitly selected by the reader. */
export function createHoidTopicInterestContext(
  topicIdsInput: unknown,
  progressInput: unknown,
): HoidTopicInterestContext | null {
  const topicIds = canonicalTopicIds(topicIdsInput);
  const progress = canonicalProgress(progressInput);
  if (!topicIds || !progress) return null;
  return Object.freeze({
    schemaVersion: 1,
    kind: "explicit-topic-interests",
    topicIds,
    progressRevision: progress.revision,
    progressFingerprint: progress.fingerprint,
  });
}

/** Revalidate the exact selected-topic set against the current progress identity. */
export function validateHoidTopicInterestContext(
  contextInput: unknown,
  progressInput: unknown,
): HoidTopicInterestContextValidation {
  if (contextInput === undefined || contextInput === null) {
    return Object.freeze({ status: "unavailable", reason: "missing-context" });
  }
  const context = canonicalContext(contextInput);
  if (!context) return Object.freeze({ status: "unavailable", reason: "invalid-context" });
  const progress = canonicalProgress(progressInput);
  if (!progress) return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  if (
    context.progressRevision !== progress.revision ||
    context.progressFingerprint !== progress.fingerprint
  ) return Object.freeze({ status: "unavailable", reason: "stale-context" });
  return Object.freeze({ status: "valid", context });
}
