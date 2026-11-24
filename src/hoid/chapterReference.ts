import {
  resolveHoidChapterIdentity,
  type HoidChapterIdentity,
} from "./chapterIdentity";
import { getHoidReadingManifest } from "./readingManifest";
import { sha256Hex } from "./sha256";

/**
 * A chapter reference is an edition-bound structural pointer only.
 *
 * It deliberately omits EPUB locators and navigation hashes. Its fingerprint
 * commits to those private identity fields so the reference can be revalidated
 * against the current manifest without exposing them to UI or conversation
 * state. It is not a reading cursor and never grants evidence access.
 */
export type HoidChapterReference = Readonly<{
  schemaVersion: 1;
  kind: "chapter-reference";
  authority: "identity-only";
  bookId: string;
  chapterNumber: number;
  ordinal: number;
  unitId: string;
  labelAmbiguous: boolean;
  identityFingerprint: string;
}>;

export type HoidChapterReferenceCreation =
  | Readonly<{ status: "ready"; reference: HoidChapterReference }>
  | Readonly<{
      status: "ambiguous";
      chapterNumber: number;
      candidateCount: number | null;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-selection"
        | "unknown-work"
        | "segmentation-unverified"
        | "chapter-not-found"
        | "identity-mismatch"
        | "locator-unverified";
    }>;

export type HoidChapterReferenceValidation =
  | Readonly<{ status: "valid"; reference: HoidChapterReference }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-reference"
        | "unknown-work"
        | "segmentation-unverified"
        | "identity-mismatch"
        | "stale-reference";
    }>;

const REFERENCE_KEYS = new Set([
  "schemaVersion",
  "kind",
  "authority",
  "bookId",
  "chapterNumber",
  "ordinal",
  "unitId",
  "labelAmbiguous",
  "identityFingerprint",
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_ID_LENGTH = 256;

function exactReferenceRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== REFERENCE_KEYS.size) return null;

    const record = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !REFERENCE_KEYS.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (
        !descriptor ||
        !Object.prototype.hasOwnProperty.call(descriptor, "value") ||
        descriptor.enumerable !== true
      ) return null;
      record[key] = descriptor.value;
    }
    for (const key of REFERENCE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) return null;
    }
    return record;
  } catch {
    return null;
  }
}

function fingerprintIdentity(identity: HoidChapterIdentity): string {
  return sha256Hex(JSON.stringify({
    protocol: "hoid.chapter-reference.v1",
    schemaVersion: identity.schemaVersion,
    manifestId: identity.manifestId,
    editionId: identity.editionId,
    navigationSha256: identity.navigationSha256,
    bookId: identity.bookId,
    unitId: identity.unitId,
    ordinal: identity.ordinal,
    chapterNumber: identity.chapterNumber,
    locatorId: identity.locatorId,
  }));
}

function referenceFromIdentity(
  identity: HoidChapterIdentity,
  labelAmbiguous: boolean,
): HoidChapterReference {
  return Object.freeze({
    schemaVersion: 1,
    kind: "chapter-reference",
    authority: "identity-only",
    bookId: identity.bookId,
    chapterNumber: identity.chapterNumber,
    ordinal: identity.ordinal,
    unitId: identity.unitId,
    labelAmbiguous,
    identityFingerprint: fingerprintIdentity(identity),
  });
}

function mapResolutionFailure(
  reason: string,
): Extract<HoidChapterReferenceCreation, { status: "unavailable" }>["reason"] {
  if (reason === "unknown-work") return "unknown-work";
  if (reason === "segmentation-unverified" || reason === "invalid-manifest") {
    return "segmentation-unverified";
  }
  if (
    reason === "invalid-selection" ||
    reason === "chapter-not-found" ||
    reason === "identity-mismatch" ||
    reason === "locator-unverified"
  ) return reason;
  return "segmentation-unverified";
}

/**
 * Resolve a bibliographic chapter label into a safe, non-authorizing reference.
 *
 * Duplicate labels require an exact unitId or edition-bound locatorId. The
 * private locator is reduced to a fingerprint before the reference leaves this
 * module. No reading progress is read or changed by this operation.
 */
export function createHoidChapterReference(
  bookId: unknown,
  selection: unknown,
): HoidChapterReferenceCreation {
  const resolved = resolveHoidChapterIdentity(bookId, selection);
  if (resolved.status === "ambiguous") {
    return Object.freeze({
      status: "ambiguous",
      chapterNumber: resolved.chapterNumber,
      candidateCount: resolved.candidateCount,
    });
  }
  if (resolved.status !== "resolved") {
    return Object.freeze({
      status: "unavailable",
      reason: mapResolutionFailure(resolved.reason),
    });
  }

  const manifest = getHoidReadingManifest(resolved.identity.bookId);
  if (manifest.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: "segmentation-unverified" });
  }

  return Object.freeze({
    status: "ready",
    reference: referenceFromIdentity(
      resolved.identity,
      manifest.manifest.ambiguousChapterNumbers.includes(resolved.identity.chapterNumber),
    ),
  });
}

/**
 * Revalidate a reference against the current edition manifest.
 *
 * This confirms only structural identity. Callers must independently validate
 * the live reading boundary and evidence unlock policy before using any
 * narrative content associated with the referenced chapter.
 */
export function validateHoidChapterReference(
  value: unknown,
): HoidChapterReferenceValidation {
  const record = exactReferenceRecord(value);
  if (
    !record ||
    record.schemaVersion !== 1 ||
    record.kind !== "chapter-reference" ||
    record.authority !== "identity-only" ||
    typeof record.bookId !== "string" ||
    record.bookId.length < 1 ||
    record.bookId.length > MAX_ID_LENGTH ||
    record.bookId !== record.bookId.trim() ||
    typeof record.chapterNumber !== "number" ||
    !Number.isSafeInteger(record.chapterNumber) ||
    record.chapterNumber < 1 ||
    typeof record.ordinal !== "number" ||
    !Number.isSafeInteger(record.ordinal) ||
    record.ordinal < 1 ||
    typeof record.unitId !== "string" ||
    record.unitId.length < 1 ||
    record.unitId.length > MAX_ID_LENGTH ||
    record.unitId !== record.unitId.trim() ||
    typeof record.labelAmbiguous !== "boolean" ||
    typeof record.identityFingerprint !== "string" ||
    !SHA256_PATTERN.test(record.identityFingerprint)
  ) {
    return Object.freeze({ status: "invalid", reason: "invalid-reference" });
  }

  const resolved = resolveHoidChapterIdentity(record.bookId, {
    chapterNumber: record.chapterNumber,
    unitId: record.unitId,
  });
  if (resolved.status !== "resolved") {
    const reason = resolved.status === "unavailable" && resolved.reason === "unknown-work"
      ? "unknown-work"
      : resolved.status === "unavailable" && resolved.reason === "segmentation-unverified"
        ? "segmentation-unverified"
        : "identity-mismatch";
    return Object.freeze({ status: "invalid", reason });
  }

  const manifest = getHoidReadingManifest(record.bookId);
  if (manifest.status !== "ready") {
    return Object.freeze({ status: "invalid", reason: "segmentation-unverified" });
  }

  const expected = referenceFromIdentity(
    resolved.identity,
    manifest.manifest.ambiguousChapterNumbers.includes(resolved.identity.chapterNumber),
  );
  if (
    record.ordinal !== expected.ordinal ||
    record.labelAmbiguous !== expected.labelAmbiguous ||
    record.identityFingerprint !== expected.identityFingerprint
  ) {
    return Object.freeze({ status: "invalid", reason: "stale-reference" });
  }

  return Object.freeze({ status: "valid", reference: expected });
}
