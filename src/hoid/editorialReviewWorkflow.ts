import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import {
  buildHoidEditorialReviewPackets,
  validateHoidEditorialReviewReceipt,
  type HoidEditorialReviewChecklist,
  type HoidEditorialReviewNoteCode,
} from "./editorialReviewPackets";
import { projectHoidEditorialSummaryReviewQueue } from "./editorialSummaryReviewQueue";
import {
  validateHoidEditorialReviewReceiptSnapshot,
  type HoidEditorialReviewReceiptSnapshot,
  type HoidEditorialReviewReceiptStorePort,
} from "./editorialReviewReceiptStore";

export type HoidEditorialReviewWorkspaceItem = Readonly<{
  packetId: string;
  draftId: string;
  workId: string;
  title: string;
  chapterNumber: number;
  status:
    | "pending-review"
    | "approved-awaiting-source-promotion"
    | "revision-required"
    | "rejected";
  summary: string;
  reviewedAt: string | null;
}>;

export type HoidEditorialReviewWorkspaceResult =
  | Readonly<{
      status: "ready";
      items: readonly HoidEditorialReviewWorkspaceItem[];
      progressRevision: number;
      fingerprint: string;
      sourceTextIncluded: false;
      summaryTextIncluded: boolean;
      futureDraftsIncluded: false;
      localAvailability: "not-audited";
      providerEgress: "none";
      authorizationEffect: "none";
      spoilerUnlockEffect: "none";
    }>
  | Readonly<{ status: "unavailable"; reason: "invalid-progress" }>
  | Readonly<{
      status: "invalid";
      reason: "invalid-drafts" | "invalid-receipts" | "invalid-packet-projection";
    }>;

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

/**
 * Projects only packets whose unlock boundary is already reached by the
 * validated reader cursor. The summary is an original staging artifact;
 * source passages, EPUB locators, hashes, paths and URIs are never returned.
 */
export function projectHoidEditorialReviewWorkspace(
  draftsInput: unknown,
  receiptsInput: unknown,
  progressSnapshot: unknown,
): HoidEditorialReviewWorkspaceResult {
  const queueResult = projectHoidEditorialSummaryReviewQueue(
    draftsInput,
    receiptsInput,
    progressSnapshot,
  );
  if (queueResult.status === "unavailable") {
    return Object.freeze({ status: "unavailable", reason: "invalid-progress" });
  }
  if (queueResult.status === "invalid") {
    return Object.freeze({
      status: "invalid",
      reason: queueResult.reason === "invalid-drafts"
        ? "invalid-drafts"
        : "invalid-receipts",
    });
  }

  const packetResult = buildHoidEditorialReviewPackets(draftsInput);
  if (packetResult.status !== "ready") {
    return Object.freeze({ status: "invalid", reason: "invalid-drafts" });
  }
  const packetsById = new Map(packetResult.packets.map(packet => [packet.packetId, packet]));
  const items: HoidEditorialReviewWorkspaceItem[] = [];

  for (const queueItem of queueResult.queue.items) {
    const packet = packetsById.get(queueItem.packetId);
    if (!packet || packet.draftId !== queueItem.draftId) {
      return Object.freeze({ status: "invalid", reason: "invalid-packet-projection" });
    }
    items.push(Object.freeze({
      packetId: packet.packetId,
      draftId: packet.draftId,
      workId: queueItem.workId,
      title: queueItem.title,
      chapterNumber: queueItem.chapterNumber,
      status: queueItem.status,
      summary: packet.summary,
      reviewedAt: queueItem.reviewedAt,
    }));
  }

  return Object.freeze({
    status: "ready",
    items: Object.freeze(items),
    progressRevision: queueResult.queue.progressRevision,
    fingerprint: queueResult.queue.fingerprint,
    sourceTextIncluded: false,
    summaryTextIncluded: items.length > 0,
    futureDraftsIncluded: false,
    localAvailability: "not-audited",
    providerEgress: "none",
    authorizationEffect: "none",
    spoilerUnlockEffect: "none",
  });
}

export type HoidEditorialReviewSubmission = Readonly<{
  packetId: string;
  decision: "approved" | "revision-required" | "rejected";
  checklist: HoidEditorialReviewChecklist;
  noteCodes: readonly HoidEditorialReviewNoteCode[];
  progressSnapshot: unknown;
}>;

export type HoidEditorialReviewSubmissionResult =
  | "saved"
  | "conflict"
  | "not-eligible"
  | "invalid"
  | "unavailable";

export type HoidEditorialReviewSubmissionPort = Readonly<{
  submit(input: HoidEditorialReviewSubmission): Promise<HoidEditorialReviewSubmissionResult>;
}>;

const SUBMISSION_KEYS = new Set([
  "packetId",
  "decision",
  "checklist",
  "noteCodes",
  "progressSnapshot",
]);

function canonicalSubmission(value: unknown): HoidEditorialReviewSubmission | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== SUBMISSION_KEYS.size ||
      keys.some(key => typeof key !== "string" || !SUBMISSION_KEYS.has(key))
    ) return null;

    const raw = Object.create(null) as Record<string, unknown>;
    for (const key of SUBMISSION_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      raw[key] = descriptor.value;
    }

    if (
      typeof raw.packetId !== "string" ||
      raw.packetId.length === 0 ||
      (raw.decision !== "approved" &&
        raw.decision !== "revision-required" &&
        raw.decision !== "rejected")
    ) return null;

    return raw as unknown as HoidEditorialReviewSubmission;
  } catch {
    return null;
  }
}

export function createHoidEditorialReviewSubmissionPort(options: Readonly<{
  store: HoidEditorialReviewReceiptStorePort;
  onSnapshot?: (snapshot: HoidEditorialReviewReceiptSnapshot) => void;
  now?: () => Date;
}>): HoidEditorialReviewSubmissionPort {
  const now = options.now ?? (() => new Date());

  return Object.freeze({
    submit: async (input: HoidEditorialReviewSubmission): Promise<HoidEditorialReviewSubmissionResult> => {
      const submission = canonicalSubmission(input);
      if (!submission) return "invalid";

      let currentValue: unknown;
      try {
        currentValue = await options.store.read();
      } catch {
        return "unavailable";
      }
      const currentValidation = validateHoidEditorialReviewReceiptSnapshot(currentValue);
      if (currentValidation.status !== "valid") return "unavailable";

      const queueResult = projectHoidEditorialSummaryReviewQueue(
        HOID_EDITORIAL_DRAFTS,
        currentValidation.snapshot.receipts,
        submission.progressSnapshot,
      );
      if (
        queueResult.status !== "ready" ||
        !queueResult.queue.items.some(item =>
          item.packetId === submission.packetId && item.status === "pending-review",
        )
      ) return "not-eligible";

      const packetResult = buildHoidEditorialReviewPackets(HOID_EDITORIAL_DRAFTS);
      if (packetResult.status !== "ready") return "unavailable";
      const packet = packetResult.packets.find(item => item.packetId === submission.packetId);
      if (!packet) return "not-eligible";

      let reviewedAt: string;
      try {
        reviewedAt = now().toISOString();
      } catch {
        return "unavailable";
      }

      const receiptValidation = validateHoidEditorialReviewReceipt(packet, {
        schemaVersion: 1,
        packetId: packet.packetId,
        draftId: packet.draftId,
        summarySha256: packet.summarySha256,
        sourceDocumentSha256: packet.sourceDocumentSha256,
        decision: submission.decision,
        reviewerId: "device-local-unverified",
        reviewedAt,
        checklist: submission.checklist,
        noteCodes: submission.noteCodes,
      });
      if (receiptValidation.status !== "valid") return "invalid";

      const nextSnapshot = Object.freeze({
        schemaVersion: 1 as const,
        revision: currentValidation.snapshot.revision + 1,
        receipts: Object.freeze([
          ...currentValidation.snapshot.receipts,
          receiptValidation.receipt,
        ]),
      });
      const nextValidation = validateHoidEditorialReviewReceiptSnapshot(nextSnapshot);
      if (nextValidation.status !== "valid") return "invalid";

      let writeResult: "saved" | "conflict" | "unavailable";
      try {
        writeResult = await options.store.compareAndSwap(
          currentValidation.snapshot.revision,
          nextValidation.snapshot,
        );
      } catch {
        return "unavailable";
      }
      if (writeResult !== "saved") return writeResult;

      let persistedValue: unknown;
      try {
        persistedValue = await options.store.read();
      } catch {
        return "unavailable";
      }
      const persistedValidation = validateHoidEditorialReviewReceiptSnapshot(persistedValue);
      if (
        persistedValidation.status !== "valid" ||
        persistedValidation.snapshot.revision !== nextValidation.snapshot.revision
      ) return "unavailable";

      try {
        options.onSnapshot?.(persistedValidation.snapshot);
      } catch {
        // Persistence succeeded; a presentation callback cannot roll it back.
      }
      return "saved";
    },
  });
}

export function getHoidEditorialReviewChecklistNoteCodes(
  checklist: HoidEditorialReviewChecklist,
): readonly HoidEditorialReviewNoteCode[] {
  const result: HoidEditorialReviewNoteCode[] = [];
  if (!checklist.factualAccuracy) result.push("factual-issue");
  if (!checklist.completeness) result.push("completeness-issue");
  if (!checklist.originality) result.push("originality-issue");
  if (!checklist.spoilerCeiling) result.push("spoiler-scope-issue");
  if (!checklist.provenance) result.push("provenance-issue");
  return Object.freeze(result);
}
