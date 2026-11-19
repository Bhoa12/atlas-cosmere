import type { HoidKnowledgeKind } from "./catalog";
import { isHoidKnowledgeKind } from "./knowledgeKinds";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { canonicalEvidenceScope } from "./evidenceScope";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import { sha256Hex } from "./sha256";
import type { ReadingPosition } from "./types";

export type HoidEditorialClaimAssertionKind =
  | "identity"
  | "appearance"
  | "ability"
  | "limitation"
  | "relationship"
  | "event"
  | "location"
  | "interpretation";

export type HoidEditorialClaimEvidence = Readonly<{
  source: Readonly<{ bookId: string; chapter: number; locatorId: string }>;
  unlock: Readonly<{ bookId: string; chapter: number }>;
  sourceIntegrity: Readonly<{
    editionId: string;
    navigationSha256: string;
    documentSha256: string;
  }>;
}>;

/**
 * A staging-only, atomic editorial assertion. Every evidence item is a
 * mandatory requirement (logical AND); no statement is exposed to a provider
 * by this module. Only individually inspected chapter documents are accepted.
 */
export type HoidEditorialClaimDraft = Readonly<{
  schemaVersion: 1;
  id: string;
  subjectId: string;
  subjectKind: HoidKnowledgeKind;
  assertionKind: HoidEditorialClaimAssertionKind;
  intent: "explain" | "context" | "recommend";
  statement: string;
  evidence: readonly HoidEditorialClaimEvidence[];
  integrity: Readonly<{ statementSha256: string; claimSha256: string }>;
  review: Readonly<{ status: "pending-review" }>;
}>;

export type HoidEditorialClaimDraftResult =
  | Readonly<{ status: "valid"; draft: HoidEditorialClaimDraft }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-shape" | "invalid-evidence" | "invalid-integrity" | "invalid-review";
    }>;

export type HoidEditorialClaimBatchResult =
  | Readonly<{ status: "valid"; drafts: readonly HoidEditorialClaimDraft[] }>
  | Readonly<{ status: "invalid"; reason: "invalid-batch" | "duplicate-id" | "invalid-draft" }>;

export type HoidEditorialClaimEvaluation =
  | Readonly<{
      status: "eligible-for-review";
      claimId: string;
      missingRequirements: readonly [];
    }>
  | Readonly<{
      status: "withheld";
      claimId: string;
      missingRequirements: readonly Readonly<{ bookId: string; chapter: number }>[];
    }>;

export type HoidEditorialClaimEvaluationResult =
  | Readonly<{ status: "ready"; evaluations: readonly HoidEditorialClaimEvaluation[] }>
  | Readonly<{ status: "unavailable"; reason: "invalid-claims" | "invalid-progress" }>;

const CORE_KEYS = new Set([
  "id", "subjectId", "subjectKind", "assertionKind", "intent", "statement", "evidence",
]);
const DRAFT_KEYS = new Set([
  "schemaVersion", ...CORE_KEYS, "integrity", "review",
]);
const EVIDENCE_KEYS = new Set(["source", "unlock", "sourceIntegrity"]);
const SOURCE_KEYS = new Set(["bookId", "chapter", "locatorId"]);
const UNLOCK_KEYS = new Set(["bookId", "chapter"]);
const SOURCE_INTEGRITY_KEYS = new Set(["editionId", "navigationSha256", "documentSha256"]);
const INTEGRITY_KEYS = new Set(["statementSha256", "claimSha256"]);
const REVIEW_KEYS = new Set(["status"]);
const ASSERTION_KINDS = new Set<HoidEditorialClaimAssertionKind>([
  "identity", "appearance", "ability", "limitation", "relationship", "event", "location", "interpretation",
]);
const INTENTS = new Set(["explain", "context", "recommend"]);
const MAX_EVIDENCE = 8;
const MAX_CLAIM_LENGTH = 1_200;

type ClaimCore = Readonly<{
  id: string;
  subjectId: string;
  subjectKind: HoidKnowledgeKind;
  assertionKind: HoidEditorialClaimAssertionKind;
  intent: "explain" | "context" | "recommend";
  statement: string;
  evidence: readonly HoidEditorialClaimEvidence[];
}>;

function canonicalRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.size) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of allowedKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalArray(value: unknown, min: number, max: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length < min || value.length > max) return null;
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
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function canonicalEvidence(value: unknown): HoidEditorialClaimEvidence | null {
  const raw = canonicalRecord(value, EVIDENCE_KEYS);
  if (!raw) return null;

  const source = canonicalRecord(raw.source, SOURCE_KEYS);
  const unlock = canonicalRecord(raw.unlock, UNLOCK_KEYS);
  const integrity = canonicalRecord(raw.sourceIntegrity, SOURCE_INTEGRITY_KEYS);
  if (!source || !unlock || !integrity) return null;

  const bookId = typeof source.bookId === "string" ? source.bookId : "";
  const locatorId = typeof source.locatorId === "string" ? source.locatorId : "";
  const unlockBookId = typeof unlock.bookId === "string" ? unlock.bookId : "";
  const chapter = source.chapter;
  const unlockChapter = unlock.chapter;
  const editionId = typeof integrity.editionId === "string" ? integrity.editionId : "";
  const navigationSha256 = typeof integrity.navigationSha256 === "string" ? integrity.navigationSha256 : "";
  const documentSha256 = typeof integrity.documentSha256 === "string" ? integrity.documentSha256 : "";

  if (
    !bookId || bookId !== bookId.trim() ||
    !locatorId || locatorId !== locatorId.trim() ||
    !editionId || editionId !== editionId.trim() ||
    !/^[a-f0-9]{64}$/.test(navigationSha256) ||
    !/^[a-f0-9]{64}$/.test(documentSha256) ||
    typeof chapter !== "number" || !Number.isSafeInteger(chapter) || chapter < 1 ||
    typeof unlockChapter !== "number" || !Number.isSafeInteger(unlockChapter) || unlockChapter < 1
  ) return null;

  const scope = canonicalEvidenceScope(
    { bookId, chapter, locatorId },
    { bookId: unlockBookId, chapter: unlockChapter },
  );
  if (!scope) return null;

  const manifestResult = getHoidReadingManifest(bookId);
  if (manifestResult.status !== "ready") return null;
  const manifest = manifestResult.manifest;
  const verifiedDocumentSha256 = getVerifiedChapterDocumentSha256(
    bookId,
    manifest.editionId,
    manifest.navigationSha256,
    chapter,
  );

  if (
    integrity.editionId !== manifest.editionId ||
    navigationSha256 !== manifest.navigationSha256 ||
    !verifiedDocumentSha256 ||
    documentSha256 !== verifiedDocumentSha256
  ) return null;

  return Object.freeze({
    source: Object.freeze({ bookId, chapter, locatorId }),
    unlock: Object.freeze({ bookId, chapter: unlockChapter }),
    sourceIntegrity: Object.freeze({ editionId, navigationSha256, documentSha256 }),
  });
}

function compareEvidence(a: HoidEditorialClaimEvidence, b: HoidEditorialClaimEvidence): number {
  const left = a.source.bookId + "\n" + String(a.source.chapter).padStart(10, "0") + "\n" + a.source.locatorId;
  const right = b.source.bookId + "\n" + String(b.source.chapter).padStart(10, "0") + "\n" + b.source.locatorId;
  return left < right ? -1 : left > right ? 1 : 0;
}

function claimCanonicalPayload(core: ClaimCore): string {
  return JSON.stringify([
    "hoid-editorial-atomic-claim-v1",
    core.id,
    core.subjectId,
    core.subjectKind,
    core.assertionKind,
    core.intent,
    core.statement,
    core.evidence.map(item => [
      item.source.bookId,
      item.source.chapter,
      item.source.locatorId,
      item.unlock.bookId,
      item.unlock.chapter,
      item.sourceIntegrity.editionId,
      item.sourceIntegrity.navigationSha256,
      item.sourceIntegrity.documentSha256,
    ]),
  ]);
}

function canonicalCore(value: unknown): ClaimCore | null {
  const raw = canonicalRecord(value, CORE_KEYS);
  if (!raw) return null;

  const id = typeof raw.id === "string" ? raw.id : "";
  const subjectId = typeof raw.subjectId === "string" ? raw.subjectId : "";
  const statement = typeof raw.statement === "string" ? raw.statement : "";
  if (
    !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id) || id.length > 128 ||
    !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(subjectId) || subjectId.length > 128
  ) return null;

  if (
    !isHoidKnowledgeKind(raw.subjectKind) ||
    typeof raw.assertionKind !== "string" || !ASSERTION_KINDS.has(raw.assertionKind as HoidEditorialClaimAssertionKind) ||
    typeof raw.intent !== "string" || !INTENTS.has(raw.intent)
  ) return null;

  if (
    statement !== statement.trim() ||
    statement.length < 20 ||
    statement.length > MAX_CLAIM_LENGTH ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(statement)
  ) return null;

  const rawEvidence = canonicalArray(raw.evidence, 1, MAX_EVIDENCE);
  if (!rawEvidence) return null;
  const evidence: HoidEditorialClaimEvidence[] = [];
  const seen = new Set<string>();
  for (const item of rawEvidence) {
    const canonical = canonicalEvidence(item);
    if (!canonical) return null;
    const key = canonical.source.bookId + ":" + canonical.source.chapter + ":" + canonical.source.locatorId;
    if (seen.has(key)) return null;
    seen.add(key);
    evidence.push(canonical);
  }
  evidence.sort(compareEvidence);

  return Object.freeze({
    id,
    subjectId,
    subjectKind: raw.subjectKind as HoidKnowledgeKind,
    assertionKind: raw.assertionKind as HoidEditorialClaimAssertionKind,
    intent: raw.intent as ClaimCore["intent"],
    statement,
    evidence: Object.freeze(evidence),
  });
}

/**
 * Create an unsigned staging draft from a single original assertion.
 * The digest detects accidental or post-review mutation; it is not a digital
 * signature and does not authenticate the author or reviewer.
 */
export function createHoidEditorialClaimDraft(value: unknown): HoidEditorialClaimDraftResult {
  const core = canonicalCore(value);
  if (!core) return Object.freeze({ status: "invalid", reason: "invalid-evidence" });

  const integrity = Object.freeze({
    statementSha256: sha256Hex(core.statement),
    claimSha256: sha256Hex(claimCanonicalPayload(core)),
  });
  const candidate = {
    schemaVersion: 1 as const,
    ...core,
    integrity,
    review: Object.freeze({ status: "pending-review" as const }),
  };
  return validateHoidEditorialClaimDraft(candidate);
}

/** Validate a staging claim against every exact edition-bound source document. */
export function validateHoidEditorialClaimDraft(value: unknown): HoidEditorialClaimDraftResult {
  const raw = canonicalRecord(value, DRAFT_KEYS);
  if (!raw || raw.schemaVersion !== 1) {
    return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  }

  const core = canonicalCore({
    id: raw.id,
    subjectId: raw.subjectId,
    subjectKind: raw.subjectKind,
    assertionKind: raw.assertionKind,
    intent: raw.intent,
    statement: raw.statement,
    evidence: raw.evidence,
  });
  if (!core) return Object.freeze({ status: "invalid", reason: "invalid-evidence" });

  const integrity = canonicalRecord(raw.integrity, INTEGRITY_KEYS);
  if (
    !integrity ||
    typeof integrity.statementSha256 !== "string" ||
    typeof integrity.claimSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(integrity.statementSha256) ||
    !/^[a-f0-9]{64}$/.test(integrity.claimSha256) ||
    integrity.statementSha256 !== sha256Hex(core.statement) ||
    integrity.claimSha256 !== sha256Hex(claimCanonicalPayload(core))
  ) return Object.freeze({ status: "invalid", reason: "invalid-integrity" });

  const review = canonicalRecord(raw.review, REVIEW_KEYS);
  if (!review || review.status !== "pending-review") {
    return Object.freeze({ status: "invalid", reason: "invalid-review" });
  }

  return Object.freeze({
    status: "valid",
    draft: Object.freeze({
      schemaVersion: 1,
      ...core,
      integrity: Object.freeze({
        statementSha256: integrity.statementSha256,
        claimSha256: integrity.claimSha256,
      }),
      review: Object.freeze({ status: "pending-review" }),
    }),
  });
}

/** Validate a complete batch; one invalid claim rejects the whole batch. */
export function validateHoidEditorialClaimDraftBatch(value: unknown): HoidEditorialClaimBatchResult {
  const items = canonicalArray(value, 0, 512);
  if (!items) return Object.freeze({ status: "invalid", reason: "invalid-batch" });

  const drafts: HoidEditorialClaimDraft[] = [];
  const ids = new Set<string>();
  for (const item of items) {
    const result = validateHoidEditorialClaimDraft(item);
    if (result.status !== "valid") {
      return Object.freeze({ status: "invalid", reason: "invalid-draft" });
    }
    if (ids.has(result.draft.id)) {
      return Object.freeze({ status: "invalid", reason: "duplicate-id" });
    }
    ids.add(result.draft.id);
    drafts.push(result.draft);
  }
  drafts.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return Object.freeze({ status: "valid", drafts: Object.freeze(drafts) });
}

/**
 * Evaluate staging claims for review eligibility from the authoritative v2
 * cursor snapshot. The existing cursor boundary performs manifest validation
 * and projects chapter N to completed-through N-1 before any requirement is
 * evaluated. Every evidence unlock is a mandatory requirement. The result
 * deliberately omits assertion text and is not a provider-context API.
 */
export function evaluateHoidEditorialClaimDrafts(
  claimsInput: unknown,
  cursorProgressSnapshot: unknown,
): HoidEditorialClaimEvaluationResult {
  const batch = validateHoidEditorialClaimDraftBatch(claimsInput);
  if (batch.status !== "valid") {
    return Object.freeze({ status: "unavailable", reason: "invalid-claims" });
  }

  const projection = projectHoidCursorProgressSnapshot(cursorProgressSnapshot);
  if (projection.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  }
  const reading = projection.reading;

  const positions = new Map(reading.map(position => [position.bookId, position]));
  const evaluations = batch.drafts.map(draft => {
    const missing = draft.evidence
      .filter(item => {
        const position = positions.get(item.unlock.bookId);
        return !position || (
          position.completed !== true &&
          (typeof position.chapter !== "number" || position.chapter < item.unlock.chapter)
        );
      })
      .map(item => Object.freeze({
        bookId: item.unlock.bookId,
        chapter: item.unlock.chapter,
      }));

    return missing.length === 0
      ? Object.freeze({
          status: "eligible-for-review" as const,
          claimId: draft.id,
          missingRequirements: Object.freeze([]) as readonly [],
        })
      : Object.freeze({
          status: "withheld" as const,
          claimId: draft.id,
          missingRequirements: Object.freeze(missing),
        });
  });

  return Object.freeze({ status: "ready", evaluations: Object.freeze(evaluations) });
}

/**
 * First source-backed atomic Cosmere assertion. It remains staging-only:
 * the approved production registry is not imported or modified here.
 */
const RAW_EDITORIAL_CLAIM_DRAFTS: readonly unknown[] = Object.freeze([
  Object.freeze({
    schemaVersion: 1,
    id: "tfe.vin.ability.emotional-allomancy",
    subjectId: "tfe.vin",
    subjectKind: "character",
    assertionKind: "ability",
    intent: "explain",
    statement: "Kelsier reconoce indicios de que Vin utiliza alomancia para alterar las emociones de otras personas y considera que ella quizá todavía no comprende conscientemente esa capacidad.",
    evidence: Object.freeze([
      Object.freeze({
        source: Object.freeze({
          bookId: "tfe",
          chapter: 2,
          locatorId: "nav:cosmere-epub-merged-v1:85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee:books/b000001/OEBPS/Text/002.xhtml",
        }),
        unlock: Object.freeze({ bookId: "tfe", chapter: 2 }),
        sourceIntegrity: Object.freeze({
          editionId: "cosmere-epub-merged-v1",
          navigationSha256: "85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee",
          documentSha256: "13604dc85df709443e6cd215a3e1a9deabe8f69f118dcc9823127b82ad486fc1",
        }),
      }),
    ]),
    integrity: Object.freeze({
      statementSha256: "b2bb4bd4bb7a7d7fd5fbc8145d83d94d51426ba7e12fde779cb905c265767a31",
      claimSha256: "4bc755045c563fa74ae6bb996ae854283b54e56d1c5f9c9e5d88c63fc6c4ec57",
    }),
    review: Object.freeze({ status: "pending-review" }),
  }),
]);

const VALIDATED_EDITORIAL_CLAIM_DRAFTS = validateHoidEditorialClaimDraftBatch(
  RAW_EDITORIAL_CLAIM_DRAFTS,
);

/** Source-backed atomic assertions remain separate from approved production claims. */
export const HOID_EDITORIAL_CLAIM_DRAFTS: readonly HoidEditorialClaimDraft[] =
  VALIDATED_EDITORIAL_CLAIM_DRAFTS.status === "valid"
    ? VALIDATED_EDITORIAL_CLAIM_DRAFTS.drafts
    : Object.freeze([]);

export function getHoidEditorialClaimDraftStatus(): "empty" | "pending-review" | "invalid" {
  if (VALIDATED_EDITORIAL_CLAIM_DRAFTS.status === "invalid") return "invalid";
  return HOID_EDITORIAL_CLAIM_DRAFTS.length > 0 ? "pending-review" : "empty";
}
