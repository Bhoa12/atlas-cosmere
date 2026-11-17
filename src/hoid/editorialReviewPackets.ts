import { sha256Hex } from "./sha256";
import { canonicalEvidenceScope } from "./evidenceScope";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import {
  validateHoidEditorialDraftBatch,
  type HoidEditorialDraft,
} from "./editorialDrafts";

export type HoidEditorialReviewChecklist = Readonly<{
  factualAccuracy: boolean;
  completeness: boolean;
  originality: boolean;
  spoilerCeiling: boolean;
  provenance: boolean;
}>;

export type HoidEditorialReviewPacket = Readonly<{
  schemaVersion: 1;
  packetId: string;
  draftId: string;
  summary: string;
  summarySha256: string;
  sourceDocumentSha256: string;
  source: Readonly<{
    bookId: string;
    chapter: number;
    locatorId: string;
    editionId: string;
    navigationSha256: string;
  }>;
  unlock: Readonly<{ bookId: string; chapter: number }>;
  checklist: HoidEditorialReviewChecklist;
  status: "pending-review";
}>;

export type HoidEditorialReviewNoteCode =
  | "no-issues"
  | "factual-issue"
  | "completeness-issue"
  | "originality-issue"
  | "spoiler-scope-issue"
  | "provenance-issue";

export type HoidEditorialReviewReceipt = Readonly<{
  schemaVersion: 1;
  packetId: string;
  draftId: string;
  summarySha256: string;
  sourceDocumentSha256: string;
  decision: "approved" | "revision-required" | "rejected";
  reviewerId: string;
  reviewedAt: string;
  checklist: HoidEditorialReviewChecklist;
  noteCodes: readonly HoidEditorialReviewNoteCode[];
}>;

export type HoidReviewPacketBuildResult =
  | Readonly<{ status: "ready"; packets: readonly HoidEditorialReviewPacket[] }>
  | Readonly<{ status: "invalid"; reason: "invalid-batch" | "duplicate-id" | "invalid-draft" }>;

export type HoidReviewReceiptResult =
  | Readonly<{
      status: "valid";
      outcome: "approved-awaiting-source-promotion" | "revision-required" | "rejected";
      promotionAllowed: false;
      receipt: HoidEditorialReviewReceipt;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-receipt-shape"
        | "packet-mismatch"
        | "invalid-reviewer"
        | "invalid-date"
        | "invalid-checklist"
        | "incomplete-approval";
    }>;

const PACKET_KEYS = new Set([
  "schemaVersion", "packetId", "draftId", "summary", "summarySha256",
  "sourceDocumentSha256", "source", "unlock", "checklist", "status",
]);
const SOURCE_KEYS = new Set(["bookId", "chapter", "locatorId", "editionId", "navigationSha256"]);
const UNLOCK_KEYS = new Set(["bookId", "chapter"]);
const CHECKLIST_KEYS = new Set([
  "factualAccuracy", "completeness", "originality", "spoilerCeiling", "provenance",
]);
const RECEIPT_KEYS = new Set([
  "schemaVersion", "packetId", "draftId", "summarySha256", "sourceDocumentSha256",
  "decision", "reviewerId", "reviewedAt", "checklist", "noteCodes",
]);

function canonicalRecord(
  value: unknown,
  keysAllowed: ReadonlySet<string>,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== keysAllowed.size) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !keysAllowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of keysAllowed) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function canonicalChecklist(value: unknown): HoidEditorialReviewChecklist | null {
  const raw = canonicalRecord(value, CHECKLIST_KEYS);
  if (!raw) return null;
  for (const key of CHECKLIST_KEYS) {
    if (typeof raw[key] !== "boolean") return null;
  }
  return Object.freeze({
    factualAccuracy: raw.factualAccuracy as boolean,
    completeness: raw.completeness as boolean,
    originality: raw.originality as boolean,
    spoilerCeiling: raw.spoilerCeiling as boolean,
    provenance: raw.provenance as boolean,
  });
}

function canonicalNoteCodes(value: unknown): readonly HoidEditorialReviewNoteCode[] | null {
  try {
    if (!Array.isArray(value) || value.length < 1 || value.length > 6) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const allowed = new Set<HoidEditorialReviewNoteCode>([
      "no-issues",
      "factual-issue",
      "completeness-issue",
      "originality-issue",
      "spoiler-scope-issue",
      "provenance-issue",
    ]);
    const seen = new Set<string>();
    const result: HoidEditorialReviewNoteCode[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof descriptor.value !== "string" ||
        !allowed.has(descriptor.value as HoidEditorialReviewNoteCode) ||
        seen.has(descriptor.value)
      ) return null;
      seen.add(descriptor.value);
      result.push(descriptor.value as HoidEditorialReviewNoteCode);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function allChecksPassed(value: HoidEditorialReviewChecklist): boolean {
  return value.factualAccuracy &&
    value.completeness &&
    value.originality &&
    value.spoilerCeiling &&
    value.provenance;
}

function reviewPacketId(
  draftId: string,
  summarySha256: string,
  sourceDocumentSha256: string,
  source: Readonly<{
    bookId: string;
    chapter: number;
    locatorId: string;
    editionId: string;
    navigationSha256: string;
  }>,
  unlock: Readonly<{ bookId: string; chapter: number }>,
): string {
  const canonical = [
    "hoid-editorial-review-v1",
    draftId,
    summarySha256,
    sourceDocumentSha256,
    source.bookId,
    String(source.chapter),
    source.locatorId,
    source.editionId,
    source.navigationSha256,
    unlock.bookId,
    String(unlock.chapter),
  ].join("\n");
  return "review:" + sha256Hex(canonical);
}

function canonicalPacket(value: unknown): HoidEditorialReviewPacket | null {
  const raw = canonicalRecord(value, PACKET_KEYS);
  if (!raw || raw.schemaVersion !== 1 || raw.status !== "pending-review") return null;
  const source = canonicalRecord(raw.source, SOURCE_KEYS);
  const unlock = canonicalRecord(raw.unlock, UNLOCK_KEYS);
  const checklist = canonicalChecklist(raw.checklist);
  if (!source || !unlock || !checklist) return null;

  const strings = [
    raw.packetId, raw.draftId, raw.summary, raw.summarySha256,
    raw.sourceDocumentSha256, source.bookId, source.locatorId,
    source.editionId, source.navigationSha256, unlock.bookId,
  ];
  if (!strings.every(value => typeof value === "string" && value.length > 0)) return null;
  if (
    typeof raw.summary !== "string" ||
    raw.summary.length > 4_000 ||
    typeof raw.summarySha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.summarySha256) ||
    raw.summarySha256 !== sha256Hex(raw.summary) ||
    typeof raw.sourceDocumentSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.sourceDocumentSha256) ||
    typeof source.chapter !== "number" || !Number.isSafeInteger(source.chapter) || source.chapter < 1 ||
    typeof unlock.chapter !== "number" || !Number.isSafeInteger(unlock.chapter) || unlock.chapter < 1 ||
    source.bookId !== unlock.bookId || unlock.chapter < source.chapter ||
    typeof source.locatorId !== "string" || source.locatorId.length > 256 ||
    /[\\u0000-\\u001f\\u007f]/u.test(source.locatorId) ||
    typeof source.editionId !== "string" || source.editionId.length > 128 ||
    typeof source.navigationSha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.navigationSha256) ||
    Object.values(checklist).some(Boolean)
  ) return null;

  const manifestResult = getHoidReadingManifest(source.bookId as string);
  if (manifestResult.status !== "ready") return null;
  const scope = canonicalEvidenceScope(
    {
      bookId: source.bookId,
      chapter: source.chapter,
      locatorId: source.locatorId,
    },
    {
      bookId: unlock.bookId,
      chapter: unlock.chapter,
    },
  );
  const expectedDocumentSha256 = getVerifiedChapterDocumentSha256(
    source.bookId,
    source.editionId,
    source.navigationSha256,
    source.chapter,
  );
  const expectedPacketId = reviewPacketId(
    raw.draftId as string,
    raw.summarySha256 as string,
    raw.sourceDocumentSha256 as string,
    {
      bookId: source.bookId as string,
      chapter: source.chapter,
      locatorId: source.locatorId as string,
      editionId: source.editionId as string,
      navigationSha256: source.navigationSha256 as string,
    },
    { bookId: unlock.bookId as string, chapter: unlock.chapter },
  );
  if (
    !scope ||
    source.editionId !== manifestResult.manifest.editionId ||
    source.navigationSha256 !== manifestResult.manifest.navigationSha256 ||
    expectedDocumentSha256 !== raw.sourceDocumentSha256 ||
    raw.packetId !== expectedPacketId
  ) return null;

  return Object.freeze({
    schemaVersion: 1,
    packetId: raw.packetId as string,
    draftId: raw.draftId as string,
    summary: raw.summary,
    summarySha256: raw.summarySha256,
    sourceDocumentSha256: raw.sourceDocumentSha256,
    source: Object.freeze({
      bookId: source.bookId as string,
      chapter: source.chapter,
      locatorId: source.locatorId as string,
      editionId: source.editionId as string,
      navigationSha256: source.navigationSha256 as string,
    }),
    unlock: Object.freeze({ bookId: unlock.bookId as string, chapter: unlock.chapter }),
    checklist,
    status: "pending-review",
  });
}

/**
 * Build deterministic review packets from valid staging drafts. Packets contain
 * only original editorial summaries and metadata; EPUB passages are never read
 * or copied by this module.
 */
export function buildHoidEditorialReviewPackets(values: unknown): HoidReviewPacketBuildResult {
  const batch = validateHoidEditorialDraftBatch(values);
  if (batch.status !== "valid") return batch;

  const packets = batch.drafts.map((draft: HoidEditorialDraft) => {
    const packetId = reviewPacketId(
      draft.id,
      draft.summaryIntegrity.sha256,
      draft.sourceIntegrity.documentSha256,
      {
        bookId: draft.evidenceSource.bookId,
        chapter: draft.evidenceSource.chapter,
        locatorId: draft.evidenceSource.locatorId,
        editionId: draft.sourceIntegrity.editionId,
        navigationSha256: draft.sourceIntegrity.navigationSha256,
      },
      draft.evidenceUnlock,
    );
    return Object.freeze({
      schemaVersion: 1 as const,
      packetId,
      draftId: draft.id,
      summary: draft.summary,
      summarySha256: draft.summaryIntegrity.sha256,
      sourceDocumentSha256: draft.sourceIntegrity.documentSha256,
      source: Object.freeze({
        bookId: draft.evidenceSource.bookId,
        chapter: draft.evidenceSource.chapter,
        locatorId: draft.evidenceSource.locatorId,
        editionId: draft.sourceIntegrity.editionId,
        navigationSha256: draft.sourceIntegrity.navigationSha256,
      }),
      unlock: Object.freeze({
        bookId: draft.evidenceUnlock.bookId,
        chapter: draft.evidenceUnlock.chapter,
      }),
      checklist: Object.freeze({
        factualAccuracy: false,
        completeness: false,
        originality: false,
        spoilerCeiling: false,
        provenance: false,
      }),
      status: "pending-review" as const,
    });
  }).sort((a, b) => a.draftId.localeCompare(b.draftId));

  return Object.freeze({ status: "ready", packets: Object.freeze(packets) });
}

/**
 * Validate a review receipt against one exact packet. An approved receipt only
 * becomes "awaiting source promotion"; it never writes to the production
 * registry. Reviewer identity must be authenticated by the source-control
 * review process, not by trusting this data object.
 */
export function validateHoidEditorialReviewReceipt(
  packetInput: unknown,
  receiptInput: unknown,
): HoidReviewReceiptResult {
  const packet = canonicalPacket(packetInput);
  const raw = canonicalRecord(receiptInput, RECEIPT_KEYS);
  if (!packet || !raw || raw.schemaVersion !== 1) {
    return Object.freeze({ status: "invalid", reason: "invalid-receipt-shape" });
  }

  if (
    raw.packetId !== packet.packetId ||
    raw.draftId !== packet.draftId ||
    raw.summarySha256 !== packet.summarySha256 ||
    raw.sourceDocumentSha256 !== packet.sourceDocumentSha256
  ) return Object.freeze({ status: "invalid", reason: "packet-mismatch" });

  if (
    typeof raw.reviewerId !== "string" ||
    !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/i.test(raw.reviewerId)
  ) return Object.freeze({ status: "invalid", reason: "invalid-reviewer" });

  if (
    typeof raw.reviewedAt !== "string" ||
    !Number.isFinite(Date.parse(raw.reviewedAt)) ||
    new Date(raw.reviewedAt).toISOString() !== raw.reviewedAt
  ) return Object.freeze({ status: "invalid", reason: "invalid-date" });

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
  if (
    raw.decision === "approved" &&
    (!allChecksPassed(checklist) || noteCodes.some(code => code !== "no-issues"))
  ) return Object.freeze({ status: "invalid", reason: "incomplete-approval" });
  if (
    raw.decision !== "approved" &&
    noteCodes.includes("no-issues")
  ) return Object.freeze({ status: "invalid", reason: "invalid-checklist" });

  const receipt: HoidEditorialReviewReceipt = Object.freeze({
    schemaVersion: 1,
    packetId: packet.packetId,
    draftId: packet.draftId,
    summarySha256: packet.summarySha256,
    sourceDocumentSha256: packet.sourceDocumentSha256,
    decision: raw.decision,
    reviewerId: raw.reviewerId.trim(),
    reviewedAt: raw.reviewedAt,
    checklist,
    noteCodes,
  });
  const outcome = raw.decision === "approved"
    ? "approved-awaiting-source-promotion"
    : raw.decision === "revision-required"
      ? "revision-required"
      : "rejected";

  return Object.freeze({
    status: "valid",
    outcome,
    promotionAllowed: false,
    receipt,
  });
}
