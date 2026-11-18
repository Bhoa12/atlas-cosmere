import type { HoidKnowledgeKind } from "./catalog";
import { isHoidKnowledgeKind } from "./knowledgeKinds";

export type HoidTypedConversationEntity = Readonly<{
  id: string;
  kind: HoidKnowledgeKind;
}>;

export type HoidTypedConversationContext = Readonly<{
  schemaVersion: 1;
  kind: "typed-entity-follow-up";
  entities: readonly HoidTypedConversationEntity[];
  progressRevision: number;
  progressFingerprint: string;
}>;

export type HoidTypedConversationValidation =
  | Readonly<{ status: "valid"; context: HoidTypedConversationContext }>
  | Readonly<{
      status: "unavailable";
      reason: "invalid-progress" | "missing-context" | "invalid-context" | "stale-context";
    }>;

export type HoidTypedEntityFollowUpResult =
  | Readonly<{ status: "not-follow-up" }>
  | Readonly<{
      status: "resolved";
      entityId: string;
      entityKind: HoidKnowledgeKind;
      context: HoidTypedConversationContext;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-question"
        | "invalid-progress"
        | "missing-context"
        | "invalid-context"
        | "stale-context"
        | "ambiguous-reference"
        | "reference-unavailable";
    }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_QUESTION_LENGTH = 4_000;
const MIN_ENTITIES = 2;
const MAX_ENTITIES = 4;

const SAFE_TYPED_CUES: readonly Readonly<{
  cue: string;
  kind: HoidKnowledgeKind;
}>[] = Object.freeze([
  Object.freeze({ cue: "y ese personaje", kind: "character" }),
  Object.freeze({ cue: "y esa organizacion", kind: "organization" }),
  Object.freeze({ cue: "y esa organizacion en concreto", kind: "organization" }),
  Object.freeze({ cue: "y ese lugar", kind: "place" }),
  Object.freeze({ cue: "y ese objeto", kind: "object" }),
  Object.freeze({ cue: "y ese concepto", kind: "concept" }),
  Object.freeze({ cue: "y esa magia", kind: "magic" }),
  Object.freeze({ cue: "y ese sistema de magia", kind: "magic" }),
  Object.freeze({ cue: "y ese acontecimiento", kind: "event" }),
  Object.freeze({ cue: "y ese fenomeno", kind: "phenomenon" }),
  Object.freeze({ cue: "y ese fenomeno en concreto", kind: "phenomenon" }),
]);

function canonicalRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
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

function canonicalDenseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
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

function canonicalEntities(value: unknown): readonly HoidTypedConversationEntity[] | null {
  const rawEntities = canonicalDenseArray(value, MIN_ENTITIES, MAX_ENTITIES);
  if (!rawEntities) return null;

  const ids = new Set<string>();
  const entities: HoidTypedConversationEntity[] = [];
  for (const raw of rawEntities) {
    const record = canonicalRecord(raw, ["id", "kind"]);
    const id = record?.id;
    const kind = record?.kind;
    if (
      !record ||
      typeof id !== "string" ||
      id.length > 128 ||
      !ID_PATTERN.test(id) ||
      ids.has(id) ||
      typeof kind !== "string" ||
      !isHoidKnowledgeKind(kind)
    ) return null;
    ids.add(id);
    entities.push(Object.freeze({ id, kind: kind as HoidKnowledgeKind }));
  }
  return Object.freeze(entities);
}

function canonicalContext(value: unknown): HoidTypedConversationContext | null {
  const record = canonicalRecord(value, [
    "schemaVersion",
    "kind",
    "entities",
    "progressRevision",
    "progressFingerprint",
  ]);
  if (
    !record ||
    record.schemaVersion !== 1 ||
    record.kind !== "typed-entity-follow-up" ||
    typeof record.progressRevision !== "number" ||
    !Number.isSafeInteger(record.progressRevision) ||
    record.progressRevision < 0 ||
    typeof record.progressFingerprint !== "string" ||
    !SHA256_PATTERN.test(record.progressFingerprint)
  ) return null;

  const entities = canonicalEntities(record.entities);
  if (!entities) return null;
  return Object.freeze({
    schemaVersion: 1,
    kind: "typed-entity-follow-up",
    entities,
    progressRevision: record.progressRevision,
    progressFingerprint: record.progressFingerprint,
  });
}

function normalizeQuestion(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\p{Mn}\p{Cf}]/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Create an ephemeral typed-ID context. No names, aliases, prose or citations are retained. */
export function createHoidTypedConversationContext(
  entitiesInput: unknown,
  progressInput: unknown,
): HoidTypedConversationContext | null {
  const entities = canonicalEntities(entitiesInput);
  const progress = canonicalProgress(progressInput);
  if (!entities || !progress) return null;
  return Object.freeze({
    schemaVersion: 1,
    kind: "typed-entity-follow-up",
    entities,
    progressRevision: progress.revision,
    progressFingerprint: progress.fingerprint,
  });
}

/** Validate the exact context/progress identity before any category selection. */
export function validateHoidTypedConversationContext(
  contextInput: unknown,
  progressInput: unknown,
): HoidTypedConversationValidation {
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

/**
 * Resolve only exact, allow-listed noun-category follow-ups. A category must
 * identify exactly one entity in the prior context; no positional or fuzzy
 * selection is allowed. Broad phrases such as "¿Y ese sistema?" abstain.
 */
export function resolveHoidTypedEntityFollowUp(
  questionInput: unknown,
  contextInput: unknown,
  progressInput: unknown,
): HoidTypedEntityFollowUpResult {
  if (
    typeof questionInput !== "string" ||
    questionInput.length < 1 ||
    questionInput.length > MAX_QUESTION_LENGTH ||
    questionInput !== questionInput.trim() ||
    /[\u0000-\u001F\u007F\p{Cf}]/u.test(questionInput)
  ) return Object.freeze({ status: "unavailable", reason: "invalid-question" });

  let normalized: string;
  try {
    normalized = normalizeQuestion(questionInput);
  } catch {
    return Object.freeze({ status: "unavailable", reason: "invalid-question" });
  }
  if (!normalized) return Object.freeze({ status: "unavailable", reason: "invalid-question" });

  const matchingCues = SAFE_TYPED_CUES.filter(item => item.cue === normalized);
  if (matchingCues.length === 0) {
    if (/^y (?:ese|esa|esos|esas)\b/u.test(normalized)) {
      return Object.freeze({ status: "unavailable", reason: "ambiguous-reference" });
    }
    return Object.freeze({ status: "not-follow-up" });
  }
  if (matchingCues.length !== 1) {
    return Object.freeze({ status: "unavailable", reason: "ambiguous-reference" });
  }

  const validation = validateHoidTypedConversationContext(contextInput, progressInput);
  if (validation.status !== "valid") {
    return Object.freeze({ status: "unavailable", reason: validation.reason });
  }

  const candidates = validation.context.entities.filter(entity => entity.kind === matchingCues[0].kind);
  if (candidates.length === 0) {
    return Object.freeze({ status: "unavailable", reason: "reference-unavailable" });
  }
  if (candidates.length !== 1) {
    return Object.freeze({ status: "unavailable", reason: "ambiguous-reference" });
  }

  return Object.freeze({
    status: "resolved",
    entityId: candidates[0].id,
    entityKind: candidates[0].kind,
    context: validation.context,
  });
}
