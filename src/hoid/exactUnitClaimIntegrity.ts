import { isHoidKnowledgeKind, type HoidKnowledgeKind } from "./knowledgeKinds";
import {
  validateHoidChapterReference,
  type HoidChapterReference,
} from "./chapterReference";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import {
  canonicalizeHoidExactUnitEvidencePolicy,
  type HoidExactUnitEvidencePolicy,
} from "./unitEvidenceAuthorizationV2";
import { sha256Hex } from "./sha256";

export type HoidExactEvidenceRecord = Readonly<{
  id: string;
  aliases: readonly string[];
  kind: HoidKnowledgeKind;
  provenance: "verified";
  summary: string;
}>;

export type HoidExactApprovedClaimIntent = "explain" | "recommend" | "context";

export type HoidExactApprovedClaimCore = Readonly<{
  id: string;
  text: string;
  intent: HoidExactApprovedClaimIntent;
  evidenceIds: readonly string[];
  entityIds?: readonly string[];
}>;

export type HoidExactApprovedClaimReview = Readonly<{
  schemaVersion: 2;
  status: "approved";
  origin: "original-editorial";
  reviewerId: string;
  reviewedAt: string;
  claimSha256: string;
  evidenceSha256: string;
}>;

export type HoidExactApprovedClaimIntegrity = Readonly<{
  schemaVersion: 2;
  claimSha256: string;
  evidenceSha256: string;
  reviewSha256: string;
}>;

export type HoidExactApprovedClaim = HoidExactApprovedClaimCore & Readonly<{
  integrity: HoidExactApprovedClaimIntegrity;
  review: HoidExactApprovedClaimReview;
}>;

export type HoidExactApprovedClaimAttestationResult =
  | Readonly<{
      status: "valid";
      integrity: HoidExactApprovedClaimIntegrity;
      review: HoidExactApprovedClaimReview;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-claim"
        | "invalid-evidence"
        | "invalid-policy"
        | "invalid-review"
        | "unverified-source"
        | "integrity-mismatch";
    }>;

export type HoidExactApprovedClaimValidationResult =
  | Readonly<{ status: "valid"; claim: HoidExactApprovedClaim }>
  | Extract<HoidExactApprovedClaimAttestationResult, { status: "invalid" }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const INTENTS = new Set<HoidExactApprovedClaimIntent>(["explain", "recommend", "context"]);
const MAX_EVIDENCE = 16;
const MAX_ENTITIES = 8;
const MAX_TEXT = 4_000;
const CORE_KEYS = ["id", "text", "intent", "evidenceIds", "entityIds"] as const;
const CLAIM_KEYS = new Set([...CORE_KEYS, "integrity", "review"]);
const EVIDENCE_KEYS = new Set(["id", "aliases", "kind", "provenance", "summary"]);
const REVIEWER_KEYS = new Set(["reviewerId", "reviewedAt"]);
const REVIEW_KEYS = new Set([
  "schemaVersion", "status", "origin", "reviewerId", "reviewedAt", "claimSha256", "evidenceSha256",
]);
const INTEGRITY_KEYS = new Set(["schemaVersion", "claimSha256", "evidenceSha256", "reviewSha256"]);

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

function exactRecord(
  value: unknown,
  allowed: ReadonlySet<string>,
  required: readonly string[],
): Record<string, unknown> | null {
  const record = plainRecord(value);
  if (!record) return null;
  try {
    const keys = Reflect.ownKeys(record);
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < minimum ||
      value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) return null;
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

function canonicalIds(value: unknown, minimum: number, maximum: number): readonly string[] | null {
  const raw = denseArray(value, minimum, maximum);
  if (!raw) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (
      typeof item !== "string" ||
      item !== item.trim() ||
      item.length < 1 ||
      item.length > 128 ||
      !ID_PATTERN.test(item) ||
      seen.has(item)
    ) return null;
    seen.add(item);
    ids.push(item);
  }
  return Object.freeze(ids.sort());
}

function canonicalCore(value: unknown): HoidExactApprovedClaimCore | null {
  const record = exactRecord(value, new Set(CORE_KEYS), ["id", "text", "intent", "evidenceIds"]);
  if (!record) return null;
  const id = record.id;
  const text = record.text;
  const intent = record.intent;
  const evidenceIds = canonicalIds(record.evidenceIds, 1, MAX_EVIDENCE);
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
    !INTENTS.has(intent as HoidExactApprovedClaimIntent) ||
    !evidenceIds
  ) return null;

  let entityIds: readonly string[] | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "entityIds")) {
    const parsed = canonicalIds(record.entityIds, 1, MAX_ENTITIES);
    if (!parsed || !parsed.every(entityId => evidenceIds.includes(entityId))) return null;
    entityIds = parsed;
  }
  return Object.freeze({
    id,
    text,
    intent: intent as HoidExactApprovedClaimIntent,
    evidenceIds,
    ...(entityIds ? { entityIds } : {}),
  });
}

function canonicalAliases(value: unknown): readonly string[] | null {
  const raw = denseArray(value, 1, 64);
  if (!raw) return null;
  const aliases: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (
      typeof item !== "string" ||
      item !== item.trim() ||
      item.length < 1 ||
      item.length > 256 ||
      /[\u0000-\u001F\u007F]/u.test(item) ||
      seen.has(item)
    ) return null;
    seen.add(item);
    aliases.push(item);
  }
  return Object.freeze(aliases.sort());
}

function canonicalEvidence(value: unknown): HoidExactEvidenceRecord | null {
  const record = exactRecord(value, EVIDENCE_KEYS, ["id", "aliases", "kind", "provenance", "summary"]);
  if (
    !record ||
    typeof record.id !== "string" ||
    record.id !== record.id.trim() ||
    record.id.length < 1 ||
    record.id.length > 128 ||
    !ID_PATTERN.test(record.id) ||
    !isHoidKnowledgeKind(record.kind) ||
    record.provenance !== "verified" ||
    typeof record.summary !== "string" ||
    record.summary !== record.summary.trim() ||
    record.summary.length < 1 ||
    record.summary.length > MAX_TEXT ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(record.summary)
  ) return null;
  const aliases = canonicalAliases(record.aliases);
  if (!aliases) return null;
  return Object.freeze({
    id: record.id,
    aliases,
    kind: record.kind,
    provenance: "verified",
    summary: record.summary,
  });
}

function canonicalReviewer(value: unknown): Readonly<{ reviewerId: string; reviewedAt: string }> | null {
  const record = exactRecord(value, REVIEWER_KEYS, ["reviewerId", "reviewedAt"]);
  if (
    !record ||
    typeof record.reviewerId !== "string" ||
    record.reviewerId !== record.reviewerId.trim() ||
    record.reviewerId.length < 1 ||
    record.reviewerId.length > 128 ||
    !ID_PATTERN.test(record.reviewerId) ||
    typeof record.reviewedAt !== "string"
  ) return null;
  const timestamp = Date.parse(record.reviewedAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== record.reviewedAt) return null;
  return Object.freeze({ reviewerId: record.reviewerId, reviewedAt: record.reviewedAt });
}

function sourceDocumentDigest(policy: HoidExactUnitEvidencePolicy): string | null {
  const source = validateHoidChapterReference(policy.source);
  if (source.status !== "valid" || source.reference.labelAmbiguous) return null;
  const manifestResult = getHoidReadingManifest(source.reference.bookId);
  if (manifestResult.status !== "ready") return null;
  const unit = manifestResult.manifest.units.find(candidate =>
    candidate.id === source.reference.unitId &&
    candidate.ordinal === source.reference.ordinal &&
    candidate.chapterNumber === source.reference.chapterNumber
  );
  if (!unit) return null;
  const digest = getVerifiedChapterDocumentSha256(
    source.reference.bookId,
    manifestResult.manifest.editionId,
    manifestResult.manifest.navigationSha256,
    source.reference.chapterNumber,
  );
  return typeof digest === "string" && SHA_PATTERN.test(digest) ? digest : null;
}

function referenceBinding(reference: HoidChapterReference) {
  return {
    schemaVersion: reference.schemaVersion,
    kind: reference.kind,
    authority: reference.authority,
    bookId: reference.bookId,
    chapterNumber: reference.chapterNumber,
    ordinal: reference.ordinal,
    unitId: reference.unitId,
    labelAmbiguous: reference.labelAmbiguous,
    identityFingerprint: reference.identityFingerprint,
  };
}

type CanonicalBundle = Readonly<{
  evidence: readonly HoidExactEvidenceRecord[];
  policies: readonly HoidExactUnitEvidencePolicy[];
  bindings: readonly unknown[];
}>;

type CanonicalBundleResult =
  | Readonly<{ status: "valid"; bundle: CanonicalBundle }>
  | Readonly<{ status: "invalid"; reason: "invalid-evidence" | "invalid-policy" | "unverified-source" }>;

function canonicalBundle(
  claim: HoidExactApprovedClaimCore,
  evidenceInput: unknown,
  policiesInput: unknown,
): CanonicalBundleResult {
  const rawEvidence = denseArray(evidenceInput, 1, MAX_EVIDENCE);
  const rawPolicies = denseArray(policiesInput, 1, MAX_EVIDENCE);
  if (!rawEvidence || rawEvidence.length !== claim.evidenceIds.length) {
    return Object.freeze({ status: "invalid", reason: "invalid-evidence" });
  }
  if (!rawPolicies || rawPolicies.length !== claim.evidenceIds.length) {
    return Object.freeze({ status: "invalid", reason: "invalid-policy" });
  }

  const evidence: HoidExactEvidenceRecord[] = [];
  const evidenceById = new Map<string, HoidExactEvidenceRecord>();
  for (const raw of rawEvidence) {
    const item = canonicalEvidence(raw);
    if (!item || evidenceById.has(item.id)) {
      return Object.freeze({ status: "invalid", reason: "invalid-evidence" });
    }
    evidenceById.set(item.id, item);
    evidence.push(item);
  }
  evidence.sort((left, right) => left.id.localeCompare(right.id));

  const policies: HoidExactUnitEvidencePolicy[] = [];
  const policyById = new Map<string, HoidExactUnitEvidencePolicy>();
  for (const raw of rawPolicies) {
    const policy = canonicalizeHoidExactUnitEvidencePolicy(raw);
    if (!policy || policyById.has(policy.evidenceId)) {
      return Object.freeze({ status: "invalid", reason: "invalid-policy" });
    }
    policyById.set(policy.evidenceId, policy);
    policies.push(policy);
  }
  policies.sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));

  if (
    claim.evidenceIds.length !== evidenceById.size ||
    !claim.evidenceIds.every(id => evidenceById.has(id))
  ) return Object.freeze({ status: "invalid", reason: "invalid-evidence" });

  if (
    claim.evidenceIds.length !== policyById.size ||
    !claim.evidenceIds.every(id => policyById.has(id))
  ) return Object.freeze({ status: "invalid", reason: "invalid-policy" });

  const bindings: unknown[] = [];
  for (const evidenceId of claim.evidenceIds) {
    const item = evidenceById.get(evidenceId);
    const policy = policyById.get(evidenceId);
    if (!item || !policy) return Object.freeze({ status: "invalid", reason: "invalid-policy" });
    const documentSha256 = sourceDocumentDigest(policy);
    if (!documentSha256) {
      return Object.freeze({ status: "invalid", reason: "unverified-source" });
    }
    bindings.push(Object.freeze({
      evidenceId,
      source: referenceBinding(policy.source),
      firstSafeAppearance: referenceBinding(policy.firstSafeAppearance),
      unlock: referenceBinding(policy.unlock),
      sourceDocumentSha256: documentSha256,
      kind: item.kind,
      aliasesSha256: sha256Hex(JSON.stringify(item.aliases)),
      provenance: item.provenance,
      summarySha256: sha256Hex(item.summary),
    }));
  }

  return Object.freeze({
    status: "valid",
    bundle: Object.freeze({
      evidence: Object.freeze(evidence),
      policies: Object.freeze(policies),
      bindings: Object.freeze(bindings),
    }),
  });
}

function buildAttestation(
  core: HoidExactApprovedClaimCore,
  bundle: CanonicalBundle,
  reviewer: Readonly<{ reviewerId: string; reviewedAt: string }>,
): HoidExactApprovedClaimAttestationResult {
  const claimSha256 = sha256Hex(JSON.stringify(core));
  const evidenceSha256 = sha256Hex(JSON.stringify(bundle.bindings));
  const reviewCore = Object.freeze({
    schemaVersion: 2 as const,
    status: "approved" as const,
    origin: "original-editorial" as const,
    reviewerId: reviewer.reviewerId,
    reviewedAt: reviewer.reviewedAt,
    claimSha256,
    evidenceSha256,
  });
  const reviewSha256 = sha256Hex(JSON.stringify(reviewCore));
  return Object.freeze({
    status: "valid",
    integrity: Object.freeze({
      schemaVersion: 2,
      claimSha256,
      evidenceSha256,
      reviewSha256,
    }),
    review: reviewCore,
  });
}

/**
 * Create a schema-v2 attestation bound to exact edition/unit identities.
 * The source body must have an inspected digest; ambiguous source labels fail
 * closed until an exact-unit body digest is explicitly added to the allowlist.
 */
export function createHoidExactApprovedClaimAttestation(
  claimInput: unknown,
  evidenceInput: unknown,
  policiesInput: unknown,
  reviewerInput: unknown,
): HoidExactApprovedClaimAttestationResult {
  const core = canonicalCore(claimInput);
  if (!core) return Object.freeze({ status: "invalid", reason: "invalid-claim" });
  const bundleResult = canonicalBundle(core, evidenceInput, policiesInput);
  if (bundleResult.status !== "valid") {
    return Object.freeze({ status: "invalid", reason: bundleResult.reason });
  }
  const reviewer = canonicalReviewer(reviewerInput);
  if (!reviewer) return Object.freeze({ status: "invalid", reason: "invalid-review" });
  return buildAttestation(core, bundleResult.bundle, reviewer);
}

/** Validate a schema-v2 claim and its exact evidence/policy bindings. */
export function validateHoidExactApprovedClaimAttestation(
  claimInput: unknown,
  evidenceInput: unknown,
  policiesInput: unknown,
): HoidExactApprovedClaimValidationResult {
  const record = exactRecord(
    claimInput,
    CLAIM_KEYS,
    ["id", "text", "intent", "evidenceIds", "integrity", "review"],
  );
  if (!record) return Object.freeze({ status: "invalid", reason: "invalid-claim" });

  const rawCore: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of CORE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) rawCore[key] = record[key];
  }
  const core = canonicalCore(rawCore);
  if (!core) return Object.freeze({ status: "invalid", reason: "invalid-claim" });

  const bundleResult = canonicalBundle(core, evidenceInput, policiesInput);
  if (bundleResult.status !== "valid") {
    return Object.freeze({ status: "invalid", reason: bundleResult.reason });
  }

  const integrity = exactRecord(record.integrity, INTEGRITY_KEYS, [
    "schemaVersion", "claimSha256", "evidenceSha256", "reviewSha256",
  ]);
  const review = exactRecord(record.review, REVIEW_KEYS, [
    "schemaVersion", "status", "origin", "reviewerId", "reviewedAt", "claimSha256", "evidenceSha256",
  ]);
  if (!integrity || !review) return Object.freeze({ status: "invalid", reason: "invalid-review" });

  const reviewer = canonicalReviewer({
    reviewerId: review.reviewerId,
    reviewedAt: review.reviewedAt,
  });
  if (
    !reviewer ||
    review.schemaVersion !== 2 ||
    review.status !== "approved" ||
    review.origin !== "original-editorial" ||
    integrity.schemaVersion !== 2 ||
    typeof integrity.claimSha256 !== "string" ||
    !SHA_PATTERN.test(integrity.claimSha256) ||
    typeof integrity.evidenceSha256 !== "string" ||
    !SHA_PATTERN.test(integrity.evidenceSha256) ||
    typeof integrity.reviewSha256 !== "string" ||
    !SHA_PATTERN.test(integrity.reviewSha256)
  ) return Object.freeze({ status: "invalid", reason: "invalid-review" });

  const expected = buildAttestation(core, bundleResult.bundle, reviewer);
  if (expected.status !== "valid") return expected;
  if (
    review.claimSha256 !== expected.review.claimSha256 ||
    review.evidenceSha256 !== expected.review.evidenceSha256 ||
    integrity.claimSha256 !== expected.integrity.claimSha256 ||
    integrity.evidenceSha256 !== expected.integrity.evidenceSha256 ||
    integrity.reviewSha256 !== expected.integrity.reviewSha256
  ) return Object.freeze({ status: "invalid", reason: "integrity-mismatch" });

  return Object.freeze({
    status: "valid",
    claim: Object.freeze({
      ...core,
      integrity: expected.integrity,
      review: expected.review,
    }),
  });
}
