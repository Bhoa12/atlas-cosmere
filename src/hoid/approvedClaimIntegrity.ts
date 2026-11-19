import type { HoidKnowledgeEntry } from "./catalog";
import { isHoidKnowledgeKind } from "./knowledgeKinds";
import { getHoidReadingManifest } from "./readingManifest";
import { sha256Hex } from "./sha256";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";

export type HoidApprovedClaimIntent = "explain" | "recommend" | "context";

export type HoidApprovedClaimCore = Readonly<{
  id: string;
  text: string;
  intent: HoidApprovedClaimIntent;
  evidenceIds: readonly string[];
  entityIds?: readonly string[];
}>;

export type HoidApprovedClaimReview = Readonly<{
  status: "approved";
  origin: "original-editorial";
  reviewerId: string;
  reviewedAt: string;
  /** Binds the review record to the exact canonical runtime claim. */
  claimSha256: string;
  evidenceSha256: string;
}>;

export type HoidApprovedClaimIntegrity = Readonly<{
  schemaVersion: 1;
  statementSha256: string;
  claimSha256: string;
  evidenceSha256: string;
  reviewSha256: string;
}>;

export type HoidApprovedClaim = HoidApprovedClaimCore & Readonly<{
  integrity: HoidApprovedClaimIntegrity;
  review: HoidApprovedClaimReview;
}>;

export type HoidApprovedClaimAttestationResult =
  | Readonly<{
      status: "valid";
      integrity: HoidApprovedClaimIntegrity;
      review: HoidApprovedClaimReview;
    }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-claim" | "invalid-review" | "unverified-source" | "integrity-mismatch";
    }>;

export type HoidApprovedClaimValidationResult =
  | Readonly<{ status: "valid"; claim: HoidApprovedClaim }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-claim" | "invalid-review" | "unverified-source" | "integrity-mismatch";
    }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const SHA_PATTERN = /^[a-f0-9]{64}$/;
const INTENTS = new Set<HoidApprovedClaimIntent>(["explain", "recommend", "context"]);
const PROVENANCE = new Set(["verified", "limited", "unavailable"]);
const MAX_EVIDENCE = 16;
const MAX_ENTITIES = 8;
const MAX_TEXT = 4_000;

function plainRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

function dataValue(record: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      descriptor.enumerable !== true
    ) return undefined;
    return descriptor.value;
  } catch {
    return undefined;
  }
}

function exactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | null {
  const record = plainRecord(value);
  if (!record) return null;
  try {
    const keys = Reflect.ownKeys(record);
    if (keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))) return null;
    for (const key of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) return null;
    }
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
    }
    return record;
  } catch {
    return null;
  }
}

function denseIds(value: unknown, maximum: number): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > maximum) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
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
        descriptor.value !== descriptor.value.trim() ||
        descriptor.value.length < 1 ||
        descriptor.value.length > 128 ||
        !ID_PATTERN.test(descriptor.value) ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      result.push(descriptor.value);
    }
    return Object.freeze(result.sort());
  } catch {
    return null;
  }
}

function canonicalCore(value: unknown): HoidApprovedClaimCore | null {
  const raw = exactRecord(
    value,
    ["id", "text", "intent", "evidenceIds", "entityIds"],
    ["id", "text", "intent", "evidenceIds"],
  );
  if (!raw) return null;

  const id = raw.id;
  const text = raw.text;
  const intent = raw.intent;
  const evidenceIds = denseIds(raw.evidenceIds, MAX_EVIDENCE);
  if (
    typeof id !== "string" ||
    id !== id.trim() ||
    id.length < 1 ||
    id.length > 128 ||
    !ID_PATTERN.test(id) ||
    typeof text !== "string" ||
    text !== text.trim() ||
    text.length < 1 ||
    text.length > MAX_TEXT ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text) ||
    typeof intent !== "string" ||
    !INTENTS.has(intent as HoidApprovedClaimIntent) ||
    !evidenceIds
  ) return null;

  const entityDescriptor = Object.getOwnPropertyDescriptor(raw, "entityIds");
  let entityIds: readonly string[] | undefined;
  if (entityDescriptor) {
    if (
      !Object.prototype.hasOwnProperty.call(entityDescriptor, "value") ||
      entityDescriptor.enumerable !== true
    ) return null;
    const parsed = denseIds(entityDescriptor.value, MAX_ENTITIES);
    if (!parsed || !parsed.every(entityId => evidenceIds.includes(entityId))) return null;
    entityIds = parsed;
  }

  return Object.freeze({
    id,
    text,
    intent: intent as HoidApprovedClaimIntent,
    evidenceIds,
    ...(entityIds ? { entityIds } : {}),
  });
}

function knowledgeById(value: unknown): ReadonlyMap<string, unknown> | null {
  try {
    if (!Array.isArray(value) || value.length > 512) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const result = new Map<string, unknown>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      const entry = plainRecord(descriptor.value);
      if (!entry) return null;
      const id = dataValue(entry, "id");
      if (
        typeof id !== "string" ||
        id !== id.trim() ||
        !ID_PATTERN.test(id) ||
        result.has(id)
      ) return null;
      result.set(id, descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalAliases(value: unknown): readonly string[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > 64) return null;
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const aliases: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string" ||
        descriptor.value !== descriptor.value.trim() ||
        descriptor.value.length < 1 ||
        descriptor.value.length > 256 ||
        /[\\u0000-\\u001F\\u007F]/u.test(descriptor.value) ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      aliases.push(descriptor.value);
    }
    return Object.freeze(aliases.sort());
  } catch {
    return null;
  }
}

function evidenceBinding(evidenceId: string, entryInput: unknown): readonly unknown[] | null {
  const entry = plainRecord(entryInput);
  if (!entry) return null;
  const source = exactRecord(dataValue(entry, "evidenceSource"), ["bookId", "chapter", "locatorId"], ["bookId", "chapter", "locatorId"]);
  const unlock = exactRecord(dataValue(entry, "evidenceUnlock"), ["bookId", "chapter"], ["bookId", "chapter"]);
  const first = exactRecord(dataValue(entry, "firstSafeAppearance"), ["bookId", "chapter"], ["bookId", "chapter"]);
  if (!source || !unlock || !first) return null;

  const sourceBookId = source.bookId;
  const sourceChapter = source.chapter;
  const locatorId = source.locatorId;
  const unlockBookId = unlock.bookId;
  const unlockChapter = unlock.chapter;
  const firstBookId = first.bookId;
  const firstChapter = first.chapter;
  for (const optionalKey of ["provenance", "summary"]) {
    const descriptor = Object.getOwnPropertyDescriptor(entry, optionalKey);
    if (descriptor && (
      !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      descriptor.enumerable !== true
    )) return null;
  }
  const kind = dataValue(entry, "kind");
  const aliases = canonicalAliases(dataValue(entry, "aliases"));
  const provenance = dataValue(entry, "provenance");
  const summary = dataValue(entry, "summary");

  if (
    !isHoidKnowledgeKind(kind) ||
    !aliases ||
    typeof sourceBookId !== "string" ||
    sourceBookId !== sourceBookId.trim() ||
    typeof sourceChapter !== "number" ||
    !Number.isSafeInteger(sourceChapter) ||
    sourceChapter < 1 ||
    typeof locatorId !== "string" ||
    locatorId.length < 1 ||
    locatorId.length > 256 ||
    /[\u0000-\u001F\u007F]/u.test(locatorId) ||
    unlockBookId !== sourceBookId ||
    typeof unlockChapter !== "number" ||
    !Number.isSafeInteger(unlockChapter) ||
    unlockChapter < sourceChapter ||
    typeof firstBookId !== "string" ||
    firstBookId !== firstBookId.trim() ||
    firstBookId.length < 1 ||
    typeof firstChapter !== "number" ||
    !Number.isSafeInteger(firstChapter) ||
    firstChapter < 1 ||
    (provenance !== undefined && (typeof provenance !== "string" || !PROVENANCE.has(provenance))) ||
    typeof summary !== "string" ||
    summary.trim().length < 1 ||
    summary.length > MAX_TEXT
  ) return null;

  const manifestResult = getHoidReadingManifest(sourceBookId);
  if (manifestResult.status !== "ready") return null;
  const manifest = manifestResult.manifest;
  const unit = manifest.units.find(candidate => candidate.chapterNumber === sourceChapter);
  if (!unit || unit.locatorId !== locatorId) return null;

  const documentSha256 = getVerifiedChapterDocumentSha256(
    sourceBookId,
    manifest.editionId,
    manifest.navigationSha256,
    sourceChapter,
  );
  if (!documentSha256) return null;

  const firstManifest = getHoidReadingManifest(firstBookId);
  if (
    firstManifest.status !== "ready" ||
    !firstManifest.manifest.units.some(candidate => candidate.chapterNumber === firstChapter)
  ) return null;

  return Object.freeze([
    evidenceId,
    sourceBookId,
    sourceChapter,
    locatorId,
    unlockBookId,
    unlockChapter,
    firstBookId,
    firstChapter,
    manifest.editionId,
    manifest.navigationSha256,
    documentSha256,
    kind,
    sha256Hex(JSON.stringify(aliases)),
    provenance ?? null,
    sha256Hex(summary.trim()),
  ]);
}

function canonicalReviewer(value: unknown): Readonly<{ reviewerId: string; reviewedAt: string }> | null {
  const raw = exactRecord(value, ["reviewerId", "reviewedAt"], ["reviewerId", "reviewedAt"]);
  if (!raw) return null;
  const reviewerId = raw.reviewerId;
  const reviewedAt = raw.reviewedAt;
  if (
    typeof reviewerId !== "string" ||
    reviewerId !== reviewerId.trim() ||
    !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/i.test(reviewerId) ||
    typeof reviewedAt !== "string"
  ) return null;
  const parsed = Date.parse(reviewedAt);
  try {
    if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== reviewedAt) return null;
  } catch {
    return null;
  }
  return Object.freeze({ reviewerId, reviewedAt });
}

function buildAttestation(
  core: HoidApprovedClaimCore,
  knowledge: unknown,
  reviewer: Readonly<{ reviewerId: string; reviewedAt: string }>,
): HoidApprovedClaimAttestationResult {
  const entries = knowledgeById(knowledge);
  if (!entries) return Object.freeze({ status: "invalid", reason: "unverified-source" });

  const mutableBindings: unknown[][] = [];
  for (const evidenceId of core.evidenceIds) {
    const entry = entries.get(evidenceId);
    if (entry === undefined) return Object.freeze({ status: "invalid", reason: "unverified-source" });
    const binding = evidenceBinding(evidenceId, entry);
    if (!binding) return Object.freeze({ status: "invalid", reason: "unverified-source" });
    mutableBindings.push([...binding]);
  }
  mutableBindings.sort((left, right) =>
    String(left[0]) < String(right[0]) ? -1 : String(left[0]) > String(right[0]) ? 1 : 0
  );
  const evidenceSha256 = sha256Hex(JSON.stringify(["hoid-approved-claim-evidence-v1", mutableBindings]));

  const statementSha256 = sha256Hex(core.text);
  const claimSha256 = sha256Hex(JSON.stringify([
    "hoid-approved-claim-v1",
    core.id,
    core.text,
    core.intent,
    core.evidenceIds,
    core.entityIds ?? [],
  ]));
  const reviewSha256 = sha256Hex(JSON.stringify([
    "hoid-approved-claim-review-v1",
    "approved",
    "original-editorial",
    reviewer.reviewerId,
    reviewer.reviewedAt,
    claimSha256,
    evidenceSha256,
  ]));

  const integrity: HoidApprovedClaimIntegrity = Object.freeze({
    schemaVersion: 1,
    statementSha256,
    claimSha256,
    evidenceSha256,
    reviewSha256,
  });
  const review: HoidApprovedClaimReview = Object.freeze({
    status: "approved",
    origin: "original-editorial",
    reviewerId: reviewer.reviewerId,
    reviewedAt: reviewer.reviewedAt,
    claimSha256,
    evidenceSha256,
  });
  return Object.freeze({ status: "valid", integrity, review });
}

/**
 * Build deterministic integrity metadata for an approved runtime claim.
 * Every evidence must resolve to an individually inspected XHTML document
 * whose edition, navigation, chapter locator and source digest are registered.
 * Hashes detect drift; they are not digital signatures or reviewer authentication.
 */
export function createHoidApprovedClaimAttestation(
  claimInput: unknown,
  knowledgeInput: unknown,
  reviewerInput: unknown,
): HoidApprovedClaimAttestationResult {
  const core = canonicalCore(claimInput);
  if (!core) return Object.freeze({ status: "invalid", reason: "invalid-claim" });
  const reviewer = canonicalReviewer(reviewerInput);
  if (!reviewer) return Object.freeze({ status: "invalid", reason: "invalid-review" });
  return buildAttestation(core, knowledgeInput, reviewer);
}

/** Recompute all claim, source-document and review fingerprints at the runtime boundary. */
export function validateHoidApprovedClaimAttestation(
  claimInput: unknown,
  knowledgeInput: unknown,
): HoidApprovedClaimValidationResult {
  const raw = exactRecord(
    claimInput,
    ["id", "text", "intent", "evidenceIds", "entityIds", "integrity", "review"],
    ["id", "text", "intent", "evidenceIds", "integrity", "review"],
  );
  if (!raw) return Object.freeze({ status: "invalid", reason: "invalid-claim" });

  const coreInput = {
    id: raw.id,
    text: raw.text,
    intent: raw.intent,
    evidenceIds: raw.evidenceIds,
    ...(Object.prototype.hasOwnProperty.call(raw, "entityIds") ? { entityIds: raw.entityIds } : {}),
  };
  const core = canonicalCore(coreInput);
  if (!core) return Object.freeze({ status: "invalid", reason: "invalid-claim" });

  const reviewRaw = exactRecord(
    raw.review,
    ["status", "origin", "reviewerId", "reviewedAt", "claimSha256", "evidenceSha256"],
    ["status", "origin", "reviewerId", "reviewedAt", "claimSha256", "evidenceSha256"],
  );
  if (
    !reviewRaw ||
    reviewRaw.status !== "approved" ||
    reviewRaw.origin !== "original-editorial" ||
    typeof reviewRaw.claimSha256 !== "string" ||
    !SHA_PATTERN.test(reviewRaw.claimSha256)
  ) return Object.freeze({ status: "invalid", reason: "invalid-review" });

  const reviewer = canonicalReviewer({
    reviewerId: reviewRaw.reviewerId,
    reviewedAt: reviewRaw.reviewedAt,
  });
  if (!reviewer) return Object.freeze({ status: "invalid", reason: "invalid-review" });
  const expected = buildAttestation(core, knowledgeInput, reviewer);
  if (expected.status !== "valid") return expected;

  const integrityRaw = exactRecord(
    raw.integrity,
    ["schemaVersion", "statementSha256", "claimSha256", "evidenceSha256", "reviewSha256"],
    ["schemaVersion", "statementSha256", "claimSha256", "evidenceSha256", "reviewSha256"],
  );
  if (
    !integrityRaw ||
    integrityRaw.schemaVersion !== 1 ||
    typeof integrityRaw.statementSha256 !== "string" ||
    typeof integrityRaw.claimSha256 !== "string" ||
    typeof integrityRaw.evidenceSha256 !== "string" ||
    typeof integrityRaw.reviewSha256 !== "string" ||
    !SHA_PATTERN.test(integrityRaw.statementSha256) ||
    !SHA_PATTERN.test(integrityRaw.claimSha256) ||
    !SHA_PATTERN.test(integrityRaw.evidenceSha256) ||
    !SHA_PATTERN.test(integrityRaw.reviewSha256) ||
    reviewRaw.claimSha256 !== expected.review.claimSha256 ||
    reviewRaw.evidenceSha256 !== expected.review.evidenceSha256 ||
    integrityRaw.statementSha256 !== expected.integrity.statementSha256 ||
    integrityRaw.claimSha256 !== expected.integrity.claimSha256 ||
    integrityRaw.evidenceSha256 !== expected.integrity.evidenceSha256 ||
    integrityRaw.reviewSha256 !== expected.integrity.reviewSha256
  ) return Object.freeze({ status: "invalid", reason: "integrity-mismatch" });

  const claim: HoidApprovedClaim = Object.freeze({
    ...core,
    integrity: expected.integrity,
    review: expected.review,
  });
  return Object.freeze({ status: "valid", claim });
}
