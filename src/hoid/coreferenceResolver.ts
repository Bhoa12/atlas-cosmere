import {
  canonicalEvidenceScope,
  type CanonicalHoidEvidenceScope,
} from "./evidenceScope";
import {
  projectHoidCursorProgressSnapshot,
} from "./cursorEvidenceRuntime";
import {
  fingerprintHoidCursorProgressProjection,
} from "./knowledgeGraph";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import {
  createHoidConversationContext,
  resolveHoidConversationFollowUp,
  type HoidConversationContext,
  type HoidConversationProgressIdentity,
} from "./conversationContext";
import {
  resolveProductionHoidEntityIds,
  type HoidEntityMentionResolutionResult,
} from "./entityResolver";
import {
  HOID_COREFERENCE_REGISTRY,
  type HoidCoreferenceForm,
} from "./coreferenceRegistry";

type CanonicalCoreferenceEvidence = Readonly<{
  id: string;
  scope: CanonicalHoidEvidenceScope;
}>;

type CanonicalCoreferenceRecord = Readonly<{
  id: string;
  entityId: string;
  form: HoidCoreferenceForm;
  evidence: readonly CanonicalCoreferenceEvidence[];
}>;

export type HoidCoreferenceResolutionResult =
  | Readonly<{ status: "not-follow-up" }>
  | Readonly<{
      status: "resolved";
      entityId: string;
      context: HoidConversationContext;
      progressRevision: number;
      progressFingerprint: string;
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
        | "reference-unavailable"
        | "invalid-registry"
        | "entity-unavailable";
    }>;

export type HoidCoreferenceEntityAuthorizer = (
  progress: unknown,
  entityIds: readonly string[],
) => unknown;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const MAX_QUESTION_LENGTH = 4_000;
const MAX_RECORDS = 512;
const MAX_EVIDENCE_PER_RECORD = 8;

const PRONOUN_FOLLOW_UPS: readonly Readonly<{
  form: HoidCoreferenceForm;
  cues: readonly string[];
}>[] = Object.freeze([
  Object.freeze({
    form: "él" as const,
    cues: Object.freeze([
      "y el",
      "y con el",
      "y de el",
      "y que sabes de el",
      "y que pasa con el",
      "y como se relaciona con el",
      "y que relacion tiene con el",
      "y que vinculo tiene con el",
    ]),
  }),
  Object.freeze({
    form: "ella" as const,
    cues: Object.freeze([
      "y ella",
      "y con ella",
      "y de ella",
      "y que sabes de ella",
      "y que pasa con ella",
      "y como se relaciona con ella",
      "y que relacion tiene con ella",
      "y que vinculo tiene con ella",
    ]),
  }),
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

function canonicalDenseArray(
  value: unknown,
  minimum: number,
  maximum: number,
): readonly unknown[] | null {
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

function normalizeQuestion(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\p{Mn}\p{Cf}]/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function progressIdentity(value: unknown): HoidConversationProgressIdentity | null {
  const projection = projectHoidCursorProgressSnapshot(value);
  if (projection.status !== "ready") return null;
  return Object.freeze({
    revision: projection.revision,
    fingerprint: fingerprintHoidCursorProgressProjection(projection),
  });
}

function canonicalReview(value: unknown): boolean {
  const review = canonicalRecord(value, ["status", "origin", "reviewerId", "reviewedAt"]);
  if (
    !review ||
    review.status !== "approved" ||
    review.origin !== "original-editorial" ||
    typeof review.reviewerId !== "string" ||
    review.reviewerId.length < 1 ||
    review.reviewerId.length > 128 ||
    review.reviewerId !== review.reviewerId.trim() ||
    typeof review.reviewedAt !== "string"
  ) return false;
  const timestamp = Date.parse(review.reviewedAt);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === review.reviewedAt;
}

function canonicalRecords(value: unknown): readonly CanonicalCoreferenceRecord[] | null {
  const rawRecords = canonicalDenseArray(value, 0, MAX_RECORDS);
  if (!rawRecords) return null;

  const records: CanonicalCoreferenceRecord[] = [];
  const recordIds = new Set<string>();
  const entityForms = new Set<string>();
  const evidenceIds = new Set<string>();

  for (const raw of rawRecords) {
    const record = canonicalRecord(raw, ["id", "entityId", "form", "evidence", "review"]);
    if (
      !record ||
      typeof record.id !== "string" ||
      !ID_PATTERN.test(record.id) ||
      recordIds.has(record.id) ||
      typeof record.entityId !== "string" ||
      !ID_PATTERN.test(record.entityId) ||
      (record.form !== "él" && record.form !== "ella") ||
      !canonicalReview(record.review)
    ) return null;

    const entityFormKey = record.entityId + "\n" + record.form;
    if (entityForms.has(entityFormKey)) return null;

    const rawEvidence = canonicalDenseArray(record.evidence, 1, MAX_EVIDENCE_PER_RECORD);
    if (!rawEvidence) return null;
    const evidence: CanonicalCoreferenceEvidence[] = [];

    for (const rawItem of rawEvidence) {
      const item = canonicalRecord(rawItem, ["id", "source", "unlock"]);
      if (
        !item ||
        typeof item.id !== "string" ||
        !ID_PATTERN.test(item.id) ||
        evidenceIds.has(item.id)
      ) return null;

      const scope = canonicalEvidenceScope(item.source, item.unlock);
      if (!scope) return null;
      const manifest = getHoidReadingManifest(scope.sourceBookId);
      if (manifest.status !== "ready") return null;
      const documentSha256 = getVerifiedChapterDocumentSha256(
        scope.sourceBookId,
        manifest.manifest.editionId,
        manifest.manifest.navigationSha256,
        scope.sourceChapter,
      );
      if (!documentSha256) return null;

      evidence.push(Object.freeze({ id: item.id, scope }));
      evidenceIds.add(item.id);
    }

    records.push(Object.freeze({
      id: record.id,
      entityId: record.entityId,
      form: record.form,
      evidence: Object.freeze(evidence),
    }));
    recordIds.add(record.id);
    entityForms.add(entityFormKey);
  }

  return Object.freeze(records);
}

function evidenceIsUnlocked(
  evidence: CanonicalCoreferenceEvidence,
  reading: readonly Readonly<{ bookId: string; chapter?: number; completed?: boolean }>[],
): boolean {
  const position = reading.find(item => item.bookId === evidence.scope.unlockBookId);
  return Boolean(
    position &&
    (position.completed === true ||
      (typeof position.chapter === "number" && position.chapter >= evidence.scope.unlockChapter)),
  );
}

function canonicalAuthorizedEntityIds(
  value: unknown,
  requestedIds: readonly string[],
  expected: HoidConversationProgressIdentity,
): boolean {
  try {
    const record = canonicalRecord(value, [
      "status", "resolution", "progressRevision", "progressFingerprint", "matches", "truncated",
    ]);
    if (
      !record ||
      record.status !== "ready" ||
      record.resolution !== "matched" ||
      record.progressRevision !== expected.revision ||
      record.progressFingerprint !== expected.fingerprint ||
      record.truncated !== false
    ) return false;

    const matches = canonicalDenseArray(record.matches, requestedIds.length, requestedIds.length);
    if (!matches) return false;
    for (let index = 0; index < matches.length; index += 1) {
      const item = matches[index];
      if (item === null || typeof item !== "object" || Array.isArray(item)) return false;
      const idDescriptor = Object.getOwnPropertyDescriptor(item, "id");
      if (
        !idDescriptor ||
        !Object.prototype.hasOwnProperty.call(idDescriptor, "value") ||
        idDescriptor.enumerable !== true ||
        idDescriptor.value !== requestedIds[index]
      ) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function unavailable(
  reason: Extract<HoidCoreferenceResolutionResult, { status: "unavailable" }>["reason"],
): HoidCoreferenceResolutionResult {
  return Object.freeze({ status: "unavailable", reason });
}

/**
 * Resolve an exact, source-reviewed singular pronoun against a prior ID-only
 * relationship context. Every context entity is reauthorized before candidate
 * selection; every matching pronoun record and all of its evidence must be
 * unlocked. A hidden matching record blocks uniqueness rather than being
 * silently ignored.
 */
export function resolveHoidAuthorizedCoreference(
  questionInput: unknown,
  contextInput: unknown,
  progressInput: unknown,
  recordsInput: unknown,
  authorizeEntityIds: HoidCoreferenceEntityAuthorizer,
): HoidCoreferenceResolutionResult {
  if (
    typeof questionInput !== "string" ||
    questionInput.length < 1 ||
    questionInput.length > MAX_QUESTION_LENGTH ||
    questionInput !== questionInput.trim() ||
    /[\u0000-\u001F\u007F\p{Cf}]/u.test(questionInput)
  ) return unavailable("invalid-question");

  let normalized: string;
  try {
    normalized = normalizeQuestion(questionInput);
  } catch {
    return unavailable("invalid-question");
  }
  if (!normalized) return unavailable("invalid-question");

  const matchingCue = PRONOUN_FOLLOW_UPS.flatMap(item =>
    item.cues.filter(cue => cue === normalized).map(() => item.form),
  );
  if (matchingCue.length === 0) return Object.freeze({ status: "not-follow-up" });
  if (matchingCue.length !== 1) return unavailable("ambiguous-reference");
  const form = matchingCue[0];

  if (contextInput === null || contextInput === undefined) return unavailable("missing-context");

  const progress = progressIdentity(progressInput);
  if (!progress) return unavailable("invalid-progress");
  const groupContext = resolveHoidConversationFollowUp(
    "¿Y entre ellos?",
    contextInput,
    progress,
  );
  if (groupContext.status !== "resolved") {
    if (groupContext.status === "unavailable" && groupContext.reason === "stale-context") {
      return unavailable("stale-context");
    }
    if (groupContext.status === "unavailable" && groupContext.reason === "invalid-progress") {
      return unavailable("invalid-progress");
    }
    if (groupContext.status === "unavailable" && groupContext.reason === "missing-context") {
      return unavailable("missing-context");
    }
    return unavailable("invalid-context");
  }

  const records = canonicalRecords(recordsInput);
  if (!records) return unavailable("invalid-registry");

  let authorized: unknown;
  try {
    authorized = authorizeEntityIds(progressInput, groupContext.entityIds);
  } catch {
    return unavailable("entity-unavailable");
  }
  if (!canonicalAuthorizedEntityIds(authorized, groupContext.entityIds, progress)) {
    return unavailable("entity-unavailable");
  }

  const projection = projectHoidCursorProgressSnapshot(progressInput);
  if (projection.status !== "ready") return unavailable("invalid-progress");

  const candidates = records.filter(record =>
    record.form === form && groupContext.entityIds.includes(record.entityId),
  );
  if (candidates.length === 0) return unavailable("reference-unavailable");

  const unlocked: CanonicalCoreferenceRecord[] = [];
  let blockedCandidate = false;
  for (const candidate of candidates) {
    if (!candidate.evidence.every(item => evidenceIsUnlocked(item, projection.reading))) {
      blockedCandidate = true;
    } else {
      unlocked.push(candidate);
    }
  }
  if (blockedCandidate) return unavailable("reference-unavailable");
  if (unlocked.length !== 1) return unavailable("ambiguous-reference");

  const context = createHoidConversationContext(groupContext.entityIds, progress);
  if (!context) return unavailable("invalid-context");

  return Object.freeze({
    status: "resolved",
    entityId: unlocked[0].entityId,
    context,
    progressRevision: progress.revision,
    progressFingerprint: progress.fingerprint,
  });
}

/** Production resolution uses only the empty-or-reviewed local registry and ID reauthorization. */
export function resolveProductionHoidCoreference(
  questionInput: unknown,
  contextInput: unknown,
  progressInput: unknown,
): HoidCoreferenceResolutionResult {
  return resolveHoidAuthorizedCoreference(
    questionInput,
    contextInput,
    progressInput,
    HOID_COREFERENCE_REGISTRY,
    resolveProductionHoidEntityIds,
  );
}
