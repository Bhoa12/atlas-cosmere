import type { HoidKnowledgeKind } from "./catalog";
import type { HoidKnowledgeGraphPredicate } from "./knowledgeGraph";
import {
  createHoidEditorialClaimDraft,
  evaluateHoidEditorialClaimDrafts,
  type HoidEditorialClaimEvidence,
} from "./editorialClaimDrafts";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import { sha256Hex } from "./sha256";

export type HoidEditorialRelationshipParticipant = Readonly<{
  id: string;
  kind: HoidKnowledgeKind;
  evidenceIndices: readonly number[];
}>;

export type HoidEditorialRelationshipDraft = Readonly<{
  schemaVersion: 2;
  id: string;
  predicate: HoidKnowledgeGraphPredicate;
  subject: HoidEditorialRelationshipParticipant;
  object: HoidEditorialRelationshipParticipant;
  intent: "explain" | "context";
  statement: string;
  evidence: readonly HoidEditorialClaimEvidence[];
  relationEvidenceIndices: readonly number[];
  integrity: Readonly<{ statementSha256: string; claimSha256: string }>;
  review: Readonly<{ status: "pending-review" }>;
}>;

export type HoidEditorialRelationshipChecklist = Readonly<{
  factualAccuracy: boolean;
  relationshipAccuracy: boolean;
  entityIdentity: boolean;
  completeness: boolean;
  originality: boolean;
  spoilerCeiling: boolean;
  provenance: boolean;
}>;

export type HoidEditorialRelationshipReviewPacket = Readonly<{
  schemaVersion: 1;
  packetId: string;
  draftId: string;
  claimSha256: string;
  statementSha256: string;
  statement: string;
  intent: "explain" | "context";
  predicate: HoidKnowledgeGraphPredicate;
  subject: HoidEditorialRelationshipParticipant;
  object: HoidEditorialRelationshipParticipant;
  evidence: readonly HoidEditorialClaimEvidence[];
  relationEvidenceIndices: readonly number[];
  checklist: HoidEditorialRelationshipChecklist;
  status: "pending-review";
}>;

export type HoidEditorialRelationshipReviewReceipt = Readonly<{
  schemaVersion: 1;
  packetId: string;
  draftId: string;
  claimSha256: string;
  decision: "approved" | "revision-required" | "rejected";
  reviewerId: string;
  reviewedAt: string;
  checklist: HoidEditorialRelationshipChecklist;
  noteCodes: readonly string[];
}>;

export type HoidEditorialRelationshipValidation =
  | Readonly<{ status: "valid"; draft: HoidEditorialRelationshipDraft }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-shape"
        | "invalid-identity"
        | "invalid-predicate"
        | "invalid-evidence"
        | "invalid-relationship-scope"
        | "invalid-integrity"
        | "invalid-review";
    }>;

export type HoidEditorialRelationshipBatchResult =
  | Readonly<{ status: "valid"; drafts: readonly HoidEditorialRelationshipDraft[] }>
  | Readonly<{ status: "invalid"; reason: "invalid-batch" | "duplicate-id" | "invalid-draft" }>;

export type HoidEditorialRelationshipPacketResult =
  | Readonly<{ status: "ready"; packets: readonly HoidEditorialRelationshipReviewPacket[] }>
  | Readonly<{ status: "invalid"; reason: "invalid-batch" | "duplicate-id" | "invalid-draft" }>;

export type HoidEditorialRelationshipReceiptResult =
  | Readonly<{
      status: "valid";
      outcome: "approved-awaiting-source-promotion" | "revision-required" | "rejected";
      promotionAllowed: false;
      receipt: HoidEditorialRelationshipReviewReceipt;
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

const CORE_KEYS = new Set([
  "id", "predicate", "subject", "object", "intent", "statement", "evidence", "relationEvidenceIndices",
]);
const DRAFT_KEYS = new Set([
  "schemaVersion", ...CORE_KEYS, "integrity", "review",
]);
const PARTICIPANT_KEYS = new Set(["id", "kind", "evidenceIndices"]);
const INTEGRITY_KEYS = new Set(["statementSha256", "claimSha256"]);
const REVIEW_KEYS = new Set(["status"]);
const PACKET_KEYS = new Set([
  "schemaVersion", "packetId", "draftId", "claimSha256", "statementSha256", "statement",
  "intent", "predicate", "subject", "object", "evidence", "relationEvidenceIndices",
  "checklist", "status",
]);
const CHECKLIST_KEYS = new Set([
  "factualAccuracy", "relationshipAccuracy", "entityIdentity", "completeness",
  "originality", "spoilerCeiling", "provenance",
]);
const RECEIPT_KEYS = new Set([
  "schemaVersion", "packetId", "draftId", "claimSha256", "decision", "reviewerId",
  "reviewedAt", "checklist", "noteCodes",
]);
const ENTITY_KINDS = new Set<HoidKnowledgeKind>([
  "character", "place", "event", "concept", "magic", "organization", "object",
]);
const PREDICATES = new Set<HoidKnowledgeGraphPredicate>([
  "related-to", "appears-in", "located-in", "member-of", "uses",
  "participates-in", "created-by", "part-of", "causes", "opposes", "allied-with",
]);
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const MAX_EVIDENCE = 8;
const MAX_STATEMENT_LENGTH = 1_200;

type RelationshipCore = Readonly<{
  id: string;
  predicate: HoidKnowledgeGraphPredicate;
  subject: HoidEditorialRelationshipParticipant;
  object: HoidEditorialRelationshipParticipant;
  intent: "explain" | "context";
  statement: string;
  evidence: readonly HoidEditorialClaimEvidence[];
  relationEvidenceIndices: readonly number[];
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

function canonicalIndices(value: unknown, evidenceLength: number): readonly number[] | null {
  const raw = canonicalDenseArray(value, 1, evidenceLength);
  if (!raw) return null;
  const result: number[] = [];
  let previous = -1;
  for (const item of raw) {
    if (
      typeof item !== "number" ||
      !Number.isSafeInteger(item) ||
      item < 0 ||
      item >= evidenceLength ||
      item <= previous
    ) return null;
    previous = item;
    result.push(item);
  }
  return Object.freeze(result);
}

function canonicalParticipant(value: unknown, evidenceLength: number): HoidEditorialRelationshipParticipant | null {
  const raw = canonicalRecord(value, PARTICIPANT_KEYS);
  if (!raw) return null;
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!ID_PATTERN.test(id) || id.length > 128) return null;
  if (typeof raw.kind !== "string" || !ENTITY_KINDS.has(raw.kind as HoidKnowledgeKind)) return null;
  const evidenceIndices = canonicalIndices(raw.evidenceIndices, evidenceLength);
  if (!evidenceIndices) return null;
  return Object.freeze({
    id,
    kind: raw.kind as HoidKnowledgeKind,
    evidenceIndices,
  });
}

function evidenceKey(value: HoidEditorialClaimEvidence): string {
  return [
    value.source.bookId,
    String(value.source.chapter).padStart(10, "0"),
    value.source.locatorId,
  ].join("\n");
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

function relationshipPayload(core: RelationshipCore): string {
  return JSON.stringify([
    "hoid-editorial-relationship-claim-v2",
    core.id,
    core.predicate,
    [core.subject.id, core.subject.kind, core.subject.evidenceIndices],
    [core.object.id, core.object.kind, core.object.evidenceIndices],
    core.intent,
    core.statement,
    core.evidence.map(evidenceTuple),
    core.relationEvidenceIndices,
  ]);
}

function normalizeCore(value: unknown):
  | Readonly<{ status: "valid"; core: RelationshipCore }>
  | Readonly<{ status: "invalid"; reason: "invalid-shape" | "invalid-identity" | "invalid-predicate" | "invalid-evidence" | "invalid-relationship-scope" }> {
  const raw = canonicalRecord(value, CORE_KEYS);
  if (!raw) return Object.freeze({ status: "invalid", reason: "invalid-shape" });

  const id = typeof raw.id === "string" ? raw.id : "";
  if (!ID_PATTERN.test(id) || id.length > 128) {
    return Object.freeze({ status: "invalid", reason: "invalid-identity" });
  }
  if (typeof raw.predicate !== "string" || !PREDICATES.has(raw.predicate as HoidKnowledgeGraphPredicate)) {
    return Object.freeze({ status: "invalid", reason: "invalid-predicate" });
  }
  if (raw.intent !== "explain" && raw.intent !== "context") {
    return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  }
  if (
    typeof raw.statement !== "string" ||
    raw.statement !== raw.statement.trim() ||
    raw.statement.length < 20 ||
    raw.statement.length > MAX_STATEMENT_LENGTH ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(raw.statement)
  ) return Object.freeze({ status: "invalid", reason: "invalid-shape" });

  const rawEvidence = canonicalDenseArray(raw.evidence, 1, MAX_EVIDENCE);
  if (!rawEvidence) return Object.freeze({ status: "invalid", reason: "invalid-evidence" });
  const subject = canonicalParticipant(raw.subject, rawEvidence.length);
  const object = canonicalParticipant(raw.object, rawEvidence.length);
  if (!subject || !object || subject.id === object.id) {
    return Object.freeze({ status: "invalid", reason: "invalid-identity" });
  }
  const relationEvidenceIndices = canonicalIndices(raw.relationEvidenceIndices, rawEvidence.length);
  if (!relationEvidenceIndices) {
    return Object.freeze({ status: "invalid", reason: "invalid-relationship-scope" });
  }

  const base = createHoidEditorialClaimDraft({
    id,
    subjectId: subject.id,
    subjectKind: subject.kind,
    assertionKind: "relationship",
    intent: raw.intent,
    statement: raw.statement,
    evidence: raw.evidence,
  });
  if (base.status !== "valid") {
    return Object.freeze({ status: "invalid", reason: "invalid-evidence" });
  }

  // Evidence indices are meaningful only if the draft uses the same canonical
  // evidence order as the base claim validator. Reject rather than silently
  // remapping indices after sorting.
  const inputEvidence = rawEvidence as readonly HoidEditorialClaimEvidence[];
  if (
    inputEvidence.length !== base.draft.evidence.length ||
    inputEvidence.some((item, index) => evidenceKey(item) !== evidenceKey(base.draft.evidence[index]))
  ) return Object.freeze({ status: "invalid", reason: "invalid-evidence" });

  const relationSet = new Set(relationEvidenceIndices);
  if (
    !subject.evidenceIndices.some(index => relationSet.has(index)) ||
    !object.evidenceIndices.some(index => relationSet.has(index))
  ) return Object.freeze({ status: "invalid", reason: "invalid-relationship-scope" });

  return Object.freeze({
    status: "valid",
    core: Object.freeze({
      id,
      predicate: raw.predicate as HoidKnowledgeGraphPredicate,
      subject,
      object,
      intent: raw.intent,
      statement: raw.statement,
      evidence: base.draft.evidence,
      relationEvidenceIndices,
    }),
  });
}

export function createHoidEditorialRelationshipDraft(value: unknown): HoidEditorialRelationshipValidation {
  const normalized = normalizeCore(value);
  if (normalized.status !== "valid") return normalized;
  const core = normalized.core;
  const integrity = Object.freeze({
    statementSha256: sha256Hex(core.statement),
    claimSha256: sha256Hex(relationshipPayload(core)),
  });
  return validateHoidEditorialRelationshipDraft({
    schemaVersion: 2,
    ...core,
    integrity,
    review: Object.freeze({ status: "pending-review" }),
  });
}

export function validateHoidEditorialRelationshipDraft(value: unknown): HoidEditorialRelationshipValidation {
  const raw = canonicalRecord(value, DRAFT_KEYS);
  if (!raw || raw.schemaVersion !== 2) {
    return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  }
  const coreInput = Object.create(null) as Record<string, unknown>;
  for (const key of CORE_KEYS) coreInput[key] = raw[key];
  const normalized = normalizeCore(coreInput);
  if (normalized.status !== "valid") return normalized;

  const integrity = canonicalRecord(raw.integrity, INTEGRITY_KEYS);
  if (
    !integrity ||
    typeof integrity.statementSha256 !== "string" ||
    typeof integrity.claimSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(integrity.statementSha256) ||
    !/^[a-f0-9]{64}$/.test(integrity.claimSha256) ||
    integrity.statementSha256 !== sha256Hex(normalized.core.statement) ||
    integrity.claimSha256 !== sha256Hex(relationshipPayload(normalized.core))
  ) return Object.freeze({ status: "invalid", reason: "invalid-integrity" });

  const review = canonicalRecord(raw.review, REVIEW_KEYS);
  if (!review || review.status !== "pending-review") {
    return Object.freeze({ status: "invalid", reason: "invalid-review" });
  }

  return Object.freeze({
    status: "valid",
    draft: Object.freeze({
      schemaVersion: 2,
      ...normalized.core,
      integrity: Object.freeze({
        statementSha256: integrity.statementSha256,
        claimSha256: integrity.claimSha256,
      }),
      review: Object.freeze({ status: "pending-review" }),
    }),
  });
}

export function validateHoidEditorialRelationshipDraftBatch(value: unknown): HoidEditorialRelationshipBatchResult {
  const raw = canonicalDenseArray(value, 0, 512);
  if (!raw) return Object.freeze({ status: "invalid", reason: "invalid-batch" });
  const drafts: HoidEditorialRelationshipDraft[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const result = validateHoidEditorialRelationshipDraft(item);
    if (result.status !== "valid") {
      return Object.freeze({ status: "invalid", reason: "invalid-draft" });
    }
    if (seen.has(result.draft.id)) {
      return Object.freeze({ status: "invalid", reason: "duplicate-id" });
    }
    seen.add(result.draft.id);
    drafts.push(result.draft);
  }
  drafts.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return Object.freeze({ status: "valid", drafts: Object.freeze(drafts) });
}

export function evaluateHoidEditorialRelationshipDrafts(
  value: unknown,
  cursorProgressSnapshot: unknown,
) {
  const batch = validateHoidEditorialRelationshipDraftBatch(value);
  if (batch.status !== "valid") {
    return Object.freeze({ status: "unavailable" as const, reason: "invalid-claims" as const });
  }
  const baseDrafts = batch.drafts.map(draft => createHoidEditorialClaimDraft({
    id: draft.id,
    subjectId: draft.subject.id,
    subjectKind: draft.subject.kind,
    assertionKind: "relationship",
    intent: draft.intent,
    statement: draft.statement,
    evidence: draft.evidence,
  }));
  if (baseDrafts.some(item => item.status !== "valid")) {
    return Object.freeze({ status: "unavailable" as const, reason: "invalid-claims" as const });
  }
  return evaluateHoidEditorialClaimDrafts(
    baseDrafts.map(item => item.status === "valid" ? item.draft : null),
    cursorProgressSnapshot,
  );
}

function emptyChecklist(): HoidEditorialRelationshipChecklist {
  return Object.freeze({
    factualAccuracy: false,
    relationshipAccuracy: false,
    entityIdentity: false,
    completeness: false,
    originality: false,
    spoilerCeiling: false,
    provenance: false,
  });
}

function checklistPayload(value: HoidEditorialRelationshipChecklist): readonly boolean[] {
  return Object.freeze([
    value.factualAccuracy,
    value.relationshipAccuracy,
    value.entityIdentity,
    value.completeness,
    value.originality,
    value.spoilerCeiling,
    value.provenance,
  ]);
}

function packetIdentity(draft: HoidEditorialRelationshipDraft): string {
  return sha256Hex(JSON.stringify([
    "hoid-editorial-relationship-review-packet-v1",
    draft.id,
    draft.integrity.claimSha256,
    draft.integrity.statementSha256,
    draft.predicate,
    [draft.subject.id, draft.subject.kind, draft.subject.evidenceIndices],
    [draft.object.id, draft.object.kind, draft.object.evidenceIndices],
    draft.evidence.map(evidenceTuple),
    draft.relationEvidenceIndices,
  ]));
}

function packetFromDraft(draft: HoidEditorialRelationshipDraft): HoidEditorialRelationshipReviewPacket {
  return Object.freeze({
    schemaVersion: 1,
    packetId: packetIdentity(draft),
    draftId: draft.id,
    claimSha256: draft.integrity.claimSha256,
    statementSha256: draft.integrity.statementSha256,
    statement: draft.statement,
    intent: draft.intent,
    predicate: draft.predicate,
    subject: draft.subject,
    object: draft.object,
    evidence: draft.evidence,
    relationEvidenceIndices: draft.relationEvidenceIndices,
    checklist: emptyChecklist(),
    status: "pending-review",
  });
}

export function buildHoidEditorialRelationshipReviewPackets(
  value: unknown,
): HoidEditorialRelationshipPacketResult {
  const batch = validateHoidEditorialRelationshipDraftBatch(value);
  if (batch.status !== "valid") return batch;
  return Object.freeze({
    status: "ready",
    packets: Object.freeze(batch.drafts.map(packetFromDraft)),
  });
}

function canonicalChecklist(value: unknown): HoidEditorialRelationshipChecklist | null {
  const raw = canonicalRecord(value, CHECKLIST_KEYS);
  if (!raw) return null;
  for (const key of CHECKLIST_KEYS) {
    if (typeof raw[key] !== "boolean") return null;
  }
  return Object.freeze({
    factualAccuracy: raw.factualAccuracy as boolean,
    relationshipAccuracy: raw.relationshipAccuracy as boolean,
    entityIdentity: raw.entityIdentity as boolean,
    completeness: raw.completeness as boolean,
    originality: raw.originality as boolean,
    spoilerCeiling: raw.spoilerCeiling as boolean,
    provenance: raw.provenance as boolean,
  });
}

function allChecklistPassed(value: HoidEditorialRelationshipChecklist): boolean {
  return checklistPayload(value).every(Boolean);
}

const NOTE_CODES = new Set([
  "no-issues",
  "factual-issue",
  "relationship-issue",
  "entity-identity-issue",
  "completeness-issue",
  "originality-issue",
  "spoiler-scope-issue",
  "provenance-issue",
]);

function canonicalNoteCodes(value: unknown): readonly string[] | null {
  const raw = canonicalDenseArray(value, 1, 8);
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

function canonicalPacket(value: unknown): HoidEditorialRelationshipReviewPacket | null {
  const raw = canonicalRecord(value, PACKET_KEYS);
  if (!raw || raw.schemaVersion !== 1 || raw.status !== "pending-review") return null;
  const checklist = canonicalChecklist(raw.checklist);
  if (!checklist || checklistPayload(checklist).some(Boolean)) return null;

  const reconstructed = validateHoidEditorialRelationshipDraft({
    schemaVersion: 2,
    id: raw.draftId,
    predicate: raw.predicate,
    subject: raw.subject,
    object: raw.object,
    intent: raw.intent,
    statement: raw.statement,
    evidence: raw.evidence,
    relationEvidenceIndices: raw.relationEvidenceIndices,
    integrity: {
      statementSha256: raw.statementSha256,
      claimSha256: raw.claimSha256,
    },
    review: { status: "pending-review" },
  });
  if (reconstructed.status !== "valid") return null;
  const expected = packetFromDraft(reconstructed.draft);
  if (
    typeof raw.packetId !== "string" ||
    raw.packetId !== expected.packetId ||
    raw.claimSha256 !== expected.claimSha256
  ) return null;
  return expected;
}

export function validateHoidEditorialRelationshipReviewReceipt(
  packetInput: unknown,
  receiptInput: unknown,
): HoidEditorialRelationshipReceiptResult {
  const packet = canonicalPacket(packetInput);
  if (!packet) return Object.freeze({ status: "invalid", reason: "invalid-packet" });
  const raw = canonicalRecord(receiptInput, RECEIPT_KEYS);
  if (!raw || raw.schemaVersion !== 1) {
    return Object.freeze({ status: "invalid", reason: "invalid-receipt-shape" });
  }
  if (
    raw.packetId !== packet.packetId ||
    raw.draftId !== packet.draftId ||
    raw.claimSha256 !== packet.claimSha256
  ) return Object.freeze({ status: "invalid", reason: "packet-mismatch" });

  const reviewerId = typeof raw.reviewerId === "string" ? raw.reviewerId.trim() : "";
  if (!reviewerId || reviewerId.length > 128 || /[\u0000-\u001F\u007F]/u.test(reviewerId)) {
    return Object.freeze({ status: "invalid", reason: "invalid-reviewer" });
  }
  const reviewedAt = typeof raw.reviewedAt === "string" ? raw.reviewedAt : "";
  const parsedDate = Date.parse(reviewedAt);
  if (!Number.isFinite(parsedDate) || new Date(parsedDate).toISOString() !== reviewedAt) {
    return Object.freeze({ status: "invalid", reason: "invalid-date" });
  }
  if (
    raw.decision !== "approved" &&
    raw.decision !== "revision-required" &&
    raw.decision !== "rejected"
  ) return Object.freeze({ status: "invalid", reason: "invalid-receipt-shape" });

  const checklist = canonicalChecklist(raw.checklist);
  const noteCodes = canonicalNoteCodes(raw.noteCodes);
  if (!checklist || !noteCodes) {
    return Object.freeze({ status: "invalid", reason: "invalid-checklist" });
  }

  if (raw.decision === "approved") {
    if (!allChecklistPassed(checklist) || noteCodes.length !== 1 || noteCodes[0] !== "no-issues") {
      return Object.freeze({ status: "invalid", reason: "incomplete-approval" });
    }
  } else if (
    noteCodes.includes("no-issues") ||
    allChecklistPassed(checklist)
  ) {
    return Object.freeze({ status: "invalid", reason: "incomplete-approval" });
  }

  const receipt = Object.freeze({
    schemaVersion: 1 as const,
    packetId: packet.packetId,
    draftId: packet.draftId,
    claimSha256: packet.claimSha256,
    decision: raw.decision,
    reviewerId,
    reviewedAt,
    checklist,
    noteCodes,
  });
  return Object.freeze({
    status: "valid",
    outcome: raw.decision === "approved"
      ? "approved-awaiting-source-promotion"
      : raw.decision,
    promotionAllowed: false,
    receipt,
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
    unlock: Object.freeze({ bookId, chapter: chapter + 1 }),
    sourceIntegrity: Object.freeze({
      editionId: manifestResult.manifest.editionId,
      navigationSha256: manifestResult.manifest.navigationSha256,
      documentSha256,
    }),
  });
}

const RAW_RELATIONSHIP_DRAFTS: readonly unknown[] = Object.freeze([
  Object.freeze({
    id: "twok.relationship.shallan-seeks-jasnah",
    predicate: "related-to",
    subject: Object.freeze({ id: "twok.shallan", kind: "character", evidenceIndices: Object.freeze([0]) }),
    object: Object.freeze({ id: "twok.jasnah", kind: "character", evidenceIndices: Object.freeze([0]) }),
    intent: "context",
    statement: "Shallan llega a Kharbranth con el propósito de encontrar a Jasnah Kholin y solicitar que la acepte como pupila; la búsqueda forma parte de un plan para proteger a su familia.",
    evidence: Object.freeze([evidenceForChapter("twok", 3)]),
    relationEvidenceIndices: Object.freeze([0]),
  }),
  Object.freeze({
    id: "edgedancer.relationship.hauka-intercepts-girl",
    predicate: "related-to",
    subject: Object.freeze({ id: "edgedancer.hauka", kind: "character", evidenceIndices: Object.freeze([0]) }),
    object: Object.freeze({ id: "edgedancer.unnamed-girl", kind: "character", evidenceIndices: Object.freeze([0]) }),
    intent: "context",
    statement: "Hauka intenta detener a una niña oculta en un carro durante una inspección de inmigración; la persecución termina con la carga dispersa sobre el barrio de inmigrantes.",
    evidence: Object.freeze([evidenceForChapter("edgedancer", 3)]),
    relationEvidenceIndices: Object.freeze([0]),
  }),
  Object.freeze({
    id: "dawnshard.relationship.lopen-taliks-candid-exchange",
    predicate: "related-to",
    subject: Object.freeze({ id: "dawnshard.lopen", kind: "character", evidenceIndices: Object.freeze([0]) }),
    object: Object.freeze({ id: "dawnshard.talik", kind: "character", evidenceIndices: Object.freeze([0]) }),
    intent: "context",
    statement: "Lopen y Talik conversan sobre la participación reshi en la coalición; Talik acepta trasladar al rey la recomendación de escuchar la propuesta de los alezi.",
    evidence: Object.freeze([evidenceForChapter("dawnshard", 3)]),
    relationEvidenceIndices: Object.freeze([0]),
  }),
]);

export function getHoidEditorialRelationshipDraftDiagnostics(): readonly Readonly<{
  index: number;
  id: string | null;
  status: "valid" | "invalid";
  reason?: string;
}>[] {
  return Object.freeze(RAW_RELATIONSHIP_DRAFTS.map((item, index) => {
    const raw = canonicalRecord(item, CORE_KEYS);
    const result = createHoidEditorialRelationshipDraft(item);
    return Object.freeze({
      index,
      id: typeof raw?.id === "string" ? raw.id : null,
      status: result.status,
      ...(result.status === "invalid" ? { reason: result.reason } : {}),
    });
  }));
}

const VALIDATED_RELATIONSHIP_BATCH = validateHoidEditorialRelationshipDraftBatch(
  RAW_RELATIONSHIP_DRAFTS,
);

/** Relationship claims remain staging-only and are never imported into production. */
export const HOID_EDITORIAL_RELATIONSHIP_DRAFTS: readonly HoidEditorialRelationshipDraft[] =
  VALIDATED_RELATIONSHIP_BATCH.status === "valid"
    ? VALIDATED_RELATIONSHIP_BATCH.drafts
    : Object.freeze([]);

export function getHoidEditorialRelationshipDraftStatus(): "empty" | "pending-review" | "invalid" {
  if (VALIDATED_RELATIONSHIP_BATCH.status === "invalid") return "invalid";
  return HOID_EDITORIAL_RELATIONSHIP_DRAFTS.length > 0 ? "pending-review" : "empty";
}
