import {
  buildHoidEditorialReviewPackets,
  validateHoidEditorialReviewReceipt,
} from "./editorialReviewPackets";
import {
  validateHoidEditorialReviewReceiptSnapshot,
  type HoidEditorialReviewReceiptStorePort,
} from "./editorialReviewReceiptStore";
import { projectHoidEditorialSummaryReviewQueue } from "./editorialSummaryReviewQueue";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";
import { sha256Hex } from "./sha256";
import type {
  HoidEditorialSourceDocumentAccessRequest,
} from "./editorialClaimPromotionPreflight";

const DEFAULT_SOURCE_TIMEOUT_MS = 8_000;
const MAX_SOURCE_TIMEOUT_MS = 8_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

export type HoidEditorialSummaryPromotionPreflightResult =
  | Readonly<{
      status: "ready-for-authenticated-review";
      packetId: string;
      draftId: string;
      workId: string;
      chapterNumber: number;
      editionId: string;
      progressRevision: number;
      receiptFingerprint: string;
      sourceDocumentVerified: true;
      reviewerIdentity: "unverified-local";
      promotionAllowed: false;
      productionWritePerformed: false;
      answerAuthorizationEffect: "none";
      spoilerUnlockEffect: "none";
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "invalid-request"
        | "progress-unavailable"
        | "chapter-not-yet-unlocked"
        | "receipt-store-unavailable"
        | "invalid-receipts"
        | "packet-unavailable"
        | "receipt-not-approved"
        | "source-not-registered"
        | "source-access-port-invalid"
        | "source-unavailable"
        | "source-digest-mismatch"
        | "source-timeout"
        | "source-access-failed"
        | "progress-changed"
        | "receipts-changed";
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

export type HoidEditorialSummaryPromotionPreflightPort = Readonly<{
  audit(input: unknown): Promise<HoidEditorialSummaryPromotionPreflightResult>;
}>;

type ProgressBinding = Readonly<{
  revision: number;
  fingerprint: string;
}>;

type SourceInspection =
  | Readonly<{ status: "available"; documentSha256: string }>
  | Readonly<{ status: "unavailable" }>
  | Readonly<{ status: "timeout" | "failed" | "invalid" }>;

function blocked(
  reason: Extract<HoidEditorialSummaryPromotionPreflightResult, { status: "blocked" }>["reason"],
): Extract<HoidEditorialSummaryPromotionPreflightResult, { status: "blocked" }> {
  return Object.freeze({
    status: "blocked",
    reason,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

function exactRecord(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== allowedKeys.length ||
      keys.some(key => typeof key !== "string" || !allowedKeys.includes(key))
    ) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of allowedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function safeMethod<TRequest, TOptions>(
  value: unknown,
  name: string,
): ((request: TRequest, options: TOptions) => Promise<unknown>) | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    let current: object | null = value;
    for (let depth = 0; current !== null && current !== Object.prototype && depth < 4; depth += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(current, name);
      if (descriptor) {
        if (
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          typeof descriptor.value !== "function"
        ) return null;
        return (descriptor.value as (request: TRequest, options: TOptions) => Promise<unknown>).bind(value);
      }
      current = Object.getPrototypeOf(current) as object | null;
    }
    return null;
  } catch {
    return null;
  }
}

function canonicalPacketId(value: unknown): string | null {
  const raw = exactRecord(value, ["packetId"]);
  if (
    !raw ||
    typeof raw.packetId !== "string" ||
    raw.packetId.length === 0 ||
    raw.packetId.length > 128 ||
    !/^review:[a-f0-9]{64}$/u.test(raw.packetId)
  ) return null;
  return raw.packetId;
}

function progressBinding(value: unknown): ProgressBinding | null {
  const projection = projectHoidCursorProgressSnapshot(value);
  if (projection.status !== "ready") return null;
  const fingerprint = sha256Hex(JSON.stringify([
    "hoid-editorial-summary-preflight-progress-v1",
    projection.revision,
    projection.reading,
    projection.startedBookIds,
  ]));
  return Object.freeze({ revision: projection.revision, fingerprint });
}

function inspectWithDeadline(
  inspect: (
    request: HoidEditorialSourceDocumentAccessRequest,
    options: Readonly<{ signal: AbortSignal }>,
  ) => Promise<unknown>,
  request: HoidEditorialSourceDocumentAccessRequest,
  timeoutMs: number,
): Promise<SourceInspection> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const operation = Promise.resolve().then(() =>
    inspect(request, Object.freeze({ signal: controller.signal })),
  ).then(
    value => {
      const raw = exactRecord(value, ["status", "documentSha256"]);
      if (
        raw &&
        raw.status === "available" &&
        typeof raw.documentSha256 === "string" &&
        SHA256_PATTERN.test(raw.documentSha256)
      ) return Object.freeze({ status: "available" as const, documentSha256: raw.documentSha256 });

      const unavailable = exactRecord(value, ["status", "reason"]);
      if (
        unavailable &&
        unavailable.status === "unavailable" &&
        typeof unavailable.reason === "string"
      ) return Object.freeze({ status: "unavailable" as const });

      return Object.freeze({ status: "invalid" as const });
    },
    () => Object.freeze({ status: "failed" as const }),
  );
  const timeout = new Promise<SourceInspection>(resolve => {
    timeoutId = setTimeout(() => {
      controller.abort();
      resolve(Object.freeze({ status: "timeout" }));
    }, timeoutMs);
  });

  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

/**
 * A non-promoting preflight for one locally approved original summary.
 *
 * It revalidates the current progress and local receipt, checks the exact
 * edition-bound chapter document through the host-local EPUB access port,
 * then re-reads both progress and receipts to reject races. It returns only
 * metadata and a readiness signal for a separate authenticated review.
 *
 * This does not authenticate the local reviewer, prove that a person read the
 * source passage, promote knowledge, authorize an answer or unlock spoilers.
 */
export function createHoidEditorialSummaryPromotionPreflightPort(options: Readonly<{
  store: HoidEditorialReviewReceiptStorePort;
  getFreshProgress: () => Promise<unknown | null>;
  sourceAccessPort: unknown;
  sourceTimeoutMs?: number;
}>): HoidEditorialSummaryPromotionPreflightPort {
  const inspect = safeMethod<
    HoidEditorialSourceDocumentAccessRequest,
    Readonly<{ signal: AbortSignal }>
  >(options.sourceAccessPort, "inspectChapter");
  const requestedTimeout = options.sourceTimeoutMs ?? DEFAULT_SOURCE_TIMEOUT_MS;
  const timeoutMs = typeof requestedTimeout === "number" &&
    Number.isSafeInteger(requestedTimeout) &&
    requestedTimeout > 0 &&
    requestedTimeout <= MAX_SOURCE_TIMEOUT_MS
    ? requestedTimeout
    : DEFAULT_SOURCE_TIMEOUT_MS;

  return Object.freeze({
    async audit(input: unknown): Promise<HoidEditorialSummaryPromotionPreflightResult> {
      const packetId = canonicalPacketId(input);
      if (!packetId) return blocked("invalid-request");
      if (!inspect) return blocked("source-access-port-invalid");

      let firstProgressInput: unknown | null;
      try {
        firstProgressInput = await options.getFreshProgress();
      } catch {
        return blocked("progress-unavailable");
      }
      if (firstProgressInput === null) return blocked("progress-unavailable");
      const firstProgress = progressBinding(firstProgressInput);
      if (!firstProgress) return blocked("progress-unavailable");

      let firstReceiptInput: unknown;
      try {
        firstReceiptInput = await options.store.read();
      } catch {
        return blocked("receipt-store-unavailable");
      }
      const firstReceiptValidation = validateHoidEditorialReviewReceiptSnapshot(firstReceiptInput);
      if (firstReceiptValidation.status !== "valid") return blocked("invalid-receipts");

      const packetResult = buildHoidEditorialReviewPackets(HOID_EDITORIAL_DRAFTS);
      if (packetResult.status !== "ready") return blocked("packet-unavailable");
      const packets = packetResult.packets.filter(packet => packet.packetId === packetId);
      if (packets.length !== 1) return blocked("packet-unavailable");
      const packet = packets[0];

      const receipts = firstReceiptValidation.snapshot.receipts.filter(
        receipt => receipt.packetId === packetId,
      );
      if (receipts.length !== 1) return blocked("receipt-not-approved");
      const receiptValidation = validateHoidEditorialReviewReceipt(packet, receipts[0]);
      if (
        receiptValidation.status !== "valid" ||
        receiptValidation.outcome !== "approved-awaiting-source-promotion"
      ) return blocked("receipt-not-approved");

      const queue = projectHoidEditorialSummaryReviewQueue(
        HOID_EDITORIAL_DRAFTS,
        firstReceiptValidation.snapshot.receipts,
        firstProgressInput,
      );
      if (
        queue.status !== "ready" ||
        !queue.queue.items.some(item =>
          item.packetId === packetId &&
          item.status === "approved-awaiting-source-promotion",
        )
      ) return blocked("chapter-not-yet-unlocked");

      const manifestResult = getHoidReadingManifest(packet.source.bookId);
      if (manifestResult.status !== "ready") return blocked("source-not-registered");
      const manifest = manifestResult.manifest;
      const expectedDigest = getVerifiedChapterDocumentSha256(
        packet.source.bookId,
        packet.source.editionId,
        packet.source.navigationSha256,
        packet.source.chapter,
      );
      if (
        manifest.editionId !== packet.source.editionId ||
        manifest.navigationSha256 !== packet.source.navigationSha256 ||
        !expectedDigest ||
        expectedDigest !== packet.sourceDocumentSha256
      ) return blocked("source-not-registered");

      const sourceRequest: HoidEditorialSourceDocumentAccessRequest = Object.freeze({
        bookId: packet.source.bookId,
        editionId: packet.source.editionId,
        navigationSha256: packet.source.navigationSha256,
        chapterNumber: packet.source.chapter,
        locatorId: packet.source.locatorId,
        expectedDocumentSha256: expectedDigest,
      });

      const inspection = await inspectWithDeadline(inspect, sourceRequest, timeoutMs);
      if (inspection.status === "timeout") return blocked("source-timeout");
      if (inspection.status === "unavailable") return blocked("source-unavailable");
      if (inspection.status !== "available") return blocked("source-access-failed");
      if (inspection.documentSha256 !== expectedDigest) return blocked("source-digest-mismatch");

      let secondProgressInput: unknown | null;
      try {
        secondProgressInput = await options.getFreshProgress();
      } catch {
        return blocked("progress-unavailable");
      }
      if (secondProgressInput === null) return blocked("progress-unavailable");
      const secondProgress = progressBinding(secondProgressInput);
      if (!secondProgress) return blocked("progress-unavailable");
      if (
        secondProgress.revision !== firstProgress.revision ||
        secondProgress.fingerprint !== firstProgress.fingerprint
      ) return blocked("progress-changed");

      let secondReceiptInput: unknown;
      try {
        secondReceiptInput = await options.store.read();
      } catch {
        return blocked("receipt-store-unavailable");
      }
      const secondReceiptValidation = validateHoidEditorialReviewReceiptSnapshot(secondReceiptInput);
      if (secondReceiptValidation.status !== "valid") return blocked("invalid-receipts");
      if (
        secondReceiptValidation.snapshot.revision !== firstReceiptValidation.snapshot.revision ||
        secondReceiptValidation.fingerprint !== firstReceiptValidation.fingerprint
      ) return blocked("receipts-changed");

      return Object.freeze({
        status: "ready-for-authenticated-review",
        packetId: packet.packetId,
        draftId: packet.draftId,
        workId: packet.source.bookId,
        chapterNumber: packet.source.chapter,
        editionId: packet.source.editionId,
        progressRevision: firstProgress.revision,
        receiptFingerprint: firstReceiptValidation.fingerprint,
        sourceDocumentVerified: true,
        reviewerIdentity: "unverified-local",
        promotionAllowed: false,
        productionWritePerformed: false,
        answerAuthorizationEffect: "none",
        spoilerUnlockEffect: "none",
      });
    },
  });
}
