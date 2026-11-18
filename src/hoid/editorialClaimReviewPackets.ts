import {
  validateHoidEditorialClaimDraft,
  validateHoidEditorialClaimDraftBatch,
  type HoidEditorialClaimDraft,
  type HoidEditorialClaimEvidence,
  type HoidEditorialClaimAssertionKind,
} from "./editorialClaimDrafts";
import type { HoidKnowledgeKind } from "./catalog";
import { sha256Hex } from "./sha256";

export type HoidEditorialClaimReviewChecklist = Readonly<{
  factualAccuracy: boolean;
  atomicity: boolean;
  subjectIdentity: boolean;
  completeness: boolean;
  originality: boolean;
  spoilerCeiling: boolean;
  provenance: boolean;
}>;

export type HoidEditorialClaimReviewPacket = Readonly<{
  schemaVersion: 1;
  packetId: string;
  draftId: string;
  claimSha256: string;
  statementSha256: string;
  subjectId: string;
  subjectKind: HoidKnowledgeKind;
  assertionKind: HoidEditorialClaimAssertionKind;
  intent: "explain" | "context" | "recommend";
  statement: string;
  evidence: readonly HoidEditorialClaimEvidence[];
  checklist: HoidEditorialClaimReviewChecklist;
  status: "pending-review";
}>;

export type HoidEditorialClaimReviewReceipt = Readonly<{
  schemaVersion: 1;
  packetId: string;
  draftId: string;
  claimSha256: string;
  decision: "approved" | "revision-required" | "rejected";
  reviewerId: string;
  reviewedAt: string;
  checklist: HoidEditorialClaimReviewChecklist;
  noteCodes: readonly string[];
}>;

export type HoidEditorialClaimReviewPacketResult =
  | Readonly<{ status: "ready"; packets: readonly HoidEditorialClaimReviewPacket[] }>
  | Readonly<{ status: "invalid"; reason: "invalid-batch" | "duplicate-id" | "invalid-draft" }>;

export type HoidEditorialClaimReviewReceiptResult =
  | Readonly<{
      status: "valid";
      outcome: "approved-awaiting-source-promotion" | "revision-required" | "rejected";
      promotionAllowed: false;
      receipt: HoidEditorialClaimReviewReceipt;
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

const PACKET_KEYS = new Set([
  "schemaVersion", "packetId", "draftId", "claimSha256", "statementSha256",
  "subjectId", "subjectKind", "assertionKind", "intent", "statement",
  "evidence", "checklist", "status",
]);
const RECEIPT_KEYS = new Set([
  "schemaVersion", "packetId", "draftId", "claimSha256", "decision",
  "reviewerId", "reviewedAt", "checklist", "noteCodes",
]);
const CHECKLIST_KEYS = new Set([
  "factualAccuracy", "atomicity", "subjectIdentity", "completeness",
  "originality", "spoilerCeiling", "provenance",
]);
const NOTE_CODES = new Set([
  "no-issues",
  "factual-issue",
  "non-atomic-claim",
  "subject-identity-issue",
  "completeness-issue",
  "originality-issue",
  "spoiler-scope-issue",
  "provenance-issue",
]);

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

function canonicalDenseStrings(value: unknown, maximum: number): readonly string[] | null {
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
        !NOTE_CODES.has(descriptor.value) ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      result.push(descriptor.value);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function canonicalChecklist(value: unknown): HoidEditorialClaimReviewChecklist | null {
  const raw = canonicalRecord(value, CHECKLIST_KEYS);
  if (!raw) return null;
  for (const key of CHECKLIST_KEYS) {
    if (typeof raw[key] !== "boolean") return null;
  }
  return Object.freeze({
    factualAccuracy: raw.factualAccuracy as boolean,
    atomicity: raw.atomicity as boolean,
    subjectIdentity: raw.subjectIdentity as boolean,
    completeness: raw.completeness as boolean,
    originality: raw.originality as boolean,
    spoilerCeiling: raw.spoilerCeiling as boolean,
    provenance: raw.provenance as boolean,
  });
}

function checklistValues(value: HoidEditorialClaimReviewChecklist): readonly boolean[] {
  return Object.freeze([
    value.factualAccuracy,
    value.atomicity,
    value.subjectIdentity,
    value.completeness,
    value.originality,
    value.spoilerCeiling,
    value.provenance,
  ]);
}

function packetId(draft: HoidEditorialClaimDraft): string {
  return sha256Hex(JSON.stringify([
    "hoid-editorial-atomic-claim-review-v1",
    draft.id,
    draft.integrity.claimSha256,
    draft.integrity.statementSha256,
  ]));
}

function emptyChecklist(): HoidEditorialClaimReviewChecklist {
  return Object.freeze({
    factualAccuracy: false,
    atomicity: false,
    subjectIdentity: false,
    completeness: false,
    originality: false,
    spoilerCeiling: false,
    provenance: false,
  });
}

function packetFromDraft(draft: HoidEditorialClaimDraft): HoidEditorialClaimReviewPacket {
  return Object.freeze({
    schemaVersion: 1,
    packetId: packetId(draft),
    draftId: draft.id,
    claimSha256: draft.integrity.claimSha256,
    statementSha256: draft.integrity.statementSha256,
    subjectId: draft.subjectId,
    subjectKind: draft.subjectKind,
    assertionKind: draft.assertionKind,
    intent: draft.intent,
    statement: draft.statement,
    evidence: draft.evidence,
    checklist: emptyChecklist(),
    status: "pending-review",
  });
}

/** Build deterministic packets for atomic assertions; no source passages are included. */
export function buildHoidEditorialClaimReviewPackets(
  value: unknown,
): HoidEditorialClaimReviewPacketResult {
  const batch = validateHoidEditorialClaimDraftBatch(value);
  if (batch.status !== "valid") return batch;
  return Object.freeze({
    status: "ready",
    packets: Object.freeze(batch.drafts.map(packetFromDraft)),
  });
}

function canonicalPacket(value: unknown): HoidEditorialClaimReviewPacket | null {
  const raw = canonicalRecord(value, PACKET_KEYS);
  if (!raw || raw.schemaVersion !== 1 || raw.status !== "pending-review") return null;
  const checklist = canonicalChecklist(raw.checklist);
  if (!checklist || checklistValues(checklist).some(Boolean)) return null;

  const reconstructed = validateHoidEditorialClaimDraft({
    schemaVersion: 1,
    id: raw.draftId,
    subjectId: raw.subjectId,
    subjectKind: raw.subjectKind,
    assertionKind: raw.assertionKind,
    intent: raw.intent,
    statement: raw.statement,
    evidence: raw.evidence,
    integrity: {
      statementSha256: raw.statementSha256,
      claimSha256: raw.claimSha256,
    },
    review: { status: "pending-review" },
  });
  if (reconstructed.status !== "valid") return null;
  const expected = packetFromDraft(reconstructed.draft);
  return raw.packetId === expected.packetId ? expected : null;
}

/**
 * Validate one receipt against the exact atomic-claim packet.
 * Reviewer identity is only an identifier here; protected source-control
 * review is responsible for authenticating independence and permissions.
 */
export function validateHoidEditorialClaimReviewReceipt(
  packetInput: unknown,
  receiptInput: unknown,
): HoidEditorialClaimReviewReceiptResult {
  const packet = canonicalPacket(packetInput);
  const raw = canonicalRecord(receiptInput, RECEIPT_KEYS);
  if (!packet) return Object.freeze({ status: "invalid", reason: "invalid-packet" });
  if (!raw || raw.schemaVersion !== 1) {
    return Object.freeze({ status: "invalid", reason: "invalid-receipt-shape" });
  }
  if (
    raw.packetId !== packet.packetId ||
    raw.draftId !== packet.draftId ||
    raw.claimSha256 !== packet.claimSha256
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
  const noteCodes = canonicalDenseStrings(raw.noteCodes, 8);
  if (!checklist || !noteCodes) return Object.freeze({ status: "invalid", reason: "invalid-checklist" });

  const allPassed = checklistValues(checklist).every(Boolean);
  if (decision === "approved") {
    if (!allPassed || noteCodes.length !== 1 || noteCodes[0] !== "no-issues") {
      return Object.freeze({ status: "invalid", reason: "incomplete-approval" });
    }
  } else if (allPassed || noteCodes.includes("no-issues")) {
    return Object.freeze({ status: "invalid", reason: "incomplete-approval" });
  }

  const receipt: HoidEditorialClaimReviewReceipt = Object.freeze({
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    claimSha256: packet.claimSha256,
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
