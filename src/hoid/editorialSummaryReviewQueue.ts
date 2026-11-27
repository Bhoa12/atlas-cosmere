import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import {
  buildHoidEditorialReviewPackets,
  validateHoidEditorialReviewReceipt,
  type HoidEditorialReviewNoteCode,
} from "./editorialReviewPackets";
import { sha256Hex } from "./sha256";
import type { ReadingPosition } from "./types";

export type HoidEditorialSummaryReviewQueueStatus =
  | "pending-review"
  | "approved-awaiting-source-promotion"
  | "revision-required"
  | "rejected";

export type HoidEditorialSummaryReviewQueueItem = Readonly<{
  draftId: string;
  packetId: string;
  workId: string;
  title: string;
  chapterNumber: number;
  unlockChapter: number;
  editionId: string;
  status: HoidEditorialSummaryReviewQueueStatus;
  reviewedAt: string | null;
  checklistPassedCount: number;
  reviewerTrust: "not-reviewed" | "unverified-local-label";
  noteCodes: readonly HoidEditorialReviewNoteCode[];
  promotionAllowed: false;
  productionWritePerformed: false;
}>;

export type HoidEditorialSummaryReviewQueueCounts = Readonly<{
  total: number;
  pendingReview: number;
  approvedAwaitingSourcePromotion: number;
  revisionRequired: number;
  rejected: number;
}>;

export type HoidEditorialSummaryReviewQueue = Readonly<{
  schemaVersion: 1;
  scope: "progress-bound-local-editorial-metadata";
  progressRevision: number;
  counts: HoidEditorialSummaryReviewQueueCounts;
  fingerprint: string;
  items: readonly HoidEditorialSummaryReviewQueueItem[];
  sourceTextIncluded: false;
  summaryTextIncluded: false;
  futureDraftsIncluded: false;
  localSourceAccessPerformed: false;
  localAvailability: "not-audited";
  providerEgress: "none";
  reviewerIdentityAuthority: "not-authenticated-by-local-receipt";
  promotionAllowed: false;
  productionWritePerformed: false;
  authorizationEffect: "none";
  progressEffect: "none";
  spoilerUnlockEffect: "none";
}>;

export type HoidEditorialSummaryReviewQueueResult =
  | Readonly<{ status: "ready"; queue: HoidEditorialSummaryReviewQueue }>
  | Readonly<{ status: "unavailable"; reason: "invalid-progress" }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-drafts"
        | "invalid-receipts"
        | "duplicate-receipt"
        | "orphan-receipt"
        | "invalid-receipt";
    }>;

const MAX_REVIEW_RECEIPTS = 512;

function denseArray(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > maximum
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
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function ownDataString(value: unknown, key: string): string | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
      descriptor.enumerable !== true ||
      typeof descriptor.value !== "string" ||
      descriptor.value.length === 0
    ) return null;
    return descriptor.value;
  } catch {
    return null;
  }
}

function checklistPassedCount(checklist: Readonly<{
  factualAccuracy: boolean;
  completeness: boolean;
  originality: boolean;
  spoilerCeiling: boolean;
  provenance: boolean;
}>): number {
  return [
    checklist.factualAccuracy,
    checklist.completeness,
    checklist.originality,
    checklist.spoilerCeiling,
    checklist.provenance,
  ].filter(Boolean).length;
}

function hasReachedUnlock(
  positions: ReadonlyMap<string, ReadingPosition>,
  bookId: string,
  chapter: number,
): boolean {
  const position = positions.get(bookId);
  return position?.completed === true ||
    (typeof position?.chapter === "number" && position.chapter >= chapter);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Project original editorial-summary drafts into a reader-progress-bound queue.
 *
 * The current cursor is projected through the authoritative v2 boundary:
 * a cursor on chapter N only completes through N-1. Therefore a chapter-N
 * summary is absent until the reader advances beyond N or explicitly completes
 * the work. Unreached drafts are omitted entirely; the result never reports a
 * withheld count or reveals how many future summaries exist.
 *
 * Review receipts are local, unauthenticated metadata. An approved receipt
 * remains awaiting trusted source-control promotion and cannot authorize
 * production knowledge, answers or spoilers.
 */
export function projectHoidEditorialSummaryReviewQueue(
  draftsInput: unknown,
  receiptsInput: unknown = [],
  cursorProgressSnapshotInput?: unknown,
): HoidEditorialSummaryReviewQueueResult {
  const progress = projectHoidCursorProgressSnapshot(cursorProgressSnapshotInput);
  if (progress.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  }

  const packetResult = buildHoidEditorialReviewPackets(draftsInput);
  if (packetResult.status !== "ready") {
    return Object.freeze({ status: "invalid", reason: "invalid-drafts" });
  }

  const receipts = denseArray(receiptsInput, MAX_REVIEW_RECEIPTS);
  if (!receipts) return Object.freeze({ status: "invalid", reason: "invalid-receipts" });

  const packetById = new Map(packetResult.packets.map(packet => [packet.packetId, packet]));
  const receiptByPacketId = new Map<string, unknown>();
  for (const receipt of receipts) {
    const id = ownDataString(receipt, "packetId");
    if (!id) return Object.freeze({ status: "invalid", reason: "invalid-receipts" });
    if (receiptByPacketId.has(id)) {
      return Object.freeze({ status: "invalid", reason: "duplicate-receipt" });
    }
    if (!packetById.has(id)) {
      return Object.freeze({ status: "invalid", reason: "orphan-receipt" });
    }
    receiptByPacketId.set(id, receipt);
  }

  const positions = new Map(progress.reading.map(position => [position.bookId, position]));
  const workOrder = new Map(HOID_SOURCE_BIBLIOGRAPHY.map((work, index) => [work.id, index]));
  const items: HoidEditorialSummaryReviewQueueItem[] = [];

  for (const packet of packetResult.packets) {
    // Do not create a queue item, placeholder, withheld count or future-work
    // summary for a chapter that has not passed the reader's progress ceiling.
    if (!hasReachedUnlock(positions, packet.unlock.bookId, packet.unlock.chapter)) continue;

    const work = HOID_SOURCE_BIBLIOGRAPHY.find(candidate => candidate.id === packet.source.bookId);
    if (!work) return Object.freeze({ status: "invalid", reason: "invalid-drafts" });

    const receiptInput = receiptByPacketId.get(packet.packetId);
    if (receiptInput === undefined) {
      items.push(Object.freeze({
        draftId: packet.draftId,
        packetId: packet.packetId,
        workId: work.id,
        title: work.title,
        chapterNumber: packet.source.chapter,
        unlockChapter: packet.unlock.chapter,
        editionId: packet.source.editionId,
        status: "pending-review",
        reviewedAt: null,
        checklistPassedCount: 0,
        reviewerTrust: "not-reviewed",
        noteCodes: Object.freeze([]),
        promotionAllowed: false,
        productionWritePerformed: false,
      }));
      continue;
    }

    const validation = validateHoidEditorialReviewReceipt(packet, receiptInput);
    if (validation.status !== "valid") {
      return Object.freeze({ status: "invalid", reason: "invalid-receipt" });
    }

    const status: HoidEditorialSummaryReviewQueueStatus =
      validation.outcome === "approved-awaiting-source-promotion"
        ? "approved-awaiting-source-promotion"
        : validation.outcome;
    items.push(Object.freeze({
      draftId: packet.draftId,
      packetId: packet.packetId,
      workId: work.id,
      title: work.title,
      chapterNumber: packet.source.chapter,
      unlockChapter: packet.unlock.chapter,
      editionId: packet.source.editionId,
      status,
      reviewedAt: validation.receipt.reviewedAt,
      checklistPassedCount: checklistPassedCount(validation.receipt.checklist),
      reviewerTrust: "unverified-local-label",
      noteCodes: Object.freeze([...validation.receipt.noteCodes]),
      promotionAllowed: false,
      productionWritePerformed: false,
    }));
  }

  items.sort((left, right) =>
    (workOrder.get(left.workId) ?? Number.MAX_SAFE_INTEGER) -
      (workOrder.get(right.workId) ?? Number.MAX_SAFE_INTEGER) ||
    left.chapterNumber - right.chapterNumber ||
    compareText(left.draftId, right.draftId),
  );

  const counts = Object.freeze({
    total: items.length,
    pendingReview: items.filter(item => item.status === "pending-review").length,
    approvedAwaitingSourcePromotion: items.filter(
      item => item.status === "approved-awaiting-source-promotion",
    ).length,
    revisionRequired: items.filter(item => item.status === "revision-required").length,
    rejected: items.filter(item => item.status === "rejected").length,
  });
  const fingerprint = sha256Hex(JSON.stringify([
    "hoid-editorial-summary-review-queue-v1",
    progress.revision,
    counts,
    items.map(item => [
      item.draftId,
      item.packetId,
      item.workId,
      item.chapterNumber,
      item.unlockChapter,
      item.editionId,
      item.status,
      item.reviewedAt,
      item.checklistPassedCount,
      item.reviewerTrust,
      item.noteCodes,
    ]),
  ]));

  return Object.freeze({
    status: "ready",
    queue: Object.freeze({
      schemaVersion: 1,
      scope: "progress-bound-local-editorial-metadata",
      progressRevision: progress.revision,
      counts,
      fingerprint,
      items: Object.freeze(items),
      sourceTextIncluded: false,
      summaryTextIncluded: false,
      futureDraftsIncluded: false,
      localSourceAccessPerformed: false,
      localAvailability: "not-audited",
      providerEgress: "none",
      reviewerIdentityAuthority: "not-authenticated-by-local-receipt",
      promotionAllowed: false,
      productionWritePerformed: false,
      authorizationEffect: "none",
      progressEffect: "none",
      spoilerUnlockEffect: "none",
    }),
  });
}
