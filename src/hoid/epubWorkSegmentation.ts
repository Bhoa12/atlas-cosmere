import { HOID_SOURCE_CATALOG_MANIFEST } from "./sourceCatalogManifest";
import { HOID_EDITION_STRUCTURES } from "./editionStructure";
import type { HoidEpubStructureProbe, HoidEpubProbeEntry } from "./epubSourceProbe";
import { sha256Hex } from "./sha256";

export type HoidEpubWorkSegment = Readonly<{
  workId: string;
  tocOrdinalStart: number;
  tocOrdinalEnd: number;
  spineOrdinalStart: number;
  spineOrdinalEnd: number;
  tocEntryCount: number;
  numberedEntryCount: number;
}>;

export type HoidEpubWorkSegmentationManifest = Readonly<{
  schemaVersion: 1;
  kind: "hoid-epub-work-segmentation";
  verificationLevel: "metadata-only";
  editionId: string;
  sourceGroup: "cosmere.epub" | "roshar-epubs";
  catalogFingerprint: string;
  packageSha256: string;
  navigationSha256: string;
  candidateFingerprint: string;
  packageVersion: "2.0" | "3.0";
  navigationFormat: "epub2-ncx" | "epub3-nav";
  manifestItemCount: number;
  spineItemCount: number;
  navigationEntryCount: number;
  numberedTocEntryCount: number;
  unnumberedTocEntryCount: number;
  segments: readonly HoidEpubWorkSegment[];
  unassignedTocOrdinals: readonly number[];
  mappingFingerprint: string;
  sourceContentIncluded: false;
  chapterBodiesInspected: false;
  progressUnlockGranted: false;
  promotionAllowed: false;
  productionWritePerformed: false;
}>;

export type HoidSegmentedNavigationEntry = Readonly<{
  tocOrdinal: number;
  workId: string;
  locatorId: string;
  kind: "numbered-chapter" | "section";
  chapterNumber: number | null;
  spineOrdinal: number;
}>;

export type HoidEpubWorkSegmentationValidation =
  | Readonly<{
      status: "verified-structure-only";
      editionId: string;
      mappingFingerprint: string;
      assignments: readonly HoidSegmentedNavigationEntry[];
      unassignedTocOrdinals: readonly number[];
      numberedChapterCount: number;
      sourceContentIncluded: false;
      chapterBodiesInspected: false;
      progressUnlockGranted: false;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "invalid-edition"
        | "unknown-edition"
        | "invalid-probe"
        | "source-fingerprint-mismatch"
        | "catalogue-mismatch"
        | "work-coverage-mismatch"
        | "segment-mismatch"
        | "chapter-number-mismatch"
        | "unassigned-numbered-entry"
        | "authority-flags-present";
      sourceContentIncluded: false;
      chapterBodiesInspected: false;
      progressUnlockGranted: false;
      promotionAllowed: false;
      productionWritePerformed: false;
    }>;

type RawManifest = Omit<HoidEpubWorkSegmentationManifest, "mappingFingerprint">;

const RAW_MANIFESTS: readonly RawManifest[] = Object.freeze([
  Object.freeze({
    schemaVersion: 1,
    kind: "hoid-epub-work-segmentation",
    verificationLevel: "metadata-only",
    editionId: "roshar-omnibus-v1",
    sourceGroup: "roshar-epubs",
    catalogFingerprint: HOID_SOURCE_CATALOG_MANIFEST.fingerprint,
    packageSha256: "6eae99f8feccc93a57685108f0f8a8d6af68b7f1858eee63efcf710839cb7477",
    navigationSha256: "08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025",
    candidateFingerprint: "8b178cd0ef3ad7f45d73e5035a80232d53abe5aca9b9e8e6e4a44e9bb233ecd3",
    packageVersion: "3.0",
    navigationFormat: "epub3-nav",
    manifestItemCount: 1687,
    spineItemCount: 849,
    navigationEntryCount: 702,
    numberedTocEntryCount: 552,
    unnumberedTocEntryCount: 150,
    segments: Object.freeze([
      Object.freeze({ workId: "twok", tocOrdinalStart: 2, tocOrdinalEnd: 99, spineOrdinalStart: 5, spineOrdinalEnd: 128, tocEntryCount: 98, numberedEntryCount: 75 }),
      Object.freeze({ workId: "wor", tocOrdinalStart: 100, tocOrdinalEnd: 216, spineOrdinalStart: 131, spineOrdinalEnd: 272, tocEntryCount: 117, numberedEntryCount: 89 }),
      Object.freeze({ workId: "ob", tocOrdinalStart: 217, tocOrdinalEnd: 367, spineOrdinalStart: 275, spineOrdinalEnd: 453, tocEntryCount: 151, numberedEntryCount: 122 }),
      Object.freeze({ workId: "row", tocOrdinalStart: 368, tocOrdinalEnd: 511, spineOrdinalStart: 456, spineOrdinalEnd: 626, tocEntryCount: 144, numberedEntryCount: 117 }),
      Object.freeze({ workId: "sawt", tocOrdinalStart: 512, tocOrdinalEnd: 701, spineOrdinalStart: 629, spineOrdinalEnd: 845, tocEntryCount: 190, numberedEntryCount: 149 }),
    ]),
    unassignedTocOrdinals: Object.freeze([1, 702]),
    sourceContentIncluded: false,
    chapterBodiesInspected: false,
    progressUnlockGranted: false,
    promotionAllowed: false,
    productionWritePerformed: false,
  }),
  Object.freeze({
    schemaVersion: 1,
    kind: "hoid-epub-work-segmentation",
    verificationLevel: "metadata-only",
    editionId: "edgedancer-epub-v1",
    sourceGroup: "roshar-epubs",
    catalogFingerprint: HOID_SOURCE_CATALOG_MANIFEST.fingerprint,
    packageSha256: "27452125a1850a21260c5a48bd17fe6a836424b18be21f6816e0c0e5df3dcf21",
    navigationSha256: "5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517",
    candidateFingerprint: "45554e74551df0c37aa94c23c73db5b230a7f113bef0e8231b5a2de3ecd9f5e5",
    packageVersion: "2.0",
    navigationFormat: "epub2-ncx",
    manifestItemCount: 46,
    spineItemCount: 30,
    navigationEntryCount: 25,
    numberedTocEntryCount: 20,
    unnumberedTocEntryCount: 5,
    segments: Object.freeze([
      Object.freeze({ workId: "edgedancer", tocOrdinalStart: 1, tocOrdinalEnd: 25, spineOrdinalStart: 1, spineOrdinalEnd: 29, tocEntryCount: 25, numberedEntryCount: 20 }),
    ]),
    unassignedTocOrdinals: Object.freeze([]),
    sourceContentIncluded: false,
    chapterBodiesInspected: false,
    progressUnlockGranted: false,
    promotionAllowed: false,
    productionWritePerformed: false,
  }),
  Object.freeze({
    schemaVersion: 1,
    kind: "hoid-epub-work-segmentation",
    verificationLevel: "metadata-only",
    editionId: "dawnshard-epub-v1",
    sourceGroup: "roshar-epubs",
    catalogFingerprint: HOID_SOURCE_CATALOG_MANIFEST.fingerprint,
    packageSha256: "c2a4f08ac83dca9ef6f67347f4429d27c62b0c2424774279ddc028928b5c0732",
    navigationSha256: "8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075",
    candidateFingerprint: "87e0f057680ab2b3c15eedbf009edacc1af3d12a6c2b9b24cd6292d48320ec7a",
    packageVersion: "2.0",
    navigationFormat: "epub2-ncx",
    manifestItemCount: 47,
    spineItemCount: 31,
    navigationEntryCount: 24,
    numberedTocEntryCount: 19,
    unnumberedTocEntryCount: 5,
    segments: Object.freeze([
      Object.freeze({ workId: "dawnshard", tocOrdinalStart: 1, tocOrdinalEnd: 24, spineOrdinalStart: 1, spineOrdinalEnd: 31, tocEntryCount: 24, numberedEntryCount: 19 }),
    ]),
    unassignedTocOrdinals: Object.freeze([]),
    sourceContentIncluded: false,
    chapterBodiesInspected: false,
    progressUnlockGranted: false,
    promotionAllowed: false,
    productionWritePerformed: false,
  }),
]);

function mappingPayload(manifest: RawManifest): string {
  return JSON.stringify([
    "hoid-epub-work-segmentation-v1",
    manifest.editionId,
    manifest.sourceGroup,
    manifest.catalogFingerprint,
    manifest.packageSha256,
    manifest.navigationSha256,
    manifest.candidateFingerprint,
    manifest.packageVersion,
    manifest.navigationFormat,
    manifest.manifestItemCount,
    manifest.spineItemCount,
    manifest.navigationEntryCount,
    manifest.numberedTocEntryCount,
    manifest.unnumberedTocEntryCount,
    manifest.segments.map(segment => [
      segment.workId,
      segment.tocOrdinalStart,
      segment.tocOrdinalEnd,
      segment.spineOrdinalStart,
      segment.spineOrdinalEnd,
      segment.tocEntryCount,
      segment.numberedEntryCount,
    ]),
    manifest.unassignedTocOrdinals,
  ]);
}

export const HOID_EPUB_WORK_SEGMENTATION_MANIFESTS: readonly HoidEpubWorkSegmentationManifest[] = Object.freeze(
  RAW_MANIFESTS.map(manifest => Object.freeze({
    ...manifest,
    mappingFingerprint: sha256Hex(mappingPayload(manifest)),
  })),
);

const PROBE_KEYS = new Set([
  "schemaVersion", "kind", "scope", "workSegmentation", "packageVersion", "navigationFormat",
  "packageSha256", "navigationSha256", "candidateFingerprint", "manifestItemCount", "spineItemCount",
  "navigationEntryCount", "numberedTocEntryCount", "unnumberedTocEntryCount",
  "repeatedNumberedLabelsAcrossEdition", "entries", "sourceContentIncluded", "chapterBodiesInspected",
  "progressUnlockGranted", "promotionAllowed", "productionWritePerformed",
]);
const ENTRY_KEYS = new Set([
  "tocOrdinal", "numberedEntryOrdinal", "labelledChapterNumber", "kind", "spineOrdinal", "locatorId",
]);

function canonicalRecord(
  value: unknown,
  allowedKeys: ReadonlySet<string>,
): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.size) return null;
    const result = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== "string" || !allowedKeys.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      result[key] = descriptor.value;
    }
    for (const key of allowedKeys) if (!Object.prototype.hasOwnProperty.call(result, key)) return null;
    return result;
  } catch {
    return null;
  }
}

function canonicalDenseArray(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || value.length > maximum || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return null;
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.enumerable !== true) {
        return null;
      }
      result.push(descriptor.value);
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function canonicalProbe(value: unknown): HoidEpubStructureProbe | null {
  const raw = canonicalRecord(value, PROBE_KEYS);
  if (!raw) return null;
  const rawEntries = canonicalDenseArray(raw.entries, 5_000);
  const rawRepeated = canonicalDenseArray(raw.repeatedNumberedLabelsAcrossEdition, 5_000);
  if (!rawEntries || !rawRepeated) return null;

  const entries: HoidEpubProbeEntry[] = [];
  for (const item of rawEntries) {
    const entry = canonicalRecord(item, ENTRY_KEYS);
    if (
      !entry ||
      !positiveInteger(entry.tocOrdinal) ||
      !(entry.numberedEntryOrdinal === null || positiveInteger(entry.numberedEntryOrdinal)) ||
      !(entry.labelledChapterNumber === null || positiveInteger(entry.labelledChapterNumber)) ||
      (entry.kind !== "numbered-chapter" && entry.kind !== "section") ||
      !positiveInteger(entry.spineOrdinal) ||
      typeof entry.locatorId !== "string" ||
      !/^nav:[a-f0-9]{32}$/.test(entry.locatorId)
    ) return null;
    entries.push(Object.freeze({
      tocOrdinal: entry.tocOrdinal,
      numberedEntryOrdinal: entry.numberedEntryOrdinal,
      labelledChapterNumber: entry.labelledChapterNumber,
      kind: entry.kind,
      spineOrdinal: entry.spineOrdinal,
      locatorId: entry.locatorId,
    }));
  }

  const repeated: number[] = [];
  for (const value of rawRepeated) {
    if (!positiveInteger(value)) return null;
    repeated.push(value);
  }
  if (new Set(repeated).size !== repeated.length || repeated.some((value, index) => index > 0 && repeated[index - 1] >= value)) {
    return null;
  }

  if (
    raw.schemaVersion !== 1 ||
    raw.kind !== "hoid-epub-structure-candidate" ||
    raw.scope !== "metadata-only" ||
    raw.workSegmentation !== "not-inferred" ||
    (raw.packageVersion !== "2.0" && raw.packageVersion !== "3.0") ||
    (raw.navigationFormat !== "epub2-ncx" && raw.navigationFormat !== "epub3-nav") ||
    typeof raw.packageSha256 !== "string" || !/^[a-f0-9]{64}$/.test(raw.packageSha256) ||
    typeof raw.navigationSha256 !== "string" || !/^[a-f0-9]{64}$/.test(raw.navigationSha256) ||
    typeof raw.candidateFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(raw.candidateFingerprint) ||
    !positiveInteger(raw.manifestItemCount) ||
    !positiveInteger(raw.spineItemCount) ||
    !positiveInteger(raw.navigationEntryCount) ||
    !nonNegativeInteger(raw.numberedTocEntryCount) ||
    !nonNegativeInteger(raw.unnumberedTocEntryCount) ||
    raw.sourceContentIncluded !== false ||
    raw.chapterBodiesInspected !== false ||
    raw.progressUnlockGranted !== false ||
    raw.promotionAllowed !== false ||
    raw.productionWritePerformed !== false ||
    entries.length !== raw.navigationEntryCount ||
    entries.length !== raw.numberedTocEntryCount + raw.unnumberedTocEntryCount
  ) return null;

  return Object.freeze({
    schemaVersion: 1,
    kind: "hoid-epub-structure-candidate",
    scope: "metadata-only",
    workSegmentation: "not-inferred",
    packageVersion: raw.packageVersion,
    navigationFormat: raw.navigationFormat,
    packageSha256: raw.packageSha256,
    navigationSha256: raw.navigationSha256,
    candidateFingerprint: raw.candidateFingerprint,
    manifestItemCount: raw.manifestItemCount,
    spineItemCount: raw.spineItemCount,
    navigationEntryCount: raw.navigationEntryCount,
    numberedTocEntryCount: raw.numberedTocEntryCount,
    unnumberedTocEntryCount: raw.unnumberedTocEntryCount,
    repeatedNumberedLabelsAcrossEdition: Object.freeze(repeated),
    entries: Object.freeze(entries),
    sourceContentIncluded: false,
    chapterBodiesInspected: false,
    progressUnlockGranted: false,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

function invalid(
  reason: Extract<HoidEpubWorkSegmentationValidation, { status: "unavailable" }>["reason"],
): HoidEpubWorkSegmentationValidation {
  return Object.freeze({
    status: "unavailable",
    reason,
    sourceContentIncluded: false,
    chapterBodiesInspected: false,
    progressUnlockGranted: false,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

function sameValues<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function chapterNumbersMatch(
  values: readonly number[],
  work: Readonly<{
    mode: string;
    chapterCount?: number;
    duplicateChapterNumbers?: readonly number[];
  }>,
): boolean {
  if (work.mode !== "numeric-chapters" && work.mode !== "chapter-number-with-duplicate-locators") return false;
  const chapterCount = work.chapterCount;
  if (!positiveInteger(chapterCount)) return false;
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  if (counts.size !== chapterCount) return false;
  const expectedDuplicates = work.mode === "chapter-number-with-duplicate-locators"
    ? [...(work.duplicateChapterNumbers ?? [])].sort((a, b) => a - b)
    : [];
  const actualDuplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([number]) => number)
    .sort((a, b) => a - b);
  if (!sameNumbers(actualDuplicates, expectedDuplicates)) return false;
  for (let number = 1; number <= chapterCount; number += 1) {
    const expectedCount = expectedDuplicates.includes(number) ? 2 : 1;
    if (counts.get(number) !== expectedCount) return false;
  }
  return true;
}

/** Return the immutable structural segmentation for a known inspected edition. */
export function getHoidEpubWorkSegmentationManifest(
  editionId: unknown,
): HoidEpubWorkSegmentationManifest | null {
  if (typeof editionId !== "string" || !editionId.trim()) return null;
  return HOID_EPUB_WORK_SEGMENTATION_MANIFESTS.find(manifest => manifest.editionId === editionId) ?? null;
}

/**
 * Bind a metadata-only EPUB probe to an explicit, edition-specific work map.
 * This produces work/chapter identities only; it never creates a reading cursor,
 * unlocks progress, inspects chapter bodies or authorizes editorial promotion.
 */
export function validateHoidEpubWorkSegmentation(
  probeInput: unknown,
  editionIdInput: unknown,
): HoidEpubWorkSegmentationValidation {
  if (typeof editionIdInput !== "string" || !editionIdInput.trim()) return invalid("invalid-edition");
  const manifest = getHoidEpubWorkSegmentationManifest(editionIdInput);
  if (!manifest) return invalid("unknown-edition");
  const probe = canonicalProbe(probeInput);
  if (!probe) return invalid("invalid-probe");

  if (
    manifest.catalogFingerprint !== HOID_SOURCE_CATALOG_MANIFEST.fingerprint
  ) return invalid("catalogue-mismatch");

  const edition = HOID_EDITION_STRUCTURES.find(source => source.editionId === manifest.editionId);
  if (!edition || edition.sourceGroup !== manifest.sourceGroup) return invalid("work-coverage-mismatch");
  const expectedWorkIds = edition.works.flatMap(work => [...work.workIds]).sort();
  const actualWorkIds = manifest.segments.map(segment => segment.workId).sort();
  if (
    expectedWorkIds.length !== actualWorkIds.length ||
    expectedWorkIds.some((workId, index) => workId !== actualWorkIds[index]) ||
    new Set(actualWorkIds).size !== actualWorkIds.length
  ) return invalid("work-coverage-mismatch");

  const recomputedCandidateFingerprint = sha256Hex(JSON.stringify({
    schemaVersion: 1,
    packageVersion: probe.packageVersion,
    navigationFormat: probe.navigationFormat,
    packageSha256: probe.packageSha256,
    navigationSha256: probe.navigationSha256,
    manifestItemCount: probe.manifestItemCount,
    spineItemCount: probe.spineItemCount,
    entries: probe.entries,
  }));
  if (recomputedCandidateFingerprint !== probe.candidateFingerprint) return invalid("invalid-probe");

  if (
    probe.packageVersion !== manifest.packageVersion ||
    probe.navigationFormat !== manifest.navigationFormat ||
    probe.packageSha256 !== manifest.packageSha256 ||
    probe.navigationSha256 !== manifest.navigationSha256 ||
    probe.candidateFingerprint !== manifest.candidateFingerprint ||
    probe.manifestItemCount !== manifest.manifestItemCount ||
    probe.spineItemCount !== manifest.spineItemCount ||
    probe.navigationEntryCount !== manifest.navigationEntryCount ||
    probe.numberedTocEntryCount !== manifest.numberedTocEntryCount ||
    probe.unnumberedTocEntryCount !== manifest.unnumberedTocEntryCount
  ) return invalid("source-fingerprint-mismatch");

  const locatorIds = new Set<string>();
  const numberedCounts = new Map<number, number>();
  let numberedOrdinal = 0;
  for (let index = 0; index < probe.entries.length; index += 1) {
    const entry = probe.entries[index];
    if (
      entry.tocOrdinal !== index + 1 ||
      entry.spineOrdinal > probe.spineItemCount ||
      locatorIds.has(entry.locatorId) ||
      (entry.kind === "section" && (entry.labelledChapterNumber !== null || entry.numberedEntryOrdinal !== null)) ||
      (entry.kind === "numbered-chapter" && (
        !positiveInteger(entry.labelledChapterNumber) ||
        entry.numberedEntryOrdinal !== numberedOrdinal + 1
      ))
    ) return invalid("invalid-probe");
    locatorIds.add(entry.locatorId);
    if (entry.kind === "numbered-chapter") {
      numberedOrdinal += 1;
      const chapterNumber = entry.labelledChapterNumber as number;
      numberedCounts.set(chapterNumber, (numberedCounts.get(chapterNumber) ?? 0) + 1);
    }
  }
  if (numberedOrdinal !== manifest.numberedTocEntryCount) return invalid("invalid-probe");
  const repeatedNumbers = [...numberedCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([number]) => number)
    .sort((a, b) => a - b);
  if (!sameValues(repeatedNumbers, probe.repeatedNumberedLabelsAcrossEdition)) return invalid("invalid-probe");

  const assignedOrdinals = new Set<number>();
  const assignments: HoidSegmentedNavigationEntry[] = [];
  for (let segmentIndex = 0; segmentIndex < manifest.segments.length; segmentIndex += 1) {
    const segment = manifest.segments[segmentIndex];
    const previous = manifest.segments[segmentIndex - 1];
    if (
      !positiveInteger(segment.tocOrdinalStart) ||
      !positiveInteger(segment.tocOrdinalEnd) ||
      !positiveInteger(segment.spineOrdinalStart) ||
      !positiveInteger(segment.spineOrdinalEnd) ||
      segment.tocOrdinalStart > segment.tocOrdinalEnd ||
      segment.spineOrdinalStart > segment.spineOrdinalEnd ||
      segment.tocEntryCount !== segment.tocOrdinalEnd - segment.tocOrdinalStart + 1 ||
      segment.numberedEntryCount > segment.tocEntryCount ||
      (previous && (
        previous.tocOrdinalEnd >= segment.tocOrdinalStart ||
        previous.spineOrdinalEnd >= segment.spineOrdinalStart
      ))
    ) return invalid("segment-mismatch");

    const entries = probe.entries.filter(entry =>
      entry.tocOrdinal >= segment.tocOrdinalStart && entry.tocOrdinal <= segment.tocOrdinalEnd
    );
    if (
      entries.length !== segment.tocEntryCount ||
      entries.some(entry =>
        entry.spineOrdinal < segment.spineOrdinalStart || entry.spineOrdinal > segment.spineOrdinalEnd
      )
    ) return invalid("segment-mismatch");

    const numberedEntries = entries.filter(entry => entry.kind === "numbered-chapter");
    if (numberedEntries.length !== segment.numberedEntryCount) return invalid("segment-mismatch");
    const work = edition.works.find(candidate => candidate.workIds.includes(segment.workId));
    if (!work || !chapterNumbersMatch(
      numberedEntries.map(entry => entry.labelledChapterNumber as number),
      work,
    )) return invalid("chapter-number-mismatch");

    for (const entry of entries) {
      if (assignedOrdinals.has(entry.tocOrdinal)) return invalid("segment-mismatch");
      assignedOrdinals.add(entry.tocOrdinal);
      assignments.push(Object.freeze({
        tocOrdinal: entry.tocOrdinal,
        workId: segment.workId,
        locatorId: entry.locatorId,
        kind: entry.kind,
        chapterNumber: entry.labelledChapterNumber,
        spineOrdinal: entry.spineOrdinal,
      }));
    }
  }

  const unassigned = new Set(manifest.unassignedTocOrdinals);
  if (
    unassigned.size !== manifest.unassignedTocOrdinals.length ||
    manifest.unassignedTocOrdinals.some((ordinal, index) =>
      !positiveInteger(ordinal) ||
      ordinal > probe.navigationEntryCount ||
      (index > 0 && manifest.unassignedTocOrdinals[index - 1] >= ordinal) ||
      assignedOrdinals.has(ordinal)
    )
  ) return invalid("segment-mismatch");

  for (const entry of probe.entries) {
    if (assignedOrdinals.has(entry.tocOrdinal)) continue;
    if (!unassigned.has(entry.tocOrdinal)) return invalid("segment-mismatch");
    if (entry.kind !== "section") return invalid("unassigned-numbered-entry");
  }
  if (
    assignedOrdinals.size + unassigned.size !== probe.navigationEntryCount ||
    assignments.filter(entry => entry.kind === "numbered-chapter").length !== probe.numberedTocEntryCount
  ) return invalid("segment-mismatch");

  return Object.freeze({
    status: "verified-structure-only",
    editionId: manifest.editionId,
    mappingFingerprint: manifest.mappingFingerprint,
    assignments: Object.freeze(assignments.sort((left, right) => left.tocOrdinal - right.tocOrdinal)),
    unassignedTocOrdinals: Object.freeze([...manifest.unassignedTocOrdinals]),
    numberedChapterCount: probe.numberedTocEntryCount,
    sourceContentIncluded: false,
    chapterBodiesInspected: false,
    progressUnlockGranted: false,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
}

/** Resolve one TOC ordinal only after its probe has passed the exact work map. */
export function getHoidSegmentedNavigationEntry(
  validation: HoidEpubWorkSegmentationValidation,
  tocOrdinal: unknown,
): HoidSegmentedNavigationEntry | null {
  if (
    validation.status !== "verified-structure-only" ||
    !positiveInteger(tocOrdinal)
  ) return null;
  return validation.assignments.find(entry => entry.tocOrdinal === tocOrdinal) ?? null;
}
