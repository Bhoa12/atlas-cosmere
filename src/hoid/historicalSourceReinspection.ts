import { createHoidEpubSourceDescriptor } from "./epubImportSelection";
import {
  HOID_EPUB_INGESTION_LIMITS,
  type HoidEpubIngestionService,
  type HoidEpubPackageInspectionCandidate,
} from "./epubIngestion";
import { getHoidReadingManifest } from "./readingManifest";
import { validateHoidSourceInspectionReceipt } from "./sourceInspectionReceipts";

/**
 * Narrow provider-neutral port. Implementations may use Expo, a browser, or a
 * test adapter, but must return the package candidate issued by that same
 * ingestion instance.
 */
export type HoidHistoricalChapterInspectionPort = Pick<
  HoidEpubIngestionService,
  "inspectChapterDocument"
>;

export type HoidHistoricalSourceReinspectionAttestation = Readonly<{
  schemaVersion: 1;
  scope: "ephemeral-historical-source-reinspection";
  workId: string;
  editionId: string;
  chapterNumber: number;
  verifiedAt: string;
  sourceAvailability: "verified-local";
  sourceContentIncluded: false;
  sourceAccessPerformed: true;
  documentUnchanged: true;
  reviewCanStart: true;
  summaryCreated: false;
  productionWritePerformed: false;
  authorizationEffect: "none";
  editorialEffect: "none";
}>;

export type HoidHistoricalSourceReinspectionResult =
  | Readonly<{
      status: "verified";
      attestation: HoidHistoricalSourceReinspectionAttestation;
    }>
  | Readonly<{
      status: "changed";
      reason: "document-digest-mismatch" | "document-length-mismatch";
      existingReceiptPreserved: true;
      sourceAccessPerformed: true;
      sourceContentIncluded: false;
      reviewCanStart: false;
      summaryCreated: false;
      productionWritePerformed: false;
      authorizationEffect: "none";
      editorialEffect: "none";
    }>
  | Readonly<{
      status: "rejected";
      reason:
        | "invalid-receipt"
        | "invalid-source-descriptor"
        | "manifest-unavailable"
        | "chapter-not-uniquely-verifiable"
        | "invalid-navigation-locator"
        | "package-candidate-mismatch"
        | "inspection-rejected"
        | "chapter-candidate-mismatch"
        | "invalid-timestamp"
        | "cancelled"
        | "inspection-failed";
      sourceAccessPerformed: false;
      sourceContentIncluded: false;
      reviewCanStart: false;
      authorizationEffect: "none";
      editorialEffect: "none";
    }>;

const SOURCE_KEYS = ["sourceId", "workId", "editionId", "sourceGroup"] as const;
const PACKAGE_KEYS = [
  "status",
  "sourceId",
  "workId",
  "declaredEditionId",
  "sourceGroup",
  "editionBinding",
  "packageVersion",
  "title",
  "language",
  "uniqueIdentifier",
  "archiveEntryCount",
  "manifestItemCount",
  "spineItemCount",
  "navigationEntryCount",
  "navigationXhtmlTargetCount",
  "archiveInventorySha256",
  "mimetypeSha256",
  "containerDocumentSha256",
  "packageDocumentSha256",
  "navigationDocumentSha256",
  "sourceFingerprint",
] as const;
const CHAPTER_KEYS = [
  "status",
  "workId",
  "declaredEditionId",
  "sourceGroup",
  "navigationHref",
  "byteLength",
  "documentSha256",
  "navigationDocumentSha256",
  "packageSourceFingerprint",
  "candidateFingerprint",
] as const;

function exactDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== expectedKeys.length || ownKeys.some(key => typeof key !== "string")) {
      return null;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const record = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }
    if (ownKeys.some(key => !expectedKeys.includes(key as string))) return null;
    return record;
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

function resolveVerifiedNavigationHref(
  locatorId: unknown,
  editionId: string,
  navigationSha256: string,
): string | null {
  if (typeof locatorId !== "string" || locatorId.length > 4096) return null;
  const prefix = "nav:" + editionId + ":" + navigationSha256 + ":";
  if (!locatorId.startsWith(prefix)) return null;

  const href = locatorId.slice(prefix.length);
  if (
    href.length === 0 ||
    href.length > 2048 ||
    href.startsWith("/") ||
    href.startsWith("//") ||
    href.includes("\\") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(href) ||
    /%2f|%5c/i.test(href) ||
    /%(?![0-9a-f]{2})/i.test(href) ||
    /[\u0000-\u001f\u007f]/.test(href)
  ) return null;

  const path = href.split(/[?#]/, 1)[0];
  if (!path) return null;
  for (const segment of path.split("/")) {
    if (!segment || segment === "." || segment === "..") return null;
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(decoded)
    ) return null;
  }
  return href;
}

function rejected(
  reason: Extract<HoidHistoricalSourceReinspectionResult, { status: "rejected" }>["reason"],
): HoidHistoricalSourceReinspectionResult {
  return Object.freeze({
    status: "rejected",
    reason,
    sourceAccessPerformed: false,
    sourceContentIncluded: false,
    reviewCanStart: false,
    authorizationEffect: "none",
    editorialEffect: "none",
  });
}

/**
 * Reinspect one historical chapter after explicit local source reselection.
 *
 * The receipt supplies only the expected edition/chapter identity and digest.
 * The caller must supply a newly selected source, a package candidate produced
 * by the same ingestion instance, and that instance's chapter-inspection port.
 * Only an exact document digest and byte-length match can produce an ephemeral
 * handoff attestation. Changed documents never overwrite the old receipt.
 *
 * This function does not read or return prose, create summaries, persist a new
 * receipt, mutate reading progress, approve editorial material, or authorize
 * narrative answers.
 */
export async function reinspectHoidHistoricalSourceChapter(input: Readonly<{
  receipt: unknown;
  source: unknown;
  packageCandidate: unknown;
  ingestion: HoidHistoricalChapterInspectionPort;
  verifiedAt: unknown;
  signal?: AbortSignal;
}>): Promise<HoidHistoricalSourceReinspectionResult> {
  if (!isCanonicalIsoTimestamp(input.verifiedAt)) return rejected("invalid-timestamp");
  if (input.signal?.aborted) return rejected("cancelled");

  const receiptValidation = validateHoidSourceInspectionReceipt(input.receipt);
  if (receiptValidation.status !== "valid") return rejected("invalid-receipt");
  const receipt = receiptValidation.receipt;

  const sourceRecord = exactDataRecord(input.source, SOURCE_KEYS);
  if (sourceRecord === null) return rejected("invalid-source-descriptor");
  const descriptor = createHoidEpubSourceDescriptor(
    sourceRecord.sourceId,
    sourceRecord.workId,
    sourceRecord.editionId,
  );
  if (
    descriptor === null ||
    sourceRecord.sourceGroup !== descriptor.sourceGroup ||
    descriptor.workId !== receipt.workId ||
    descriptor.editionId !== receipt.editionId
  ) return rejected("invalid-source-descriptor");

  const manifestResult = getHoidReadingManifest(receipt.workId);
  if (
    manifestResult.status !== "ready" ||
    manifestResult.manifest.editionId !== receipt.editionId ||
    manifestResult.manifest.navigationSha256 !== receipt.navigationSha256
  ) return rejected("manifest-unavailable");

  const matchingUnits = manifestResult.manifest.units.filter(
    unit => unit.chapterNumber === receipt.chapterNumber && typeof unit.locatorId === "string",
  );
  if (matchingUnits.length !== 1) return rejected("chapter-not-uniquely-verifiable");

  const navigationHref = resolveVerifiedNavigationHref(
    matchingUnits[0].locatorId,
    receipt.editionId,
    receipt.navigationSha256,
  );
  if (navigationHref === null) return rejected("invalid-navigation-locator");

  const packageRecord = exactDataRecord(input.packageCandidate, PACKAGE_KEYS);
  if (
    packageRecord === null ||
    packageRecord.status !== "candidate-only" ||
    packageRecord.sourceId !== descriptor.sourceId ||
    packageRecord.workId !== receipt.workId ||
    packageRecord.declaredEditionId !== receipt.editionId ||
    packageRecord.sourceGroup !== descriptor.sourceGroup ||
    packageRecord.editionBinding !== "catalogue-navigation-digest-match" ||
    packageRecord.navigationDocumentSha256 !== receipt.navigationSha256 ||
    !isSha256(packageRecord.sourceFingerprint)
  ) return rejected("package-candidate-mismatch");

  let inspection;
  try {
    inspection = await input.ingestion.inspectChapterDocument(
      input.packageCandidate,
      navigationHref,
      input.signal,
    );
  } catch {
    return rejected(input.signal?.aborted ? "cancelled" : "inspection-failed");
  }

  if (input.signal?.aborted) return rejected("cancelled");
  if (inspection.status !== "candidate") {
    return rejected(inspection.reason === "cancelled" ? "cancelled" : "inspection-rejected");
  }

  const chapterRecord = exactDataRecord(inspection.candidate, CHAPTER_KEYS);
  if (
    chapterRecord === null ||
    chapterRecord.status !== "candidate-only" ||
    chapterRecord.workId !== receipt.workId ||
    chapterRecord.declaredEditionId !== receipt.editionId ||
    chapterRecord.sourceGroup !== descriptor.sourceGroup ||
    chapterRecord.navigationHref !== navigationHref ||
    chapterRecord.navigationDocumentSha256 !== receipt.navigationSha256 ||
    chapterRecord.packageSourceFingerprint !== packageRecord.sourceFingerprint ||
    typeof chapterRecord.byteLength !== "number" ||
    !Number.isSafeInteger(chapterRecord.byteLength) ||
    chapterRecord.byteLength < 1 ||
    chapterRecord.byteLength > HOID_EPUB_INGESTION_LIMITS.maxChapterDocumentBytes ||
    !isSha256(chapterRecord.documentSha256) ||
    !isSha256(chapterRecord.candidateFingerprint)
  ) return rejected("chapter-candidate-mismatch");

  if (chapterRecord.documentSha256 !== receipt.documentSha256) {
    return Object.freeze({
      status: "changed",
      reason: "document-digest-mismatch",
      existingReceiptPreserved: true,
      sourceAccessPerformed: true,
      sourceContentIncluded: false,
      reviewCanStart: false,
      summaryCreated: false,
      productionWritePerformed: false,
      authorizationEffect: "none",
      editorialEffect: "none",
    });
  }
  if (chapterRecord.byteLength !== receipt.byteLength) {
    return Object.freeze({
      status: "changed",
      reason: "document-length-mismatch",
      existingReceiptPreserved: true,
      sourceAccessPerformed: true,
      sourceContentIncluded: false,
      reviewCanStart: false,
      summaryCreated: false,
      productionWritePerformed: false,
      authorizationEffect: "none",
      editorialEffect: "none",
    });
  }

  return Object.freeze({
    status: "verified",
    attestation: Object.freeze({
      schemaVersion: 1,
      scope: "ephemeral-historical-source-reinspection",
      workId: receipt.workId,
      editionId: receipt.editionId,
      chapterNumber: receipt.chapterNumber,
      verifiedAt: input.verifiedAt,
      sourceAvailability: "verified-local",
      sourceContentIncluded: false,
      sourceAccessPerformed: true,
      documentUnchanged: true,
      reviewCanStart: true,
      summaryCreated: false,
      productionWritePerformed: false,
      authorizationEffect: "none",
      editorialEffect: "none",
    }),
  });
}
