import {
  getHoidReadingManifest,
  type HoidReadingManifest,
} from "./readingManifest";

export type HoidChapterIdentity = Readonly<{
  schemaVersion: 1;
  manifestId: string;
  editionId: string;
  navigationSha256: string;
  bookId: string;
  unitId: string;
  ordinal: number;
  chapterNumber: number;
  locatorId: string;
}>;

export type HoidChapterIdentitySelection = Readonly<{
  chapterNumber: number;
  unitId?: string;
  locatorId?: string;
}>;

export type HoidChapterIdentityResolution =
  | Readonly<{ status: "resolved"; identity: HoidChapterIdentity }>
  | Readonly<{ status: "ambiguous"; chapterNumber: number; candidateCount: number | null }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-manifest"
        | "invalid-selection"
        | "unknown-work"
        | "segmentation-unverified"
        | "chapter-not-found"
        | "identity-mismatch"
        | "locator-unverified";
    }>;

export type HoidChapterIdentityValidation =
  | Readonly<{ status: "valid"; identity: HoidChapterIdentity }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-identity"
        | "invalid-manifest"
        | "ambiguous-chapter"
        | "chapter-not-found"
        | "identity-mismatch"
        | "locator-unverified"
        | "stale-identity";
    }>;

type CanonicalUnit = Readonly<{
  id: string;
  ordinal: number;
  chapterNumber: number;
  locatorId?: string;
}>;

type CanonicalManifest = Readonly<{
  manifestId: string;
  editionId: string;
  navigationSha256: string;
  bookId: string;
  units: readonly CanonicalUnit[];
  ambiguousChapterNumbers: readonly number[];
}>;

const ID_PATTERN = /^[a-z0-9]+(?::[a-z0-9]+)*(?:[.-][a-z0-9]+)*$/u;
const BOOK_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;
const SHA_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_UNITS = 10_000;
const MAX_CHAPTER = 100_000_000;
const MAX_LOCATOR_LENGTH = 256;
const MANIFEST_KEYS = [
  "manifestId",
  "editionId",
  "navigationSha256",
  "bookId",
  "unitScope",
  "coverage",
  "units",
  "ambiguousChapterNumbers",
] as const;
const IDENTITY_KEYS = [
  "schemaVersion",
  "manifestId",
  "editionId",
  "navigationSha256",
  "bookId",
  "unitId",
  "ordinal",
  "chapterNumber",
  "locatorId",
] as const;

function exactRecord(
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const allowed = new Set([...requiredKeys, ...optionalKeys]);
    const keys = Reflect.ownKeys(value);
    if (keys.length < requiredKeys.length || keys.length > allowed.size) return null;

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
    for (const key of requiredKeys) {
      if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    }
    return result;
  } catch {
    return null;
  }
}

function denseArray(value: unknown, minimum: number, maximum: number): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      value.length < minimum ||
      value.length > maximum ||
      Object.getPrototypeOf(value) !== Array.prototype
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
    for (const key of keys) {
      if (key === "length") continue;
      if (
        typeof key !== "string" ||
        !/^(0|[1-9][0-9]*)$/u.test(key) ||
        Number(key) >= value.length
      ) return null;
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function positiveInteger(value: unknown, maximum: number): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= maximum;
}

function canonicalManifest(value: unknown): CanonicalManifest | null {
  const raw = exactRecord(value, MANIFEST_KEYS);
  if (
    !raw ||
    typeof raw.manifestId !== "string" ||
    raw.manifestId.length < 1 ||
    raw.manifestId.length > 512 ||
    typeof raw.editionId !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(raw.editionId) ||
    typeof raw.navigationSha256 !== "string" ||
    !SHA_PATTERN.test(raw.navigationSha256) ||
    typeof raw.bookId !== "string" ||
    !BOOK_PATTERN.test(raw.bookId) ||
    raw.unitScope !== "numbered-chapters-only" ||
    (raw.coverage !== "verified-numeric-chapters" &&
      raw.coverage !== "partial-before-ambiguous-chapter")
  ) return null;

  const units = denseArray(raw.units, 1, MAX_UNITS);
  const ambiguousNumbers = denseArray(raw.ambiguousChapterNumbers, 0, MAX_UNITS);
  if (!units || !ambiguousNumbers) return null;

  const canonicalUnits: CanonicalUnit[] = [];
  const unitIds = new Set<string>();
  const ordinals = new Set<number>();
  const locators = new Set<string>();
  let previousOrdinal = 0;

  for (const entry of units) {
    const unit = exactRecord(entry, ["id", "kind", "ordinal", "chapterNumber"], ["locatorId"]);
    if (
      !unit ||
      typeof unit.id !== "string" ||
      unit.id.length > 128 ||
      !ID_PATTERN.test(unit.id) ||
      unit.kind !== "chapter" ||
      !positiveInteger(unit.ordinal, MAX_UNITS) ||
      unit.ordinal <= previousOrdinal ||
      !positiveInteger(unit.chapterNumber, MAX_CHAPTER) ||
      unitIds.has(unit.id) ||
      ordinals.has(unit.ordinal)
    ) return null;

    let locatorId: string | undefined;
    if (Object.prototype.hasOwnProperty.call(unit, "locatorId")) {
      if (
        typeof unit.locatorId !== "string" ||
        unit.locatorId.length < 1 ||
        unit.locatorId.length > MAX_LOCATOR_LENGTH ||
        unit.locatorId !== unit.locatorId.trim() ||
        /[\u0000-\u001F\u007F]/u.test(unit.locatorId) ||
        locators.has(unit.locatorId)
      ) return null;
      locatorId = unit.locatorId;
      locators.add(locatorId);
    }

    unitIds.add(unit.id);
    ordinals.add(unit.ordinal);
    previousOrdinal = unit.ordinal;
    canonicalUnits.push(Object.freeze({
      id: unit.id,
      ordinal: unit.ordinal,
      chapterNumber: unit.chapterNumber,
      ...(locatorId === undefined ? {} : { locatorId }),
    }));
  }

  let previousAmbiguous = 0;
  for (const number of ambiguousNumbers) {
    if (!positiveInteger(number, MAX_CHAPTER) || number <= previousAmbiguous) return null;
    previousAmbiguous = number;
  }

  const duplicateNumbers = new Set<number>();
  const chapterCounts = new Map<number, number>();
  for (const unit of canonicalUnits) {
    const count = (chapterCounts.get(unit.chapterNumber) ?? 0) + 1;
    chapterCounts.set(unit.chapterNumber, count);
    if (count > 1) duplicateNumbers.add(unit.chapterNumber);
  }
  const ambiguousSet = new Set(ambiguousNumbers as readonly number[]);
  if ([...duplicateNumbers].some(number => !ambiguousSet.has(number))) return null;

  return Object.freeze({
    manifestId: raw.manifestId,
    editionId: raw.editionId,
    navigationSha256: raw.navigationSha256,
    bookId: raw.bookId,
    units: Object.freeze(canonicalUnits),
    ambiguousChapterNumbers: Object.freeze([...(ambiguousNumbers as readonly number[])]),
  });
}

function canonicalSelection(value: unknown): HoidChapterIdentitySelection | null {
  const raw = exactRecord(value, ["chapterNumber"], ["unitId", "locatorId"]);
  if (!raw || !positiveInteger(raw.chapterNumber, MAX_CHAPTER)) return null;

  let unitId: string | undefined;
  if (Object.prototype.hasOwnProperty.call(raw, "unitId")) {
    if (
      typeof raw.unitId !== "string" ||
      raw.unitId.length > 128 ||
      !ID_PATTERN.test(raw.unitId)
    ) return null;
    unitId = raw.unitId;
  }

  let locatorId: string | undefined;
  if (Object.prototype.hasOwnProperty.call(raw, "locatorId")) {
    if (
      typeof raw.locatorId !== "string" ||
      raw.locatorId.length < 1 ||
      raw.locatorId.length > MAX_LOCATOR_LENGTH ||
      raw.locatorId !== raw.locatorId.trim() ||
      /[\u0000-\u001F\u007F]/u.test(raw.locatorId)
    ) return null;
    locatorId = raw.locatorId;
  }

  return Object.freeze({
    chapterNumber: raw.chapterNumber,
    ...(unitId === undefined ? {} : { unitId }),
    ...(locatorId === undefined ? {} : { locatorId }),
  });
}

function identityFor(
  manifest: CanonicalManifest,
  unit: CanonicalUnit,
): HoidChapterIdentity | null {
  if (!unit.locatorId) return null;
  return Object.freeze({
    schemaVersion: 1,
    manifestId: manifest.manifestId,
    editionId: manifest.editionId,
    navigationSha256: manifest.navigationSha256,
    bookId: manifest.bookId,
    unitId: unit.id,
    ordinal: unit.ordinal,
    chapterNumber: unit.chapterNumber,
    locatorId: unit.locatorId,
  });
}

/**
 * Resolve a chapter against one exact edition manifest.
 *
 * Chapter numbers are display labels, not unique identities. If the same
 * number occurs more than once, callers must supply the exact unitId or
 * edition-bound locatorId. The resolver never selects the first match.
 */
export function resolveHoidChapterIdentityInManifest(
  manifestInput: unknown,
  selectionInput: unknown,
): HoidChapterIdentityResolution {
  const manifest = canonicalManifest(manifestInput);
  if (!manifest) {
    return Object.freeze({ status: "unavailable", reason: "invalid-manifest" });
  }

  const selection = canonicalSelection(selectionInput);
  if (!selection) {
    return Object.freeze({ status: "unavailable", reason: "invalid-selection" });
  }

  let candidates = manifest.units.filter(unit => unit.chapterNumber === selection.chapterNumber);
  const hasDisambiguator =
    selection.unitId !== undefined || selection.locatorId !== undefined;
  const isDeclaredAmbiguous =
    manifest.ambiguousChapterNumbers.includes(selection.chapterNumber);

  if (!hasDisambiguator && isDeclaredAmbiguous) {
    return Object.freeze({
      status: "ambiguous",
      chapterNumber: selection.chapterNumber,
      candidateCount: candidates.length > 1 ? candidates.length : null,
    });
  }

  if (selection.unitId !== undefined) {
    candidates = candidates.filter(unit => unit.id === selection.unitId);
  }
  if (selection.locatorId !== undefined) {
    candidates = candidates.filter(unit => unit.locatorId === selection.locatorId);
  }

  if (candidates.length === 0) {
    return Object.freeze({
      status: "unavailable",
      reason: hasDisambiguator ? "identity-mismatch" : "chapter-not-found",
    });
  }

  if (candidates.length > 1) {
    return Object.freeze({
      status: "ambiguous",
      chapterNumber: selection.chapterNumber,
      candidateCount: candidates.length,
    });
  }

  const identity = identityFor(manifest, candidates[0]);
  if (!identity) {
    return Object.freeze({ status: "unavailable", reason: "locator-unverified" });
  }
  return Object.freeze({ status: "resolved", identity });
}

/** Resolve against the currently registered edition for a bibliographic work. */
export function resolveHoidChapterIdentity(
  bookId: unknown,
  selection: unknown,
): HoidChapterIdentityResolution {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") {
    return Object.freeze({ status: "unavailable", reason: result.reason });
  }
  return resolveHoidChapterIdentityInManifest(result.manifest, selection);
}

/** Revalidate a chapter identity against the exact current manifest. */
export function validateHoidChapterIdentityInManifest(
  manifestInput: unknown,
  identityInput: unknown,
): HoidChapterIdentityValidation {
  const raw = exactRecord(identityInput, [...IDENTITY_KEYS]);
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    typeof raw.manifestId !== "string" ||
    typeof raw.editionId !== "string" ||
    typeof raw.navigationSha256 !== "string" ||
    typeof raw.bookId !== "string" ||
    typeof raw.unitId !== "string" ||
    !positiveInteger(raw.ordinal, MAX_UNITS) ||
    !positiveInteger(raw.chapterNumber, MAX_CHAPTER) ||
    typeof raw.locatorId !== "string"
  ) return Object.freeze({ status: "invalid", reason: "invalid-identity" });

  const resolved = resolveHoidChapterIdentityInManifest(manifestInput, {
    chapterNumber: raw.chapterNumber,
    unitId: raw.unitId,
    locatorId: raw.locatorId,
  });
  if (resolved.status !== "resolved") {
    const reason = resolved.status === "ambiguous"
      ? "ambiguous-chapter"
      : resolved.reason === "invalid-manifest"
        ? "invalid-manifest"
        : resolved.reason === "chapter-not-found"
          ? "chapter-not-found"
          : resolved.reason === "locator-unverified"
            ? "locator-unverified"
            : "identity-mismatch";
    return Object.freeze({ status: "invalid", reason });
  }

  const expected = resolved.identity;
  if (
    raw.manifestId !== expected.manifestId ||
    raw.editionId !== expected.editionId ||
    raw.navigationSha256 !== expected.navigationSha256 ||
    raw.bookId !== expected.bookId ||
    raw.unitId !== expected.unitId ||
    raw.ordinal !== expected.ordinal ||
    raw.chapterNumber !== expected.chapterNumber ||
    raw.locatorId !== expected.locatorId
  ) return Object.freeze({ status: "invalid", reason: "stale-identity" });

  return Object.freeze({ status: "valid", identity: expected });
}

/** Revalidate an identity against the current edition registered for its work. */
export function validateHoidChapterIdentity(
  identityInput: unknown,
): HoidChapterIdentityValidation {
  const raw = exactRecord(identityInput, [...IDENTITY_KEYS]);
  if (!raw || typeof raw.bookId !== "string") {
    return Object.freeze({ status: "invalid", reason: "invalid-identity" });
  }

  const result = getHoidReadingManifest(raw.bookId);
  if (result.status !== "ready") {
    return Object.freeze({ status: "invalid", reason: "invalid-manifest" });
  }
  return validateHoidChapterIdentityInManifest(result.manifest, identityInput);
}

/** A type-only assertion helper for callers that already hold a manifest. */
export function isHoidChapterIdentityForManifest(
  manifest: HoidReadingManifest,
  identity: unknown,
): boolean {
  return validateHoidChapterIdentityInManifest(manifest, identity).status === "valid";
}
