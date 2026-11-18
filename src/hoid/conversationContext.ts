export type HoidConversationProgressIdentity = Readonly<{
  revision: number;
  fingerprint: string;
}>;

export type HoidConversationContext = Readonly<{
  schemaVersion: 1;
  kind: "relationship-follow-up";
  entityIds: readonly string[];
  progressRevision: number;
  progressFingerprint: string;
}>;

export type HoidConversationFollowUpResult =
  | Readonly<{ status: "not-follow-up" }>
  | Readonly<{ status: "resolved"; entityIds: readonly string[] }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-question"
        | "invalid-progress"
        | "missing-context"
        | "invalid-context"
        | "stale-context"
        | "ambiguous-reference";
    }>;

const ENTITY_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_QUESTION_LENGTH = 4_000;
const MAX_CONTEXT_ENTITIES = 4;

const SAFE_RELATIONSHIP_FOLLOW_UP_CUES = Object.freeze([
  "y entre ellos",
  "y entre ambos",
  "y entre los dos",
  "y entre las dos",
  "y como se relacionan",
  "y como se relaciona esa pareja",
  "y que relacion hay entre ellos",
  "y que relacion existe entre ellos",
  "y esa relacion",
  "y esa conexion",
  "y el vinculo entre ellos",
  "y el vinculo entre ambos",
  "y el vinculo entre los dos",
  "y que los une",
]);

const AMBIGUOUS_FOLLOW_UP_CUES = Object.freeze([
  "y ella",
  "y con ella",
  "y con el",
  "y de ella",
  "y de el",
  "y que sabes de ella",
  "y que sabes de el",
  "y que pasa con ella",
  "y que pasa con el",
  "y como se relaciona con ella",
  "y como se relaciona con el",
  "y que relacion tiene con ella",
  "y que relacion tiene con el",
  "y el otro",
  "y la otra",
  "y esa persona",
  "y ese personaje",
  "y esa entidad",
  "y ese objeto",
  "y eso",
]);

function canonicalRecord(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.length) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
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

function canonicalEntityIds(value: unknown): readonly string[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < 2 ||
      value.length > MAX_CONTEXT_ENTITIES ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const ids: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string" ||
        !ENTITY_ID_PATTERN.test(descriptor.value) ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      ids.push(descriptor.value);
    }
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length) {
        return null;
      }
    }
    return Object.freeze(ids);
  } catch {
    return null;
  }
}

function canonicalProgressIdentity(value: unknown): HoidConversationProgressIdentity | null {
  const record = canonicalRecord(value, ["revision", "fingerprint"]);
  if (
    !record ||
    typeof record.revision !== "number" ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0 ||
    typeof record.fingerprint !== "string" ||
    !SHA256_PATTERN.test(record.fingerprint)
  ) return null;
  return Object.freeze({
    revision: record.revision,
    fingerprint: record.fingerprint,
  });
}

function canonicalContext(value: unknown): HoidConversationContext | null {
  const record = canonicalRecord(value, [
    "schemaVersion",
    "kind",
    "entityIds",
    "progressRevision",
    "progressFingerprint",
  ]);
  if (
    !record ||
    record.schemaVersion !== 1 ||
    record.kind !== "relationship-follow-up" ||
    typeof record.progressRevision !== "number" ||
    !Number.isSafeInteger(record.progressRevision) ||
    record.progressRevision < 0 ||
    typeof record.progressFingerprint !== "string" ||
    !SHA256_PATTERN.test(record.progressFingerprint)
  ) return null;
  const entityIds = canonicalEntityIds(record.entityIds);
  if (!entityIds) return null;
  return Object.freeze({
    schemaVersion: 1,
    kind: "relationship-follow-up",
    entityIds,
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

function containsCue(question: string, cue: string): boolean {
  return (" " + question + " ").includes(" " + cue + " ");
}

/**
 * Stores only canonical entity IDs and the exact progress identity. It never
 * stores user text, aliases, summaries, evidence prose or provider output.
 */
export function createHoidConversationContext(
  entityIdsInput: unknown,
  progressInput: unknown,
): HoidConversationContext | null {
  const entityIds = canonicalEntityIds(entityIdsInput);
  const progress = canonicalProgressIdentity(progressInput);
  if (!entityIds || !progress) return null;
  return Object.freeze({
    schemaVersion: 1,
    kind: "relationship-follow-up",
    entityIds,
    progressRevision: progress.revision,
    progressFingerprint: progress.fingerprint,
  });
}

/**
 * Validates a session-local ID-only context independently of any follow-up cue.
 * This is shared by group follow-ups and reviewed pronoun resolution so neither
 * path needs to synthesize a question merely to validate context freshness.
 */
export function validateHoidConversationContext(
  contextInput: unknown,
  progressInput: unknown,
): HoidConversationFollowUpResult {
  if (contextInput === undefined || contextInput === null) {
    return Object.freeze({ status: "unavailable", reason: "missing-context" });
  }
  const context = canonicalContext(contextInput);
  if (!context) return Object.freeze({ status: "unavailable", reason: "invalid-context" });

  const progress = canonicalProgressIdentity(progressInput);
  if (!progress) return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  if (
    context.progressRevision !== progress.revision ||
    context.progressFingerprint !== progress.fingerprint
  ) {
    return Object.freeze({ status: "unavailable", reason: "stale-context" });
  }
  return Object.freeze({ status: "resolved", entityIds: context.entityIds });
}

/**
 * Resolves only explicit group-level relationship follow-ups. Singular
 * pronouns are handled by the separate source-reviewed coreference resolver;
 * this broad group-level path never guesses a singular referent.
 */
export function resolveHoidConversationFollowUp(
  questionInput: unknown,
  contextInput: unknown,
  progressInput: unknown,
): HoidConversationFollowUpResult {
  if (
    typeof questionInput !== "string" ||
    questionInput.length < 1 ||
    questionInput.length > MAX_QUESTION_LENGTH ||
    questionInput !== questionInput.trim() ||
    /[\u0000-\u001F\u007F\p{Cf}]/u.test(questionInput)
  ) {
    return Object.freeze({ status: "unavailable", reason: "invalid-question" });
  }

  let normalized: string;
  try {
    normalized = normalizeQuestion(questionInput);
  } catch {
    return Object.freeze({ status: "unavailable", reason: "invalid-question" });
  }
  if (!normalized) return Object.freeze({ status: "unavailable", reason: "invalid-question" });

  const ambiguous = normalized === "y el" ||
    AMBIGUOUS_FOLLOW_UP_CUES.some(cue => containsCue(normalized, cue));
  const safeRelationshipFollowUp = SAFE_RELATIONSHIP_FOLLOW_UP_CUES.some(
    cue => containsCue(normalized, cue),
  );
  if (!ambiguous && !safeRelationshipFollowUp) {
    return Object.freeze({ status: "not-follow-up" });
  }
  if (ambiguous) {
    return Object.freeze({ status: "unavailable", reason: "ambiguous-reference" });
  }

  return validateHoidConversationContext(contextInput, progressInput);
}
