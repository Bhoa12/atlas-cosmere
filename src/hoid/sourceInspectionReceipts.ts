import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { HOID_EPUB_INGESTION_LIMITS } from "./epubIngestion";
import { getHoidReadingManifest } from "./readingManifest";
import { getHoidSourceIngestionPlan } from "./sourceIngestionPlan";
import { sha256Hex } from "./sha256";
import type { HoidPlannedChapterInspectionCandidate } from "./sourceIngestionExecution";

/**
 * Device-local receipt for a chapter document inspected from a user-selected
 * EPUB. It contains metadata and digests only: never source text, a file URI,
 * archive path, locator, filename, or provider payload.
 *
 * A receipt is not an editorial approval, production claim, reading-progress
 * update, or spoiler authorization.
 */
export type HoidSourceInspectionReceipt = Readonly<{
  schemaVersion: 1;
  status: "candidate-only";
  authorizationEffect: "none";
  editorialEffect: "none";
  summaryCreated: false;
  productionWritePerformed: false;
  workId: string;
  editionId: string;
  chapterNumber: number;
  byteLength: number;
  documentSha256: string;
  navigationSha256: string;
  inspectedAt: string;
  receiptFingerprint: string;
}>;

export type HoidSourceInspectionReceiptLedger = Readonly<{
  schemaVersion: 1;
  revision: number;
  scope: "device-local-metadata-only";
  sourceContentIncluded: false;
  authorizationEffect: "none";
  editorialEffect: "none";
  receipts: readonly HoidSourceInspectionReceipt[];
  fingerprint: string;
}>;

export interface HoidSourceInspectionReceiptStorePort {
  read(): Promise<unknown>;
  compareAndSwap(
    expectedRevision: number,
    next: HoidSourceInspectionReceiptLedger,
  ): Promise<"saved" | "conflict" | "unavailable">;
}

export type HoidSourceInspectionReceiptValidation =
  | Readonly<{ status: "valid"; receipt: HoidSourceInspectionReceipt }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-shape"
        | "unknown-work"
        | "manifest-mismatch"
        | "invalid-chapter"
        | "invalid-byte-length"
        | "invalid-digest"
        | "invalid-timestamp"
        | "invalid-fingerprint";
    }>;

export type HoidSourceInspectionReceiptLedgerValidation =
  | Readonly<{ status: "valid"; ledger: HoidSourceInspectionReceiptLedger }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-shape"
        | "invalid-revision"
        | "invalid-receipts"
        | "duplicate-receipt"
        | "non-canonical-order"
        | "invalid-fingerprint";
    }>;

export type HoidSourceInspectionReceiptCreation =
  | Readonly<{ status: "ready"; receipt: HoidSourceInspectionReceipt }>
  | Readonly<{
      status: "rejected";
      reason: "invalid-candidate" | "stale-task" | "manifest-mismatch" | "invalid-timestamp";
    }>;

export type HoidSourceInspectionReceiptAppendResult = Readonly<{
  status: "saved" | "unchanged" | "conflict" | "unavailable" | "rejected";
  receiptCount: number;
  reason?: string;
}>;

const RECEIPT_KEYS = new Set([
  "schemaVersion",
  "status",
  "authorizationEffect",
  "editorialEffect",
  "summaryCreated",
  "productionWritePerformed",
  "workId",
  "editionId",
  "chapterNumber",
  "byteLength",
  "documentSha256",
  "navigationSha256",
  "inspectedAt",
  "receiptFingerprint",
]);

const LEDGER_KEYS = new Set([
  "schemaVersion",
  "revision",
  "scope",
  "sourceContentIncluded",
  "authorizationEffect",
  "editorialEffect",
  "receipts",
  "fingerprint",
]);

const CANDIDATE_KEYS = [
  "schemaVersion",
  "status",
  "workId",
  "title",
  "chapterNumber",
  "editionId",
  "sourceGroup",
  "locatorId",
  "navigationHref",
  "byteLength",
  "documentSha256",
  "navigationSha256",
  "packageSourceFingerprint",
  "candidateFingerprint",
  "minimumReaderChapter",
  "authorizationEffect",
  "editorialEffect",
  "summaryCreated",
  "productionWritePerformed",
] as const;

const MAX_RECEIPTS = 2_048;

function exactDataRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string> | readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const allowed = allowedKeys instanceof Set ? allowedKeys : new Set(allowedKeys);
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowed.size) return null;

    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      result[key] = descriptor.value;
    }
    for (const key of allowed) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 24) return false;
  try {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
  } catch {
    return false;
  }
}

function receiptPayload(receipt: Omit<HoidSourceInspectionReceipt, "receiptFingerprint">): string {
  return JSON.stringify([
    receipt.schemaVersion,
    receipt.status,
    receipt.authorizationEffect,
    receipt.editorialEffect,
    receipt.summaryCreated,
    receipt.productionWritePerformed,
    receipt.workId,
    receipt.editionId,
    receipt.chapterNumber,
    receipt.byteLength,
    receipt.documentSha256,
    receipt.navigationSha256,
    receipt.inspectedAt,
  ]);
}

function fingerprintReceipt(
  receipt: Omit<HoidSourceInspectionReceipt, "receiptFingerprint">,
): string {
  return sha256Hex(receiptPayload(receipt));
}

function ledgerPayload(
  revision: number,
  receipts: readonly HoidSourceInspectionReceipt[],
): string {
  return JSON.stringify({
    schemaVersion: 1,
    revision,
    receipts: receipts.map(receipt => [
      receipt.workId,
      receipt.editionId,
      receipt.chapterNumber,
      receipt.byteLength,
      receipt.documentSha256,
      receipt.navigationSha256,
      receipt.inspectedAt,
      receipt.receiptFingerprint,
    ]),
  });
}

function fingerprintLedger(
  revision: number,
  receipts: readonly HoidSourceInspectionReceipt[],
): string {
  return sha256Hex(ledgerPayload(revision, receipts));
}

function receiptKey(receipt: HoidSourceInspectionReceipt): string {
  return `${receipt.workId}\u0000${receipt.editionId}\u0000${receipt.chapterNumber}`;
}

function compareReceipts(
  left: HoidSourceInspectionReceipt,
  right: HoidSourceInspectionReceipt,
): number {
  return left.workId.localeCompare(right.workId) ||
    left.editionId.localeCompare(right.editionId) ||
    left.chapterNumber - right.chapterNumber;
}

export function validateHoidSourceInspectionReceipt(
  value: unknown,
): HoidSourceInspectionReceiptValidation {
  const raw = exactDataRecord(value, RECEIPT_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    raw.status !== "candidate-only" ||
    raw.authorizationEffect !== "none" ||
    raw.editorialEffect !== "none" ||
    raw.summaryCreated !== false ||
    raw.productionWritePerformed !== false
  ) {
    return Object.freeze({ status: "invalid", reason: "invalid-shape" });
  }

  if (typeof raw.workId !== "string" ||
      !HOID_SOURCE_BIBLIOGRAPHY.some(work => work.id === raw.workId)) {
    return Object.freeze({ status: "invalid", reason: "unknown-work" });
  }

  const manifestResult = getHoidReadingManifest(raw.workId);
  if (manifestResult.status !== "ready" ||
      typeof raw.editionId !== "string" ||
      raw.editionId !== manifestResult.manifest.editionId ||
      typeof raw.navigationSha256 !== "string" ||
      raw.navigationSha256 !== manifestResult.manifest.navigationSha256) {
    return Object.freeze({ status: "invalid", reason: "manifest-mismatch" });
  }

  if (typeof raw.chapterNumber !== "number" ||
      !Number.isSafeInteger(raw.chapterNumber) ||
      raw.chapterNumber < 1) {
    return Object.freeze({ status: "invalid", reason: "invalid-chapter" });
  }

  const matchingUnits = manifestResult.manifest.units.filter(
    unit => unit.chapterNumber === raw.chapterNumber,
  );
  if (matchingUnits.length !== 1 || !matchingUnits[0].locatorId) {
    return Object.freeze({ status: "invalid", reason: "invalid-chapter" });
  }

  if (typeof raw.byteLength !== "number" ||
      !Number.isSafeInteger(raw.byteLength) ||
      raw.byteLength < 1 ||
      raw.byteLength > HOID_EPUB_INGESTION_LIMITS.maxChapterDocumentBytes) {
    return Object.freeze({ status: "invalid", reason: "invalid-byte-length" });
  }

  if (!isSha256(raw.documentSha256) || !isSha256(raw.navigationSha256)) {
    return Object.freeze({ status: "invalid", reason: "invalid-digest" });
  }

  if (!isCanonicalIsoTimestamp(raw.inspectedAt)) {
    return Object.freeze({ status: "invalid", reason: "invalid-timestamp" });
  }

  if (!isSha256(raw.receiptFingerprint)) {
    return Object.freeze({ status: "invalid", reason: "invalid-fingerprint" });
  }

  const payload = {
    schemaVersion: 1 as const,
    status: "candidate-only" as const,
    authorizationEffect: "none" as const,
    editorialEffect: "none" as const,
    summaryCreated: false as const,
    productionWritePerformed: false as const,
    workId: raw.workId,
    editionId: raw.editionId,
    chapterNumber: raw.chapterNumber,
    byteLength: raw.byteLength,
    documentSha256: raw.documentSha256,
    navigationSha256: raw.navigationSha256,
    inspectedAt: raw.inspectedAt,
  };
  if (fingerprintReceipt(payload) !== raw.receiptFingerprint) {
    return Object.freeze({ status: "invalid", reason: "invalid-fingerprint" });
  }

  return Object.freeze({
    status: "valid",
    receipt: Object.freeze({ ...payload, receiptFingerprint: raw.receiptFingerprint }),
  });
}

export function createHoidEmptySourceInspectionReceiptLedger(): HoidSourceInspectionReceiptLedger {
  const receipts = Object.freeze([]) as readonly HoidSourceInspectionReceipt[];
  return Object.freeze({
    schemaVersion: 1,
    revision: 0,
    scope: "device-local-metadata-only",
    sourceContentIncluded: false,
    authorizationEffect: "none",
    editorialEffect: "none",
    receipts,
    fingerprint: fingerprintLedger(0, receipts),
  });
}

export function validateHoidSourceInspectionReceiptLedger(
  value: unknown,
): HoidSourceInspectionReceiptLedgerValidation {
  const raw = exactDataRecord(value, LEDGER_KEYS);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    raw.scope !== "device-local-metadata-only" ||
    raw.sourceContentIncluded !== false ||
    raw.authorizationEffect !== "none" ||
    raw.editorialEffect !== "none"
  ) return Object.freeze({ status: "invalid", reason: "invalid-shape" });

  if (typeof raw.revision !== "number" ||
      !Number.isSafeInteger(raw.revision) ||
      raw.revision < 0) {
    return Object.freeze({ status: "invalid", reason: "invalid-revision" });
  }

  if (!Array.isArray(raw.receipts) || raw.receipts.length > MAX_RECEIPTS) {
    return Object.freeze({ status: "invalid", reason: "invalid-receipts" });
  }

  try {
    const keys = Reflect.ownKeys(raw.receipts);
    if (keys.length !== raw.receipts.length + 1 || !keys.includes("length")) {
      return Object.freeze({ status: "invalid", reason: "invalid-receipts" });
    }

    const receipts: HoidSourceInspectionReceipt[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < raw.receipts.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(raw.receipts, String(index));
      if (!descriptor ||
          !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
          descriptor.enumerable !== true) {
        return Object.freeze({ status: "invalid", reason: "invalid-receipts" });
      }
      const validation = validateHoidSourceInspectionReceipt(descriptor.value);
      if (validation.status !== "valid") {
        return Object.freeze({ status: "invalid", reason: "invalid-receipts" });
      }
      const key = receiptKey(validation.receipt);
      if (seen.has(key)) {
        return Object.freeze({ status: "invalid", reason: "duplicate-receipt" });
      }
      seen.add(key);
      receipts.push(validation.receipt);
    }

    const sorted = [...receipts].sort(compareReceipts);
    if (sorted.some((receipt, index) => receipt !== receipts[index])) {
      return Object.freeze({ status: "invalid", reason: "non-canonical-order" });
    }

    if (!isSha256(raw.fingerprint) ||
        fingerprintLedger(raw.revision, receipts) !== raw.fingerprint) {
      return Object.freeze({ status: "invalid", reason: "invalid-fingerprint" });
    }

    return Object.freeze({
      status: "valid",
      ledger: Object.freeze({
        schemaVersion: 1,
        revision: raw.revision,
        scope: "device-local-metadata-only",
        sourceContentIncluded: false,
        authorizationEffect: "none",
        editorialEffect: "none",
        receipts: Object.freeze(receipts),
        fingerprint: raw.fingerprint,
      }),
    });
  } catch {
    return Object.freeze({ status: "invalid", reason: "invalid-receipts" });
  }
}

export function createHoidSourceInspectionReceiptFromCandidate(
  candidateInput: unknown,
  inspectedAt: unknown,
): HoidSourceInspectionReceiptCreation {
  if (!isCanonicalIsoTimestamp(inspectedAt)) {
    return Object.freeze({ status: "rejected", reason: "invalid-timestamp" });
  }
  const candidate = exactDataRecord(candidateInput, CANDIDATE_KEYS);
  if (
    !candidate ||
    candidate.schemaVersion !== 1 ||
    candidate.status !== "candidate-only" ||
    typeof candidate.workId !== "string" ||
    typeof candidate.chapterNumber !== "number" ||
    !Number.isSafeInteger(candidate.chapterNumber) ||
    candidate.chapterNumber < 1 ||
    typeof candidate.title !== "string" ||
    typeof candidate.editionId !== "string" ||
    (candidate.sourceGroup !== "cosmere.epub" && candidate.sourceGroup !== "roshar-epubs") ||
    typeof candidate.locatorId !== "string" ||
    typeof candidate.navigationHref !== "string" ||
    typeof candidate.byteLength !== "number" ||
    !Number.isSafeInteger(candidate.byteLength) ||
    candidate.byteLength < 1 ||
    candidate.byteLength > HOID_EPUB_INGESTION_LIMITS.maxChapterDocumentBytes ||
    !isSha256(candidate.documentSha256) ||
    !isSha256(candidate.navigationSha256) ||
    !isSha256(candidate.packageSourceFingerprint) ||
    !isSha256(candidate.candidateFingerprint) ||
    typeof candidate.minimumReaderChapter !== "number" ||
    !Number.isSafeInteger(candidate.minimumReaderChapter) ||
    candidate.minimumReaderChapter !== candidate.chapterNumber + 1 ||
    candidate.authorizationEffect !== "none" ||
    candidate.editorialEffect !== "none" ||
    candidate.summaryCreated !== false ||
    candidate.productionWritePerformed !== false
  ) return Object.freeze({ status: "rejected", reason: "invalid-candidate" });

  const task = getHoidSourceIngestionPlan().tasks.find(
    item => item.workId === candidate.workId && item.chapterNumber === candidate.chapterNumber,
  );
  if (!task) return Object.freeze({ status: "rejected", reason: "stale-task" });

  const manifestResult = getHoidReadingManifest(task.workId);
  const bibliographyWork = HOID_SOURCE_BIBLIOGRAPHY.find(work => work.id === task.workId);
  if (
    manifestResult.status !== "ready" ||
    !bibliographyWork ||
    task.editionId !== manifestResult.manifest.editionId ||
    candidate.title !== task.title ||
    candidate.sourceGroup !== task.sourceGroup ||
    candidate.editionId !== task.editionId ||
    candidate.locatorId !== task.locatorId ||
    candidate.navigationHref !== task.navigationHref ||
    candidate.navigationSha256 !== manifestResult.manifest.navigationSha256 ||
    task.minimumReaderChapter !== candidate.minimumReaderChapter
  ) return Object.freeze({ status: "rejected", reason: "manifest-mismatch" });

  const base = Object.freeze({
    schemaVersion: 1 as const,
    status: "candidate-only" as const,
    authorizationEffect: "none" as const,
    editorialEffect: "none" as const,
    summaryCreated: false as const,
    productionWritePerformed: false as const,
    workId: task.workId,
    editionId: task.editionId,
    chapterNumber: task.chapterNumber,
    byteLength: candidate.byteLength,
    documentSha256: candidate.documentSha256,
    navigationSha256: candidate.navigationSha256,
    inspectedAt,
  });
  return Object.freeze({
    status: "ready",
    receipt: Object.freeze({ ...base, receiptFingerprint: fingerprintReceipt(base) }),
  });
}

export type HoidSourceInspectionReceiptRecordResult =
  | Readonly<{ status: "added"; ledger: HoidSourceInspectionReceiptLedger }>
  | Readonly<{ status: "unchanged"; ledger: HoidSourceInspectionReceiptLedger }>
  | Readonly<{ status: "conflict" }>
  | Readonly<{ status: "invalid" }>;

export function recordHoidSourceInspectionReceipt(
  ledgerInput: unknown,
  receiptInput: unknown,
): HoidSourceInspectionReceiptRecordResult {
  const ledgerValidation = validateHoidSourceInspectionReceiptLedger(ledgerInput);
  const receiptValidation = validateHoidSourceInspectionReceipt(receiptInput);
  if (ledgerValidation.status !== "valid" || receiptValidation.status !== "valid") {
    return Object.freeze({ status: "invalid" });
  }

  const current = ledgerValidation.ledger;
  const receipt = receiptValidation.receipt;
  const existing = current.receipts.find(item => receiptKey(item) === receiptKey(receipt));
  if (existing) {
    return existing.documentSha256 === receipt.documentSha256 &&
      existing.byteLength === receipt.byteLength &&
      existing.navigationSha256 === receipt.navigationSha256
      ? Object.freeze({ status: "unchanged", ledger: current })
      : Object.freeze({ status: "conflict" });
  }

  if (current.revision >= Number.MAX_SAFE_INTEGER || current.receipts.length >= MAX_RECEIPTS) {
    return Object.freeze({ status: "invalid" });
  }

  const receipts = Object.freeze([...current.receipts, receipt].sort(compareReceipts));
  const revision = current.revision + 1;
  const next = Object.freeze({
    schemaVersion: 1 as const,
    revision,
    scope: "device-local-metadata-only" as const,
    sourceContentIncluded: false as const,
    authorizationEffect: "none" as const,
    editorialEffect: "none" as const,
    receipts,
    fingerprint: fingerprintLedger(revision, receipts),
  });
  return Object.freeze({ status: "added", ledger: next });
}

export async function appendHoidSourceInspectionReceipt(
  store: HoidSourceInspectionReceiptStorePort,
  candidate: HoidPlannedChapterInspectionCandidate,
  inspectedAt: string,
): Promise<HoidSourceInspectionReceiptAppendResult> {
  const created = createHoidSourceInspectionReceiptFromCandidate(candidate, inspectedAt);
  if (created.status !== "ready") {
    return Object.freeze({ status: "rejected", receiptCount: 0, reason: created.reason });
  }

  try {
    const ledgerValidation = validateHoidSourceInspectionReceiptLedger(await store.read());
    if (ledgerValidation.status !== "valid") {
      return Object.freeze({ status: "unavailable", receiptCount: 0, reason: "stored-ledger-invalid" });
    }

    const next = recordHoidSourceInspectionReceipt(ledgerValidation.ledger, created.receipt);
    if (next.status === "invalid") {
      return Object.freeze({ status: "unavailable", receiptCount: ledgerValidation.ledger.receipts.length });
    }
    if (next.status === "conflict") {
      return Object.freeze({ status: "conflict", receiptCount: ledgerValidation.ledger.receipts.length });
    }
    if (next.status === "unchanged") {
      return Object.freeze({ status: "unchanged", receiptCount: next.ledger.receipts.length });
    }

    const saved = await store.compareAndSwap(ledgerValidation.ledger.revision, next.ledger);
    if (saved === "saved") {
      return Object.freeze({ status: "saved", receiptCount: next.ledger.receipts.length });
    }
    if (saved === "conflict") {
      return Object.freeze({ status: "conflict", receiptCount: ledgerValidation.ledger.receipts.length });
    }
    return Object.freeze({ status: "unavailable", receiptCount: ledgerValidation.ledger.receipts.length });
  } catch {
    return Object.freeze({ status: "unavailable", receiptCount: 0, reason: "storage-unavailable" });
  }
}