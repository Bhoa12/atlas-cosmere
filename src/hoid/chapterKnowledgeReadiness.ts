import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { HOID_APPROVED_CLAIMS, HOID_EDITORIAL_KNOWLEDGE } from "./editorialRegistry";
import type { HoidEpubEditorialSourceCoverageAuditResult } from "./epubEditorialSourceCoverageAudit";
import { getHoidReadingManifest } from "./readingManifest";
import {
  getVerifiedChapterDocumentNumbers,
  getVerifiedChapterDocumentSha256,
} from "./verifiedChapterDocuments";
import { getVerifiedChapterLocatorId } from "./verifiedChapterLocators";

export type HoidChapterKnowledgeReadinessAuditStatus =
  | "not-provided"
  | "completed"
  | "cancelled"
  | "unavailable"
  | "invalid";

export type HoidChapterKnowledgeReadinessUnit = Readonly<{
  unitId: string;
  ordinal: number;
  chapterNumber: number;
  navigationStatus: "verified" | "identity-only" | "ambiguous" | "unverified";
  bodyDigestStatus: "registered" | "not-registered";
  localSourceStatus: "not-audited" | "available" | "unavailable";
  pendingReviewSummaryCount: number;
  productionKnowledgeEntryCount: number;
  approvedClaimReferenceCount: number;
  editorialStatus:
    | "not-staged"
    | "pending-review"
    | "production-present"
    | "pending-and-production";
}>;

export type HoidChapterKnowledgeReadinessReport = Readonly<{
  schemaVersion: 1;
  scope: "metadata-only";
  integrity: "consistent" | "inconsistent";
  workId: string;
  title: string;
  editionId: string;
  manifestId: string;
  auditStatus: HoidChapterKnowledgeReadinessAuditStatus;
  auditScope: "registered-digest-chapters-only" | null;
  counts: Readonly<{
    totalReadingUnits: number;
    navigationVerifiedUnitCount: number;
    identityOnlyUnitCount: number;
    bodyDigestRegisteredUnitCount: number;
    currentlyAvailableUnitCount: number;
    currentlyUnavailableUnitCount: number;
    pendingReviewSummaryCount: number;
    productionKnowledgeEntryCount: number;
    approvedClaimReferenceCount: number;
    invalidEditorialRecordCount: number;
  }>;
  units: readonly HoidChapterKnowledgeReadinessUnit[];
  sourceTextIncluded: false;
  providerEgress: "none";
  authorizationEffect: "none";
  progressEffect: "none";
  spoilerUnlockEffect: "none";
}>;

export type HoidChapterKnowledgeReadinessResult =
  | Readonly<{ status: "ready"; report: HoidChapterKnowledgeReadinessReport }>
  | Readonly<{
      status: "unavailable";
      reason: "unknown-work" | "manifest-unavailable";
    }>;

type CanonicalAudit =
  | Readonly<{
      status: "completed";
      available: ReadonlySet<number>;
      unavailable: ReadonlySet<number>;
    }>
  | Readonly<{ status: "cancelled" | "unavailable" | "invalid" | "not-provided" }>;

const COMPLETED_AUDIT_KEYS = [
  "status",
  "workId",
  "editionId",
  "navigationSha256",
  "manifestId",
  "scope",
  "totalAllowlistedChapterCount",
  "checkedChapterCount",
  "availableChapterNumbers",
  "unavailableChapterNumbers",
  "sourceTextReturned",
  "sourceTextPersisted",
  "providerEgress",
] as const;
const CANCELLED_AUDIT_KEYS = [
  "status",
  "workId",
  "editionId",
  "navigationSha256",
  "manifestId",
  "checkedChapterCount",
] as const;
const UNAVAILABLE_AUDIT_REASONS = new Set([
  "unknown-work",
  "manifest-unavailable",
  "no-verified-chapters",
  "invalid-port",
]);

function exactDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedKeys.length ||
      keys.some(key => typeof key !== "string" || !expectedKeys.includes(key))
    ) return null;

    const record = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string") return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }
    return expectedKeys.every(key => Object.prototype.hasOwnProperty.call(record, key))
      ? record
      : null;
  } catch {
    return null;
  }
}

function canonicalChapterNumbers(value: unknown, maximum: number): readonly number[] | null {
  try {
    if (
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > maximum
    ) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;

    const numbers: number[] = [];
    let previous = 0;
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      const number = descriptor?.value;
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true ||
        typeof number !== "number" ||
        !Number.isSafeInteger(number) ||
        number < 1 ||
        number <= previous
      ) return null;
      numbers.push(number);
      previous = number;
    }
    return Object.freeze(numbers);
  } catch {
    return null;
  }
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function classifyAudit(
  value: unknown,
  workId: string,
  editionId: string,
  navigationSha256: string,
  manifestId: string,
  allowlistedNumbers: readonly number[],
): CanonicalAudit {
  if (value === undefined || value === null) return Object.freeze({ status: "not-provided" });

  try {
    const statusDescriptor = Object.getOwnPropertyDescriptor(value, "status");
    if (!statusDescriptor ||
        !Object.prototype.hasOwnProperty.call(statusDescriptor, "value") ||
        typeof statusDescriptor.value !== "string") {
      return Object.freeze({ status: "invalid" });
    }
    const status = statusDescriptor.value;

    if (status === "unavailable") {
      const record = exactDataRecord(value, ["status", "reason"]);
      return record && typeof record.reason === "string" && UNAVAILABLE_AUDIT_REASONS.has(record.reason)
        ? Object.freeze({ status: "unavailable" })
        : Object.freeze({ status: "invalid" });
    }

    if (status === "cancelled") {
      const record = exactDataRecord(value, CANCELLED_AUDIT_KEYS);
      if (
        !record ||
        record.workId !== workId ||
        record.editionId !== editionId ||
        record.navigationSha256 !== navigationSha256 ||
        record.manifestId !== manifestId ||
        typeof record.checkedChapterCount !== "number" ||
        !Number.isSafeInteger(record.checkedChapterCount) ||
        record.checkedChapterCount < 0 ||
        record.checkedChapterCount > allowlistedNumbers.length
      ) return Object.freeze({ status: "invalid" });
      return Object.freeze({ status: "cancelled" });
    }

    if (status !== "completed") return Object.freeze({ status: "invalid" });
    const record = exactDataRecord(value, COMPLETED_AUDIT_KEYS);
    if (
      !record ||
      record.workId !== workId ||
      record.editionId !== editionId ||
      record.navigationSha256 !== navigationSha256 ||
      record.manifestId !== manifestId ||
      record.scope !== "registered-digest-chapters-only" ||
      record.totalAllowlistedChapterCount !== allowlistedNumbers.length ||
      record.checkedChapterCount !== allowlistedNumbers.length ||
      record.sourceTextReturned !== false ||
      record.sourceTextPersisted !== false ||
      record.providerEgress !== "none"
    ) return Object.freeze({ status: "invalid" });

    const availableNumbers = canonicalChapterNumbers(
      record.availableChapterNumbers,
      allowlistedNumbers.length,
    );
    const unavailableNumbers = canonicalChapterNumbers(
      record.unavailableChapterNumbers,
      allowlistedNumbers.length,
    );
    if (!availableNumbers || !unavailableNumbers) return Object.freeze({ status: "invalid" });

    const combined = [...availableNumbers, ...unavailableNumbers].sort((a, b) => a - b);
    if (
      !sameNumbers(combined, allowlistedNumbers) ||
      availableNumbers.some(number => unavailableNumbers.includes(number))
    ) return Object.freeze({ status: "invalid" });

    return Object.freeze({
      status: "completed",
      available: new Set(availableNumbers),
      unavailable: new Set(unavailableNumbers),
    });
  } catch {
    return Object.freeze({ status: "invalid" });
  }
}

/**
 * Build a metadata-only, chapter-by-chapter view of the editorial pipeline.
 *
 * Navigation, registered body digests, current local availability, staged
 * summaries and production knowledge are independent stages. A completed
 * source audit is accepted only when it is bound to the exact reading
 * manifest and partitions every registered chapter digest without gaps.
 *
 * This report is descriptive only. It never authorizes answers, unlocks
 * spoilers, promotes summaries or changes reading progress.
 */
export function getHoidChapterKnowledgeReadiness(
  workIdInput: unknown,
  auditInput?: unknown,
): HoidChapterKnowledgeReadinessResult {
  if (
    typeof workIdInput !== "string" ||
    workIdInput.length === 0 ||
    workIdInput !== workIdInput.trim() ||
    !HOID_SOURCE_BIBLIOGRAPHY.some(work => work.id === workIdInput)
  ) return Object.freeze({ status: "unavailable", reason: "unknown-work" });

  const manifestResult = getHoidReadingManifest(workIdInput);
  if (manifestResult.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: "manifest-unavailable" });
  }
  const manifest = manifestResult.manifest;
  const source = HOID_SOURCE_BIBLIOGRAPHY.find(work => work.id === workIdInput);
  if (!source) return Object.freeze({ status: "unavailable", reason: "unknown-work" });

  const allowlistedNumbers = getVerifiedChapterDocumentNumbers(workIdInput);
  const audit = classifyAudit(
    auditInput,
    workIdInput,
    manifest.editionId,
    manifest.navigationSha256,
    manifest.manifestId,
    allowlistedNumbers,
  );

  const unitsByChapter = new Map<number, typeof manifest.units>();
  for (const unit of manifest.units) {
    const existing = unitsByChapter.get(unit.chapterNumber) ?? [];
    unitsByChapter.set(unit.chapterNumber, [...existing, unit]);
  }

  const pendingDraftsByUnit = new Map<string, number>();
  let invalidEditorialRecordCount = 0;
  for (const draft of HOID_EDITORIAL_DRAFTS) {
    if (draft.evidenceSource.bookId !== workIdInput) continue;
    const matches = unitsByChapter.get(draft.evidenceSource.chapter) ?? [];
    const digest = getVerifiedChapterDocumentSha256(
      workIdInput,
      manifest.editionId,
      manifest.navigationSha256,
      draft.evidenceSource.chapter,
    );
    const unit = matches.length === 1 ? matches[0] : undefined;
    if (
      !unit ||
      !unit.locatorId ||
      unit.locatorId !== draft.evidenceSource.locatorId ||
      digest === null ||
      draft.sourceIntegrity.editionId !== manifest.editionId ||
      draft.sourceIntegrity.navigationSha256 !== manifest.navigationSha256 ||
      draft.sourceIntegrity.documentSha256 !== digest ||
      draft.summaryKind !== "original-editorial-summary" ||
      draft.review.status !== "pending-review"
    ) {
      invalidEditorialRecordCount += 1;
      continue;
    }
    pendingDraftsByUnit.set(unit.id, (pendingDraftsByUnit.get(unit.id) ?? 0) + 1);
  }

  const productionEntriesByUnit = new Map<string, number>();
  for (const entry of HOID_EDITORIAL_KNOWLEDGE) {
    const evidence = entry.evidenceSource;
    if (!evidence || evidence.bookId !== workIdInput) continue;
    const matches = unitsByChapter.get(evidence.chapter) ?? [];
    const unit = matches.length === 1 ? matches[0] : undefined;
    if (!unit || !unit.locatorId || unit.locatorId !== evidence.locatorId) {
      invalidEditorialRecordCount += 1;
      continue;
    }
    productionEntriesByUnit.set(unit.id, (productionEntriesByUnit.get(unit.id) ?? 0) + 1);
  }

  const knowledgeById = new Map(HOID_EDITORIAL_KNOWLEDGE.map(entry => [entry.id, entry]));
  const approvedClaimsByUnit = new Map<string, Set<string>>();
  for (const claim of HOID_APPROVED_CLAIMS) {
    for (const evidenceId of claim.evidenceIds) {
      const entry = knowledgeById.get(evidenceId);
      if (!entry?.evidenceSource || entry.evidenceSource.bookId !== workIdInput) continue;
      const evidence = entry.evidenceSource;
      const matches = unitsByChapter.get(evidence.chapter) ?? [];
      const unit = matches.length === 1 ? matches[0] : undefined;
      if (!unit || !unit.locatorId || unit.locatorId !== evidence.locatorId) {
        invalidEditorialRecordCount += 1;
        continue;
      }
      const claimIds = approvedClaimsByUnit.get(unit.id) ?? new Set<string>();
      claimIds.add(claim.id);
      approvedClaimsByUnit.set(unit.id, claimIds);
    }
  }

  let navigationVerifiedUnitCount = 0;
  let identityOnlyUnitCount = 0;
  let bodyDigestRegisteredUnitCount = 0;
  let currentlyAvailableUnitCount = 0;
  let currentlyUnavailableUnitCount = 0;
  let pendingReviewSummaryCount = 0;
  let productionKnowledgeEntryCount = 0;
  let approvedClaimReferenceCount = 0;

  const units: HoidChapterKnowledgeReadinessUnit[] = manifest.units.map(unit => {
    const sameNumberUnits = unitsByChapter.get(unit.chapterNumber) ?? [];
    const isAmbiguous = manifest.ambiguousChapterNumbers.includes(unit.chapterNumber) ||
      sameNumberUnits.length > 1;
    const verifiedLocatorId = getVerifiedChapterLocatorId(
      workIdInput,
      manifest.editionId,
      manifest.navigationSha256,
      unit.chapterNumber,
    );
    const navigationStatus: HoidChapterKnowledgeReadinessUnit["navigationStatus"] =
      isAmbiguous
        ? unit.locatorId ? "identity-only" : "ambiguous"
        : unit.locatorId && unit.locatorId === verifiedLocatorId
          ? "verified"
          : "unverified";
    if (navigationStatus === "verified") navigationVerifiedUnitCount += 1;
    if (navigationStatus === "identity-only") identityOnlyUnitCount += 1;

    const digest = getVerifiedChapterDocumentSha256(
      workIdInput,
      manifest.editionId,
      manifest.navigationSha256,
      unit.chapterNumber,
    );
    const bodyDigestStatus = digest === null ? "not-registered" : "registered";
    if (bodyDigestStatus === "registered") bodyDigestRegisteredUnitCount += 1;

    let localSourceStatus: HoidChapterKnowledgeReadinessUnit["localSourceStatus"] = "not-audited";
    if (digest !== null && audit.status === "completed") {
      if (audit.available.has(unit.chapterNumber)) {
        localSourceStatus = "available";
        currentlyAvailableUnitCount += 1;
      } else if (audit.unavailable.has(unit.chapterNumber)) {
        localSourceStatus = "unavailable";
        currentlyUnavailableUnitCount += 1;
      }
    }

    const pendingReviewCount = pendingDraftsByUnit.get(unit.id) ?? 0;
    const productionCount = productionEntriesByUnit.get(unit.id) ?? 0;
    const approvedClaimCount = approvedClaimsByUnit.get(unit.id)?.size ?? 0;
    pendingReviewSummaryCount += pendingReviewCount;
    productionKnowledgeEntryCount += productionCount;
    approvedClaimReferenceCount += approvedClaimCount;
    const productionPresent = productionCount > 0 || approvedClaimCount > 0;
    const editorialStatus: HoidChapterKnowledgeReadinessUnit["editorialStatus"] =
      pendingReviewCount > 0 && productionPresent
        ? "pending-and-production"
        : pendingReviewCount > 0
          ? "pending-review"
          : productionPresent
            ? "production-present"
            : "not-staged";

    return Object.freeze({
      unitId: unit.id,
      ordinal: unit.ordinal,
      chapterNumber: unit.chapterNumber,
      navigationStatus,
      bodyDigestStatus,
      localSourceStatus,
      pendingReviewSummaryCount: pendingReviewCount,
      productionKnowledgeEntryCount: productionCount,
      approvedClaimReferenceCount: approvedClaimCount,
      editorialStatus,
    });
  });

  const report: HoidChapterKnowledgeReadinessReport = Object.freeze({
    schemaVersion: 1,
    scope: "metadata-only",
    integrity: invalidEditorialRecordCount === 0 ? "consistent" : "inconsistent",
    workId: workIdInput,
    title: source.title,
    editionId: manifest.editionId,
    manifestId: manifest.manifestId,
    auditStatus: audit.status,
    auditScope: audit.status === "completed" ? "registered-digest-chapters-only" : null,
    counts: Object.freeze({
      totalReadingUnits: units.length,
      navigationVerifiedUnitCount,
      identityOnlyUnitCount,
      bodyDigestRegisteredUnitCount,
      currentlyAvailableUnitCount,
      currentlyUnavailableUnitCount,
      pendingReviewSummaryCount,
      productionKnowledgeEntryCount,
      approvedClaimReferenceCount,
      invalidEditorialRecordCount,
    }),
    units: Object.freeze(units),
    sourceTextIncluded: false,
    providerEgress: "none",
    authorizationEffect: "none",
    progressEffect: "none",
    spoilerUnlockEffect: "none",
  });

  return Object.freeze({ status: "ready", report });
}
