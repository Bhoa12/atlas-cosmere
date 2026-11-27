import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import {
  buildHoidEditorialReviewPackets,
  validateHoidEditorialReviewReceipt,
  type HoidEditorialReviewReceipt,
} from "./editorialReviewPackets";
import { sha256Hex } from "./sha256";

export type HoidEditorialReviewReceiptSnapshot = Readonly<{
  schemaVersion: 1;
  revision: number;
  receipts: readonly HoidEditorialReviewReceipt[];
}>;

export type HoidEditorialReviewReceiptSnapshotValidation =
  | Readonly<{
      status: "valid";
      snapshot: HoidEditorialReviewReceiptSnapshot;
      fingerprint: string;
    }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-shape"
        | "invalid-revision"
        | "invalid-receipts"
        | "duplicate-receipt"
        | "orphan-receipt"
        | "invalid-receipt"
        | "catalogue-unavailable";
    }>;

export type HoidEditorialReviewReceiptStorePort = Readonly<{
  read(): Promise<unknown>;
  compareAndSwap(
    expectedRevision: number,
    next: HoidEditorialReviewReceiptSnapshot,
  ): Promise<"saved" | "conflict" | "unavailable">;
}>;

const MAX_RECEIPTS = 512;
const SNAPSHOT_KEYS = new Set(["schemaVersion", "revision", "receipts"]);

function canonicalRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== allowedKeys.size ||
      keys.some(key => typeof key !== "string" || !allowedKeys.has(key))
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

function denseArray(value: unknown): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > MAX_RECEIPTS
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

function snapshotFingerprint(snapshot: HoidEditorialReviewReceiptSnapshot): string {
  return sha256Hex(JSON.stringify([
    "hoid-editorial-review-receipt-snapshot-v1",
    snapshot.revision,
    snapshot.receipts.map(receipt => [
      receipt.packetId,
      receipt.draftId,
      receipt.summarySha256,
      receipt.sourceDocumentSha256,
      receipt.decision,
      receipt.reviewerId,
      receipt.reviewedAt,
      receipt.checklist.factualAccuracy,
      receipt.checklist.completeness,
      receipt.checklist.originality,
      receipt.checklist.spoilerCeiling,
      receipt.checklist.provenance,
      receipt.noteCodes,
    ]),
  ]));
}

export function getDefaultHoidEditorialReviewReceiptSnapshot():
HoidEditorialReviewReceiptSnapshot {
  return Object.freeze({
    schemaVersion: 1,
    revision: 0,
    receipts: Object.freeze([]),
  });
}

/**
 * Validate a device-local receipt snapshot against the current deterministic
 * editorial packets. Only receipt metadata is retained: source passages,
 * summaries, locators, document paths and EPUB bytes are never part of this
 * persistence contract.
 *
 * A valid local approval is still unauthenticated and remains awaiting the
 * independent source-control promotion authority.
 */
export function validateHoidEditorialReviewReceiptSnapshot(
  value: unknown,
): HoidEditorialReviewReceiptSnapshotValidation {
  const raw = canonicalRecord(value, SNAPSHOT_KEYS);
  if (!raw || raw.schemaVersion !== 1) {
    return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  }
  if (
    typeof raw.revision !== "number" ||
    !Number.isSafeInteger(raw.revision) ||
    raw.revision < 0
  ) return Object.freeze({ status: "invalid", reason: "invalid-revision" });

  const receiptsInput = denseArray(raw.receipts);
  if (!receiptsInput) return Object.freeze({ status: "invalid", reason: "invalid-receipts" });

  const packetResult = buildHoidEditorialReviewPackets(HOID_EDITORIAL_DRAFTS);
  if (packetResult.status !== "ready") {
    return Object.freeze({ status: "invalid", reason: "catalogue-unavailable" });
  }
  const packetById = new Map(packetResult.packets.map(packet => [packet.packetId, packet]));
  const seen = new Set<string>();
  const receipts: HoidEditorialReviewReceipt[] = [];

  for (const input of receiptsInput) {
    const packetId = ownDataString(input, "packetId");
    if (!packetId) return Object.freeze({ status: "invalid", reason: "invalid-receipts" });
    if (seen.has(packetId)) {
      return Object.freeze({ status: "invalid", reason: "duplicate-receipt" });
    }
    const packet = packetById.get(packetId);
    if (!packet) return Object.freeze({ status: "invalid", reason: "orphan-receipt" });

    const validation = validateHoidEditorialReviewReceipt(packet, input);
    if (validation.status !== "valid") {
      return Object.freeze({ status: "invalid", reason: "invalid-receipt" });
    }
    seen.add(packetId);
    receipts.push(validation.receipt);
  }

  receipts.sort((left, right) =>
    left.packetId < right.packetId ? -1 : left.packetId > right.packetId ? 1 : 0,
  );
  const snapshot: HoidEditorialReviewReceiptSnapshot = Object.freeze({
    schemaVersion: 1,
    revision: raw.revision,
    receipts: Object.freeze(receipts),
  });
  return Object.freeze({
    status: "valid",
    snapshot,
    fingerprint: snapshotFingerprint(snapshot),
  });
}
