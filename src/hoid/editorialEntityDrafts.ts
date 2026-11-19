import type { HoidKnowledgeKind } from "./catalog";
import { isHoidKnowledgeKind } from "./knowledgeKinds";
import {
  createHoidEditorialClaimDraft,
  evaluateHoidEditorialClaimDrafts,
  type HoidEditorialClaimEvidence,
} from "./editorialClaimDrafts";
import {
  buildHoidEditorialRelationshipReviewPackets,
  evaluateHoidEditorialRelationshipDrafts,
  validateHoidEditorialRelationshipDraftBatch,
  validateHoidEditorialRelationshipReviewReceipt,
  type HoidEditorialRelationshipDraft,
  type HoidEditorialRelationshipReviewPacket,
} from "./editorialRelationshipDrafts";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import { sha256Hex } from "./sha256";

export type HoidEditorialEntityIdentity =
  | Readonly<{ status: "resolved"; canonicalLabel: string }>
  | Readonly<{ status: "unresolved"; issueCode: "identity-not-established" }>;

export type HoidEditorialEntityDraft = Readonly<{
  schemaVersion: 1;
  id: string;
  kind: HoidKnowledgeKind;
  identity: HoidEditorialEntityIdentity;
  evidence: readonly HoidEditorialClaimEvidence[];
  integrity: Readonly<{ identitySha256: string; draftSha256: string }>;
  review: Readonly<{ status: "pending-review" }>;
}>;

export type HoidEditorialEntityChecklist = Readonly<{
  factualAccuracy: boolean;
  identityResolution: boolean;
  uniqueness: boolean;
  completeness: boolean;
  spoilerCeiling: boolean;
  provenance: boolean;
}>;

export type HoidEditorialEntityReviewPacket = Readonly<{
  schemaVersion: 1;
  packetId: string;
  draftId: string;
  identitySha256: string;
  draftSha256: string;
  kind: HoidKnowledgeKind;
  identity: HoidEditorialEntityIdentity;
  evidence: readonly HoidEditorialClaimEvidence[];
  checklist: HoidEditorialEntityChecklist;
  status: "pending-review";
}>;

export type HoidEditorialEntityReviewReceipt = Readonly<{
  schemaVersion: 1;
  packetId: string;
  draftId: string;
  identitySha256: string;
  draftSha256: string;
  decision: "approved" | "revision-required" | "rejected";
  reviewerId: string;
  reviewedAt: string;
  checklist: HoidEditorialEntityChecklist;
  noteCodes: readonly string[];
}>;

export type HoidEditorialEntityValidation =
  | Readonly<{ status: "valid"; draft: HoidEditorialEntityDraft }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-shape"
        | "invalid-identity"
        | "invalid-evidence"
        | "invalid-integrity"
        | "invalid-review";
    }>;

export type HoidEditorialEntityBatchResult =
  | Readonly<{ status: "valid"; drafts: readonly HoidEditorialEntityDraft[] }>
  | Readonly<{ status: "invalid"; reason: "invalid-batch" | "duplicate-id" | "invalid-draft" }>;

export type HoidEditorialEntityPacketResult =
  | Readonly<{ status: "ready"; packets: readonly HoidEditorialEntityReviewPacket[] }>
  | Readonly<{ status: "invalid"; reason: "invalid-batch" | "duplicate-id" | "invalid-draft" }>;

export type HoidEditorialEntityReceiptResult =
  | Readonly<{
      status: "valid";
      outcome: "approved-awaiting-source-promotion" | "revision-required" | "rejected";
      promotionAllowed: false;
      receipt: HoidEditorialEntityReviewReceipt;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-packet"
        | "invalid-receipt-shape"
        | "packet-mismatch"
        | "invalid-reviewer"
        | "invalid-date"
        | "invalid-checklist"
        | "incomplete-approval";
    }>;

export type HoidEditorialEntityEvaluation =
  | Readonly<{
      status: "eligible-for-review";
      entityId: string;
      missingRequirements: readonly [];
    }>
  | Readonly<{
      status: "withheld";
      entityId: string;
      reason: "identity-unresolved" | "evidence-locked";
      missingRequirements: readonly Readonly<{ bookId: string; chapter: number }>[];
    }>;

export type HoidEditorialEntityEvaluationResult =
  | Readonly<{ status: "ready"; evaluations: readonly HoidEditorialEntityEvaluation[] }>
  | Readonly<{ status: "unavailable"; reason: "invalid-entities" | "invalid-progress" }>;

export type HoidEditorialPromotionBlocker = Readonly<{
  code:
    | "unresolved-identity"
    | "missing-entity"
    | "entity-kind-mismatch"
    | "entity-evidence-mismatch"
    | "missing-entity-review"
    | "entity-review-not-approved"
    | "entity-evidence-locked"
    | "missing-relationship-review"
    | "relationship-review-not-approved"
    | "relationship-evidence-locked";
  recordId: string;
  relatedId?: string;
}>;

export type HoidEditorialPromotionPlan =
  | Readonly<{
      status: "blocked";
      reason: "invalid-entities" | "invalid-relationships" | "invalid-receipts" | "invalid-progress" | "promotion-gates";
      blockers: readonly HoidEditorialPromotionBlocker[];
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "ready-for-maintainer-commit";
      entityIds: readonly string[];
      relationshipIds: readonly string[];
      progressRevision: number;
      progressFingerprint: string;
      requiresProtectedReview: true;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const CORE_KEYS = new Set(["id", "kind", "identity", "evidence"]);
const DRAFT_KEYS = new Set(["schemaVersion", ...CORE_KEYS, "integrity", "review"]);
const INTEGRITY_KEYS = new Set(["identitySha256", "draftSha256"]);
const REVIEW_KEYS = new Set(["status"]);
const PACKET_KEYS = new Set([
  "schemaVersion", "packetId", "draftId", "identitySha256", "draftSha256",
  "kind", "identity", "evidence", "checklist", "status",
]);
const CHECKLIST_KEYS = new Set([
  "factualAccuracy", "identityResolution", "uniqueness",
  "completeness", "spoilerCeiling", "provenance",
]);
const RECEIPT_KEYS = new Set([
  "schemaVersion", "packetId", "draftId", "identitySha256", "draftSha256",
  "decision", "reviewerId", "reviewedAt", "checklist", "noteCodes",
]);
const RELATIONSHIP_RECEIPT_KEYS = new Set([
  "schemaVersion", "packetId", "draftId", "claimSha256",
  "decision", "reviewerId", "reviewedAt", "checklist", "noteCodes",
]);
const NOTE_CODES = new Set([
  "no-issues",
  "factual-issue",
  "identity-issue",
  "duplicate-identity",
  "completeness-issue",
  "spoiler-scope-issue",
  "provenance-issue",
]);
const MAX_EVIDENCE = 8;
const MAX_ENTITIES = 512;
const MAX_LABEL_LENGTH = 128;

type EntityCore = Readonly<{
  id: string;
  kind: HoidKnowledgeKind;
  identity: HoidEditorialEntityIdentity;
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

function canonicalDenseArray(value: unknown, min: number, max: number): readonly unknown[] | null {
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

function canonicalIdentity(value: unknown): HoidEditorialEntityIdentity | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const status = Object.getOwnPropertyDescriptor(value, "status");
    if (!status || !Object.prototype.hasOwnProperty.call(status, "value")) return null;
    if (status.value === "resolved") {
      const raw = canonicalRecord(value, new Set(["status", "canonicalLabel"]));
      const label = raw?.canonicalLabel;
      if (
        !raw ||
        typeof label !== "string" ||
        label.length < 2 ||
        label.length > MAX_LABEL_LENGTH ||
        label !== label.trim() ||
        /[\u0000-\u001F\u007F\p{Cf}]/u.test(label)
      ) return null;
      return Object.freeze({ status: "resolved", canonicalLabel: label });
    }
    if (status.value === "unresolved") {
      const raw = canonicalRecord(value, new Set(["status", "issueCode"]));
      if (!raw || raw.issueCode !== "identity-not-established") return null;
      return Object.freeze({ status: "unresolved", issueCode: "identity-not-established" });
    }
    return null;
  } catch {
    return null;
  }
}

function evidenceTuple(value: HoidEditorialClaimEvidence): readonly unknown[] {
  return Object.freeze([
    value.source.bookId,
    value.source.chapter,
    value.source.locatorId,
    value.unlock.bookId,
    value.unlock.chapter,
    value.sourceIntegrity.editionId,
    value.sourceIntegrity.navigationSha256,
    value.sourceIntegrity.documentSha256,
  ]);
}

function identityPayload(core: EntityCore): string {
  return JSON.stringify([
    "hoid-editorial-entity-identity-v1",
    core.id,
    core.kind,
    core.identity,
  ]);
}

function draftPayload(core: EntityCore): string {
  return JSON.stringify([
    "hoid-editorial-entity-draft-v1",
    core.id,
    core.kind,
    core.identity,
    core.evidence.map(evidenceTuple),
  ]);
}

function normalizeCore(value: unknown):
  | Readonly<{ status: "valid"; core: EntityCore }>
  | Readonly<{ status: "invalid"; reason: "invalid-shape" | "invalid-identity" | "invalid-evidence" }> {
  const raw = canonicalRecord(value, CORE_KEYS);
  if (!raw) return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  const id = typeof raw.id === "string" ? raw.id : "";
  if (
    !ID_PATTERN.test(id) ||
    id.length > 128 ||
    !isHoidKnowledgeKind(raw.kind)
  ) return Object.freeze({ status: "invalid", reason: "invalid-identity" });
  const identity = canonicalIdentity(raw.identity);
  if (!identity) return Object.freeze({ status: "invalid", reason: "invalid-identity" });
  const rawEvidence = canonicalDenseArray(raw.evidence, 1, MAX_EVIDENCE);
  if (!rawEvidence) return Object.freeze({ status: "invalid", reason: "invalid-evidence" });

  const statement = identity.status === "resolved"
    ? "Identidad editorial propuesta: " + identity.canonicalLabel + "."
    : "La identidad de esta referencia todavía no está establecida.";
  const evidenceValidation = createHoidEditorialClaimDraft({
    id: "entity.identity-validation",
    subjectId: id,
    subjectKind: raw.kind as HoidKnowledgeKind,
    assertionKind: "identity",
    intent: "context",
    statement,
    evidence: rawEvidence as readonly HoidEditorialClaimEvidence[],
  });
  if (evidenceValidation.status !== "valid") {
    return Object.freeze({ status: "invalid", reason: "invalid-evidence" });
  }
  const inputEvidence = rawEvidence as readonly HoidEditorialClaimEvidence[];
  if (
    inputEvidence.length !== evidenceValidation.draft.evidence.length ||
    inputEvidence.some((item, index) =>
      JSON.stringify(evidenceTuple(item)) !== JSON.stringify(evidenceTuple(evidenceValidation.draft.evidence[index])),
    )
  ) return Object.freeze({ status: "invalid", reason: "invalid-evidence" });

  return Object.freeze({
    status: "valid",
    core: Object.freeze({
      id,
      kind: raw.kind as HoidKnowledgeKind,
      identity,
      evidence: evidenceValidation.draft.evidence,
    }),
  });
}

export function createHoidEditorialEntityDraft(value: unknown): HoidEditorialEntityValidation {
  const normalized = normalizeCore(value);
  if (normalized.status !== "valid") return normalized;
  const integrity = Object.freeze({
    identitySha256: sha256Hex(identityPayload(normalized.core)),
    draftSha256: sha256Hex(draftPayload(normalized.core)),
  });
  return validateHoidEditorialEntityDraft({
    schemaVersion: 1,
    ...normalized.core,
    integrity,
    review: Object.freeze({ status: "pending-review" }),
  });
}

export function validateHoidEditorialEntityDraft(value: unknown): HoidEditorialEntityValidation {
  const raw = canonicalRecord(value, DRAFT_KEYS);
  if (!raw || raw.schemaVersion !== 1) {
    return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  }
  const coreInput = Object.create(null) as Record<string, unknown>;
  for (const key of CORE_KEYS) coreInput[key] = raw[key];
  const normalized = normalizeCore(coreInput);
  if (normalized.status !== "valid") return normalized;
  const integrity = canonicalRecord(raw.integrity, INTEGRITY_KEYS);
  if (
    !integrity ||
    typeof integrity.identitySha256 !== "string" ||
    typeof integrity.draftSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(integrity.identitySha256) ||
    !/^[a-f0-9]{64}$/.test(integrity.draftSha256) ||
    integrity.identitySha256 !== sha256Hex(identityPayload(normalized.core)) ||
    integrity.draftSha256 !== sha256Hex(draftPayload(normalized.core))
  ) return Object.freeze({ status: "invalid", reason: "invalid-integrity" });
  const review = canonicalRecord(raw.review, REVIEW_KEYS);
  if (!review || review.status !== "pending-review") {
    return Object.freeze({ status: "invalid", reason: "invalid-review" });
  }
  return Object.freeze({
    status: "valid",
    draft: Object.freeze({
      schemaVersion: 1,
      ...normalized.core,
      integrity: Object.freeze({
        identitySha256: integrity.identitySha256,
        draftSha256: integrity.draftSha256,
      }),
      review: Object.freeze({ status: "pending-review" }),
    }),
  });
}

function collectBatch(value: unknown, createCoreInputs: boolean): HoidEditorialEntityBatchResult {
  const raw = canonicalDenseArray(value, 0, MAX_ENTITIES);
  if (!raw) return Object.freeze({ status: "invalid", reason: "invalid-batch" });
  const drafts: HoidEditorialEntityDraft[] = [];
  const ids = new Set<string>();
  for (const item of raw) {
    const result = createCoreInputs
      ? createHoidEditorialEntityDraft(item)
      : validateHoidEditorialEntityDraft(item);
    if (result.status !== "valid") return Object.freeze({ status: "invalid", reason: "invalid-draft" });
    if (ids.has(result.draft.id)) return Object.freeze({ status: "invalid", reason: "duplicate-id" });
    ids.add(result.draft.id);
    drafts.push(result.draft);
  }
  drafts.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  return Object.freeze({ status: "valid", drafts: Object.freeze(drafts) });
}

export function createHoidEditorialEntityDraftBatch(value: unknown): HoidEditorialEntityBatchResult {
  return collectBatch(value, true);
}

export function validateHoidEditorialEntityDraftBatch(value: unknown): HoidEditorialEntityBatchResult {
  return collectBatch(value, false);
}

function toClaimDraft(draft: HoidEditorialEntityDraft) {
  const statement = draft.identity.status === "resolved"
    ? "Identidad editorial propuesta: " + draft.identity.canonicalLabel + "."
    : "La identidad de esta referencia todavía no está establecida.";
  return createHoidEditorialClaimDraft({
    id: draft.id,
    subjectId: draft.id,
    subjectKind: draft.kind,
    assertionKind: "identity",
    intent: "context",
    statement,
    evidence: draft.evidence,
  });
}

export function evaluateHoidEditorialEntityDrafts(
  value: unknown,
  cursorProgressSnapshot: unknown,
): HoidEditorialEntityEvaluationResult {
  const batch = validateHoidEditorialEntityDraftBatch(value);
  if (batch.status !== "valid") return Object.freeze({ status: "unavailable", reason: "invalid-entities" });
  const claimResults = batch.drafts.map(toClaimDraft);
  if (claimResults.some(item => item.status !== "valid")) {
    return Object.freeze({ status: "unavailable", reason: "invalid-entities" });
  }
  const evaluation = evaluateHoidEditorialClaimDrafts(
    claimResults.map(item => item.status === "valid" ? item.draft : null),
    cursorProgressSnapshot,
  );
  if (evaluation.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  }
  const byId = new Map(evaluation.evaluations.map(item => [item.claimId, item]));
  return Object.freeze({
    status: "ready",
    evaluations: Object.freeze(batch.drafts.map(draft => {
      if (draft.identity.status !== "resolved") {
        return Object.freeze({
          status: "withheld" as const,
          entityId: draft.id,
          reason: "identity-unresolved" as const,
          missingRequirements: Object.freeze([]),
        });
      }
      const item = byId.get(draft.id);
      if (!item || item.status === "withheld") {
        return Object.freeze({
          status: "withheld" as const,
          entityId: draft.id,
          reason: "evidence-locked" as const,
          missingRequirements: item?.missingRequirements ?? Object.freeze([]),
        });
      }
      return Object.freeze({
        status: "eligible-for-review" as const,
        entityId: draft.id,
        missingRequirements: Object.freeze([]) as readonly [],
      });
    })),
  });
}

function emptyChecklist(): HoidEditorialEntityChecklist {
  return Object.freeze({
    factualAccuracy: false,
    identityResolution: false,
    uniqueness: false,
    completeness: false,
    spoilerCeiling: false,
    provenance: false,
  });
}

function checklistValues(value: HoidEditorialEntityChecklist): readonly boolean[] {
  return Object.freeze([
    value.factualAccuracy,
    value.identityResolution,
    value.uniqueness,
    value.completeness,
    value.spoilerCeiling,
    value.provenance,
  ]);
}

function packetIdentity(draft: HoidEditorialEntityDraft): string {
  return sha256Hex(JSON.stringify([
    "hoid-editorial-entity-review-v1",
    draft.id,
    draft.integrity.identitySha256,
    draft.integrity.draftSha256,
  ]));
}

function packetFromDraft(draft: HoidEditorialEntityDraft): HoidEditorialEntityReviewPacket {
  return Object.freeze({
    schemaVersion: 1,
    packetId: packetIdentity(draft),
    draftId: draft.id,
    identitySha256: draft.integrity.identitySha256,
    draftSha256: draft.integrity.draftSha256,
    kind: draft.kind,
    identity: draft.identity,
    evidence: draft.evidence,
    checklist: emptyChecklist(),
    status: "pending-review",
  });
}

export function buildHoidEditorialEntityReviewPackets(value: unknown): HoidEditorialEntityPacketResult {
  const batch = validateHoidEditorialEntityDraftBatch(value);
  if (batch.status !== "valid") return batch;
  return Object.freeze({
    status: "ready",
    packets: Object.freeze(batch.drafts.map(packetFromDraft)),
  });
}

function canonicalChecklist(value: unknown): HoidEditorialEntityChecklist | null {
  const raw = canonicalRecord(value, CHECKLIST_KEYS);
  if (!raw) return null;
  for (const key of CHECKLIST_KEYS) {
    if (typeof raw[key] !== "boolean") return null;
  }
  return Object.freeze({
    factualAccuracy: raw.factualAccuracy as boolean,
    identityResolution: raw.identityResolution as boolean,
    uniqueness: raw.uniqueness as boolean,
    completeness: raw.completeness as boolean,
    spoilerCeiling: raw.spoilerCeiling as boolean,
    provenance: raw.provenance as boolean,
  });
}

function allChecksPassed(value: HoidEditorialEntityChecklist): boolean {
  return checklistValues(value).every(Boolean);
}

function canonicalNoteCodes(value: unknown): readonly string[] | null {
  const raw = canonicalDenseArray(value, 1, 7);
  if (!raw) return null;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string" || !NOTE_CODES.has(item) || seen.has(item)) return null;
    seen.add(item);
    result.push(item);
  }
  return Object.freeze(result);
}

function canonicalPacket(value: unknown): HoidEditorialEntityReviewPacket | null {
  const raw = canonicalRecord(value, PACKET_KEYS);
  if (!raw || raw.schemaVersion !== 1 || raw.status !== "pending-review") return null;
  const checklist = canonicalChecklist(raw.checklist);
  if (!checklist || checklistValues(checklist).some(Boolean)) return null;
  const reconstructed = validateHoidEditorialEntityDraft({
    schemaVersion: 1,
    id: raw.draftId,
    kind: raw.kind,
    identity: raw.identity,
    evidence: raw.evidence,
    integrity: {
      identitySha256: raw.identitySha256,
      draftSha256: raw.draftSha256,
    },
    review: { status: "pending-review" },
  });
  if (reconstructed.status !== "valid") return null;
  const expected = packetFromDraft(reconstructed.draft);
  return typeof raw.packetId === "string" && raw.packetId === expected.packetId
    ? expected
    : null;
}

export function validateHoidEditorialEntityReviewReceipt(
  packetInput: unknown,
  receiptInput: unknown,
): HoidEditorialEntityReceiptResult {
  const packet = canonicalPacket(packetInput);
  if (!packet) return Object.freeze({ status: "invalid", reason: "invalid-packet" });
  const raw = canonicalRecord(receiptInput, RECEIPT_KEYS);
  if (!raw || raw.schemaVersion !== 1) {
    return Object.freeze({ status: "invalid", reason: "invalid-receipt-shape" });
  }
  if (
    raw.packetId !== packet.packetId ||
    raw.draftId !== packet.draftId ||
    raw.identitySha256 !== packet.identitySha256 ||
    raw.draftSha256 !== packet.draftSha256
  ) return Object.freeze({ status: "invalid", reason: "packet-mismatch" });

  const reviewerId = typeof raw.reviewerId === "string" ? raw.reviewerId.trim() : "";
  if (!reviewerId || reviewerId.length > 128 || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/i.test(reviewerId)) {
    return Object.freeze({ status: "invalid", reason: "invalid-reviewer" });
  }
  const reviewedAt = typeof raw.reviewedAt === "string" ? raw.reviewedAt : "";
  const parsedDate = Date.parse(reviewedAt);
  let canonicalDate = false;
  try {
    canonicalDate = Number.isFinite(parsedDate) && new Date(parsedDate).toISOString() === reviewedAt;
  } catch {
    canonicalDate = false;
  }
  if (!canonicalDate) return Object.freeze({ status: "invalid", reason: "invalid-date" });

  const decision = raw.decision;
  if (decision !== "approved" && decision !== "revision-required" && decision !== "rejected") {
    return Object.freeze({ status: "invalid", reason: "invalid-receipt-shape" });
  }
  const checklist = canonicalChecklist(raw.checklist);
  const noteCodes = canonicalNoteCodes(raw.noteCodes);
  if (!checklist || !noteCodes) return Object.freeze({ status: "invalid", reason: "invalid-checklist" });

  if (decision === "approved") {
    if (
      packet.identity.status !== "resolved" ||
      !allChecksPassed(checklist) ||
      noteCodes.length !== 1 ||
      noteCodes[0] !== "no-issues"
    ) return Object.freeze({ status: "invalid", reason: "incomplete-approval" });
  } else if (noteCodes.includes("no-issues") || allChecksPassed(checklist)) {
    return Object.freeze({ status: "invalid", reason: "incomplete-approval" });
  }

  const receipt = Object.freeze({
    schemaVersion: 1 as const,
    packetId: packet.packetId,
    draftId: packet.draftId,
    identitySha256: packet.identitySha256,
    draftSha256: packet.draftSha256,
    decision,
    reviewerId,
    reviewedAt,
    checklist,
    noteCodes,
  });
  return Object.freeze({
    status: "valid",
    outcome: decision === "approved" ? "approved-awaiting-source-promotion" : decision,
    promotionAllowed: false,
    receipt,
  });
}

function canonicalReceiptList(
  value: unknown,
  packets: readonly HoidEditorialEntityReviewPacket[],
): Readonly<{ byDraftId: ReadonlyMap<string, HoidEditorialEntityReviewReceipt> }> | null {
  const raw = canonicalDenseArray(value, 0, MAX_ENTITIES);
  if (!raw) return null;
  const packetById = new Map(packets.map(packet => [packet.packetId, packet]));
  const byDraftId = new Map<string, HoidEditorialEntityReviewReceipt>();
  for (const item of raw) {
    const header = canonicalRecord(item, RECEIPT_KEYS);
    const packetId = header?.packetId;
    if (typeof packetId !== "string") return null;
    const packet = packetById.get(packetId);
    if (!packet || byDraftId.has(packet.draftId)) return null;
    const result = validateHoidEditorialEntityReviewReceipt(packet, item);
    if (result.status !== "valid") return null;
    byDraftId.set(packet.draftId, result.receipt);
  }
  return Object.freeze({ byDraftId });
}

function canonicalRelationshipReceiptList(
  value: unknown,
  packets: readonly HoidEditorialRelationshipReviewPacket[],
): Readonly<{ byDraftId: ReadonlyMap<string, string> }> | null {
  const raw = canonicalDenseArray(value, 0, MAX_ENTITIES);
  if (!raw) return null;
  const packetById = new Map(packets.map(packet => [packet.packetId, packet]));
  const byDraftId = new Map<string, string>();
  for (const item of raw) {
    const header = canonicalRecord(item, RELATIONSHIP_RECEIPT_KEYS);
    const packetId = header?.packetId;
    if (typeof packetId !== "string") return null;
    const packet = packetById.get(packetId);
    if (!packet || byDraftId.has(packet.draftId)) return null;
    const result = validateHoidEditorialRelationshipReviewReceipt(packet, item);
    if (result.status !== "valid") return null;
    byDraftId.set(packet.draftId, result.receipt.decision);
  }
  return Object.freeze({ byDraftId });
}

function blocker(
  code: HoidEditorialPromotionBlocker["code"],
  recordId: string,
  relatedId?: string,
): HoidEditorialPromotionBlocker {
  return Object.freeze({ code, recordId, ...(relatedId ? { relatedId } : {}) });
}

function evidenceMatchesParticipant(
  entity: HoidEditorialEntityDraft,
  relationship: HoidEditorialRelationshipDraft,
  evidenceIndices: readonly number[],
): boolean {
  if (entity.evidence.length !== evidenceIndices.length) return false;
  return entity.evidence.every((item, index) => {
    const relationshipEvidence = relationship.evidence[evidenceIndices[index]];
    return Boolean(
      relationshipEvidence &&
      JSON.stringify(evidenceTuple(item)) === JSON.stringify(evidenceTuple(relationshipEvidence)),
    );
  });
}

/**
 * Build a non-writing promotion plan. A ready plan only proves that the
 * reviewed staging bundle is internally consistent and currently unlocked.
 * Production changes still require a protected source-controlled commit.
 */
export function buildHoidEditorialPromotionPlan(
  entityDraftsInput: unknown,
  entityReceiptsInput: unknown,
  relationshipDraftsInput: unknown,
  relationshipReceiptsInput: unknown,
  cursorProgressSnapshot: unknown,
): HoidEditorialPromotionPlan {
  const entities = validateHoidEditorialEntityDraftBatch(entityDraftsInput);
  if (entities.status !== "valid") {
    return Object.freeze({
      status: "blocked",
      reason: "invalid-entities",
      blockers: Object.freeze([]),
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  const relationships = validateHoidEditorialRelationshipDraftBatch(relationshipDraftsInput);
  if (relationships.status !== "valid") {
    return Object.freeze({
      status: "blocked",
      reason: "invalid-relationships",
      blockers: Object.freeze([]),
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  const entityPackets = buildHoidEditorialEntityReviewPackets(entities.drafts);
  const relationshipPackets = buildHoidEditorialRelationshipReviewPackets(relationships.drafts);
  if (entityPackets.status !== "ready" || relationshipPackets.status !== "ready") {
    return Object.freeze({
      status: "blocked",
      reason: "invalid-receipts",
      blockers: Object.freeze([]),
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  const entityReceipts = canonicalReceiptList(entityReceiptsInput, entityPackets.packets);
  const relationshipReceipts = canonicalRelationshipReceiptList(relationshipReceiptsInput, relationshipPackets.packets);
  if (!entityReceipts || !relationshipReceipts) {
    return Object.freeze({
      status: "blocked",
      reason: "invalid-receipts",
      blockers: Object.freeze([]),
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  const projection = projectHoidCursorProgressSnapshot(cursorProgressSnapshot);
  if (projection.status !== "ready") {
    return Object.freeze({
      status: "blocked",
      reason: "invalid-progress",
      blockers: Object.freeze([]),
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  const entityEvaluation = evaluateHoidEditorialEntityDrafts(entities.drafts, cursorProgressSnapshot);
  const relationshipEvaluation = evaluateHoidEditorialRelationshipDrafts(relationships.drafts, cursorProgressSnapshot);
  if (entityEvaluation.status !== "ready" || relationshipEvaluation.status !== "ready") {
    return Object.freeze({
      status: "blocked",
      reason: "invalid-progress",
      blockers: Object.freeze([]),
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }

  const blockers: HoidEditorialPromotionBlocker[] = [];
  const entityById = new Map(entities.drafts.map(item => [item.id, item]));
  const entityEvaluationById = new Map(entityEvaluation.evaluations.map(item => [item.entityId, item]));
  const relationshipEvaluationById = new Map(relationshipEvaluation.evaluations.map(item => [item.claimId, item]));

  for (const entity of entities.drafts) {
    if (entity.identity.status !== "resolved") blockers.push(blocker("unresolved-identity", entity.id));
    const receipt = entityReceipts.byDraftId.get(entity.id);
    if (!receipt) blockers.push(blocker("missing-entity-review", entity.id));
    else if (receipt.decision !== "approved") blockers.push(blocker("entity-review-not-approved", entity.id));
    const evaluation = entityEvaluationById.get(entity.id);
    if (evaluation?.status !== "eligible-for-review" && evaluation?.reason !== "identity-unresolved") {
      blockers.push(blocker("entity-evidence-locked", entity.id));
    }
  }

  for (const relationship of relationships.drafts) {
    for (const participant of [relationship.subject, relationship.object]) {
      const entity = entityById.get(participant.id);
      if (!entity) {
        blockers.push(blocker("missing-entity", relationship.id, participant.id));
        continue;
      }
      if (entity.identity.status !== "resolved") {
        blockers.push(blocker("unresolved-identity", relationship.id, participant.id));
        continue;
      }
      if (entity.kind !== participant.kind) {
        blockers.push(blocker("entity-kind-mismatch", relationship.id, participant.id));
      }
      if (!evidenceMatchesParticipant(entity, relationship, participant.evidenceIndices)) {
        blockers.push(blocker("entity-evidence-mismatch", relationship.id, participant.id));
      }
    }
    if (!relationshipReceipts.byDraftId.has(relationship.id)) {
      blockers.push(blocker("missing-relationship-review", relationship.id));
    } else if (relationshipReceipts.byDraftId.get(relationship.id) !== "approved") {
      blockers.push(blocker("relationship-review-not-approved", relationship.id));
    }
    const evaluation = relationshipEvaluationById.get(relationship.id);
    if (!evaluation || evaluation.status !== "eligible-for-review") {
      blockers.push(blocker("relationship-evidence-locked", relationship.id));
    }
  }

  const uniqueBlockers = new Map<string, HoidEditorialPromotionBlocker>();
  for (const item of blockers) {
    uniqueBlockers.set([item.code, item.recordId, item.relatedId ?? ""].join("\n"), item);
  }
  const orderedBlockers = [...uniqueBlockers.values()].sort((left, right) => {
    const a = [left.code, left.recordId, left.relatedId ?? ""].join("\n");
    const b = [right.code, right.recordId, right.relatedId ?? ""].join("\n");
    return a < b ? -1 : a > b ? 1 : 0;
  });
  if (orderedBlockers.length > 0) {
    return Object.freeze({
      status: "blocked",
      reason: "promotion-gates",
      blockers: Object.freeze(orderedBlockers),
      promotionAllowed: false,
      productionWritePerformed: false,
    });
  }
  return Object.freeze({
    status: "ready-for-maintainer-commit",
    entityIds: Object.freeze(entities.drafts.map(item => item.id)),
    relationshipIds: Object.freeze(relationships.drafts.map(item => item.id)),
    progressRevision: projection.revision,
    progressFingerprint: fingerprintHoidCursorProgressProjection(projection),
    requiresProtectedReview: true,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

function evidenceForChapter(bookId: string, chapter: number): HoidEditorialClaimEvidence | null {
  const manifestResult = getHoidReadingManifest(bookId);
  if (manifestResult.status !== "ready") return null;
  const unit = manifestResult.manifest.units.find(item => item.chapterNumber === chapter);
  const documentSha256 = getVerifiedChapterDocumentSha256(
    bookId,
    manifestResult.manifest.editionId,
    manifestResult.manifest.navigationSha256,
    chapter,
  );
  if (!unit?.locatorId || !documentSha256) return null;
  return Object.freeze({
    source: Object.freeze({ bookId, chapter, locatorId: unit.locatorId }),
    unlock: Object.freeze({ bookId, chapter }),
    sourceIntegrity: Object.freeze({
      editionId: manifestResult.manifest.editionId,
      navigationSha256: manifestResult.manifest.navigationSha256,
      documentSha256,
    }),
  });
}

function entityInput(
  id: string,
  kind: HoidKnowledgeKind,
  bookId: string,
  chapter: number,
  canonicalLabel: string | null,
): unknown {
  const evidence = evidenceForChapter(bookId, chapter);
  if (!evidence) return null;
  return Object.freeze({
    id,
    kind,
    identity: canonicalLabel === null
      ? Object.freeze({ status: "unresolved", issueCode: "identity-not-established" })
      : Object.freeze({ status: "resolved", canonicalLabel }),
    evidence: Object.freeze([evidence]),
  });
}

const RAW_ENTITY_DRAFTS: readonly unknown[] = Object.freeze([
  entityInput("twok.shallan", "character", "twok", 3, "Shallan"),
  entityInput("twok.jasnah", "character", "twok", 3, "Jasnah Kholin"),
  entityInput("edgedancer.hauka", "character", "edgedancer", 3, "Hauka"),
  entityInput("edgedancer.unnamed-girl", "character", "edgedancer", 3, null),
  entityInput("dawnshard.lopen", "character", "dawnshard", 3, "Lopen"),
  entityInput("dawnshard.talik", "character", "dawnshard", 3, "Talik"),
  entityInput("twok.kaladin", "character", "twok", 4, "Kaladin"),
  entityInput("edgedancer.lift", "character", "edgedancer", 4, "Lift"),
  entityInput("edgedancer.wyndle", "character", "edgedancer", 4, "Wyndle"),
  entityInput("dawnshard.rysn", "character", "dawnshard", 4, "Rysn"),
  entityInput("dawnshard.nikli", "character", "dawnshard", 4, "Nikli"),
  entityInput("dawnshard.dlrwan", "character", "dawnshard", 4, "Dlrwan"),
  entityInput("tfe.kelsier", "character", "tfe", 2, "Kelsier"),
  entityInput("tfe.vin", "character", "tfe", 1, "Vin"),
]);


export function getHoidEditorialEntityDraftDiagnostics(): readonly Readonly<{
  index: number;
  id: string | null;
  evidenceAvailable: boolean;
  status: "valid" | "invalid";
  reason?: string;
}>[] {
  return Object.freeze(RAW_ENTITY_DRAFTS.map((item, index) => {
    const raw = canonicalRecord(item, CORE_KEYS);
    const evidence = canonicalDenseArray(raw?.evidence, 1, MAX_EVIDENCE);
    const result = createHoidEditorialEntityDraft(item);
    return Object.freeze({
      index,
      id: typeof raw?.id === "string" ? raw.id : null,
      evidenceAvailable: Boolean(evidence?.length && evidence.every(Boolean)),
      status: result.status,
      ...(result.status === "invalid" ? { reason: result.reason } : {}),
    });
  }));
}

const VALIDATED_ENTITY_BATCH = createHoidEditorialEntityDraftBatch(RAW_ENTITY_DRAFTS);

/** Identity dossiers remain staging-only and never populate production entity or alias registries. */
export const HOID_EDITORIAL_ENTITY_DRAFTS: readonly HoidEditorialEntityDraft[] =
  VALIDATED_ENTITY_BATCH.status === "valid" ? VALIDATED_ENTITY_BATCH.drafts : Object.freeze([]);

export function getHoidEditorialEntityDraftStatus(): "empty" | "pending-review" | "invalid" {
  if (VALIDATED_ENTITY_BATCH.status === "invalid") return "invalid";
  return HOID_EDITORIAL_ENTITY_DRAFTS.length > 0 ? "pending-review" : "empty";
}
