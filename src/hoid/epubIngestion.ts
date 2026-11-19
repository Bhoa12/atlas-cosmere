import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { getHoidEditionProgressPolicy, HOID_EDITION_STRUCTURES } from "./editionStructure";

/**
 * Offline EPUB inspection core.
 *
 * This module is deliberately provider-neutral: ZIP access, XML parsing and
 * SHA-256 are injected ports. It returns metadata-only candidates and never
 * writes verified locators, inspected-document allowlists or production
 * knowledge. Human review remains mandatory before any candidate is promoted.
 */

export const HOID_EPUB_INGESTION_LIMITS = Object.freeze({
  maxArchiveEntries: 50_000,
  maxTotalUncompressedBytes: 512 * 1024 * 1024,
  maxEntryUncompressedBytes: 64 * 1024 * 1024,
  maxMetadataDocumentBytes: 2 * 1024 * 1024,
  maxNavigationDocumentBytes: 4 * 1024 * 1024,
  maxChapterDocumentBytes: 12 * 1024 * 1024,
  maxCompressionRatio: 200,
  maxNavigationNodes: 50_000,
  maxNavigationDepth: 24,
  maxManifestItems: 20_000,
  maxSpineItems: 20_000,
});

export type HoidEpubSourceGroup = "cosmere.epub" | "roshar-epubs";
export type HoidEpubCompressionMethod = "stored" | "deflated" | "unsupported";
export type HoidEpubEntryKind = "file" | "directory" | "symlink";
export type HoidEpubNavigationFormat = "epub3-nav" | "epub2-ncx";

export type HoidEpubSourceDescriptor = Readonly<{
  sourceId: string;
  workId: string;
  editionId: string;
  sourceGroup: HoidEpubSourceGroup;
}>;

export type HoidEpubArchiveEntry = Readonly<{
  path: string;
  /** Physical local-header order in the ZIP stream, not central-directory iteration order. */
  ordinal: number;
  /** null means this random-access adapter has not read the local header yet. */
  localHeaderExtraFieldLength: number | null;
  kind: HoidEpubEntryKind;
  compressionMethod: HoidEpubCompressionMethod;
  compressedSize: number;
  uncompressedSize: number;
  encrypted: boolean;
}>;

export interface HoidEpubArchivePort {
  listEntries(sourceId: string): Promise<readonly HoidEpubArchiveEntry[]>;
  readEntry(sourceId: string, canonicalPath: string, maximumBytes: number): Promise<Uint8Array | null>;
}

export type HoidEpubRootfile = Readonly<{
  fullPath: string;
  mediaType: string;
}>;

export type HoidEpubContainerDocument = Readonly<{
  rootfiles: readonly HoidEpubRootfile[];
}>;

export type HoidEpubIdentifier = Readonly<{
  id: string;
  value: string;
}>;

export type HoidEpubManifestItem = Readonly<{
  id: string;
  href: string;
  mediaType: string;
  properties: readonly string[];
}>;

export type HoidEpubSpineItem = Readonly<{
  idref: string;
  linear: boolean;
}>;

export type HoidEpubPackageDocument = Readonly<{
  version: string;
  uniqueIdentifierId: string;
  metadata: Readonly<{
    title: string;
    language: string;
    identifiers: readonly HoidEpubIdentifier[];
  }>;
  manifestItems: readonly HoidEpubManifestItem[];
  spine: readonly HoidEpubSpineItem[];
  spineTocId: string | null;
}>;

export type HoidEpubNavigationNode = Readonly<{
  label: string;
  href: string;
  children: readonly HoidEpubNavigationNode[];
}>;

export interface HoidEpubXmlPort {
  parseContainerXml(bytes: Uint8Array): Promise<HoidEpubContainerDocument>;
  parsePackageDocument(bytes: Uint8Array): Promise<HoidEpubPackageDocument>;
  parseNavigationDocument(
    bytes: Uint8Array,
    format: HoidEpubNavigationFormat,
  ): Promise<readonly HoidEpubNavigationNode[]>;
  validateXhtml(bytes: Uint8Array): Promise<boolean>;
}

export interface HoidEpubDigestPort {
  sha256(bytes: Uint8Array): Promise<string>;
  sha256Utf8(value: string): Promise<string>;
}

export type HoidEpubInspectionRejection =
  | "invalid-source-descriptor"
  | "archive-limit-exceeded"
  | "invalid-archive-entry"
  | "unsafe-archive-path"
  | "duplicate-archive-path"
  | "encrypted-entry"
  | "unsupported-compression"
  | "archive-size-limit"
  | "compression-ratio-limit"
  | "mimetype-invalid"
  | "required-entry-missing"
  | "container-invalid"
  | "multiple-rootfiles"
  | "package-invalid"
  | "manifest-invalid"
  | "spine-invalid"
  | "navigation-invalid"
  | "navigation-target-unresolved"
  | "source-read-failed"
  | "digest-invalid"
  | "edition-navigation-mismatch"
  | "report-not-issued-here"
  | "source-changed"
  | "chapter-not-in-navigation"
  | "chapter-not-xhtml"
  | "chapter-size-limit"
  | "xhtml-invalid"
  | "inspection-failed";

export type HoidEpubInspectionResult<T> =
  | Readonly<{ status: "candidate"; candidate: T }>
  | Readonly<{ status: "rejected"; reason: HoidEpubInspectionRejection }>;

export type HoidEpubPackageInspectionCandidate = Readonly<{
  status: "candidate-only";
  sourceId: string;
  workId: string;
  declaredEditionId: string;
  sourceGroup: HoidEpubSourceGroup;
  editionBinding: "catalogue-navigation-digest-match";
  packageVersion: string;
  title: string;
  language: string;
  uniqueIdentifier: string;
  archiveEntryCount: number;
  manifestItemCount: number;
  spineItemCount: number;
  navigationEntryCount: number;
  navigationXhtmlTargetCount: number;
  archiveInventorySha256: string;
  mimetypeSha256: string;
  containerDocumentSha256: string;
  packageDocumentSha256: string;
  navigationDocumentSha256: string;
  sourceFingerprint: string;
}>;

export type HoidEpubChapterInspectionCandidate = Readonly<{
  status: "candidate-only";
  workId: string;
  declaredEditionId: string;
  sourceGroup: HoidEpubSourceGroup;
  navigationHref: string;
  byteLength: number;
  documentSha256: string;
  navigationDocumentSha256: string;
  packageSourceFingerprint: string;
  candidateFingerprint: string;
}>;

export interface HoidEpubIngestionService {
  inspectPackage(source: unknown): Promise<HoidEpubInspectionResult<HoidEpubPackageInspectionCandidate>>;
  inspectChapterDocument(
    packageCandidate: unknown,
    navigationHref: unknown,
  ): Promise<HoidEpubInspectionResult<HoidEpubChapterInspectionCandidate>>;
}

const MIME_TYPE = "application/epub+zip";
const PACKAGE_MEDIA_TYPE = "application/oebps-package+xml";
const XHTML_MEDIA_TYPE = "application/xhtml+xml";
const NCX_MEDIA_TYPE = "application/x-dtbncx+xml";

class InspectionError extends Error {
  readonly reason: HoidEpubInspectionRejection;

  constructor(reason: HoidEpubInspectionRejection) {
    super(reason);
    this.reason = reason;
  }
}

function reject(reason: HoidEpubInspectionRejection): never {
  throw new InspectionError(reason);
}

function exactDataRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some(key => typeof key !== "string")) return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return keys.every(key => {
    const descriptor = descriptors[key];
    return descriptor !== undefined && "value" in descriptor && descriptor.enumerable === true;
  });
}

function denseArray(value: unknown, maximumLength: number): value is readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximumLength) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || !keys.includes("length")) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) return false;
  }
  return true;
}

function isBoundedString(value: unknown, maximumLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximumLength;
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function validateSourceDescriptor(value: unknown): HoidEpubSourceDescriptor | null {
  if (!exactDataRecord(value, ["sourceId", "workId", "editionId", "sourceGroup"])) return null;
  if (
    !isBoundedString(value.sourceId, 128) ||
    !/^[A-Za-z0-9._:-]+$/.test(value.sourceId) ||
    !isBoundedString(value.workId, 128) ||
    !/^[A-Za-z0-9._:-]+$/.test(value.workId) ||
    !isBoundedString(value.editionId, 128) ||
    !/^[A-Za-z0-9._:-]+$/.test(value.editionId) ||
    (value.sourceGroup !== "cosmere.epub" && value.sourceGroup !== "roshar-epubs")
  ) return null;

  const catalogueWork = HOID_SOURCE_BIBLIOGRAPHY.find(work => work.id === value.workId);
  if (catalogueWork === undefined || catalogueWork.sourceGroup !== value.sourceGroup) return null;
  const editionPolicy = getHoidEditionProgressPolicy(catalogueWork.id);
  if (editionPolicy.kind === "unknown" || editionPolicy.editionId !== value.editionId) return null;

  return Object.freeze({
    sourceId: value.sourceId as string,
    workId: value.workId as string,
    editionId: value.editionId as string,
    sourceGroup: value.sourceGroup as HoidEpubSourceGroup,
  });
}

function canonicalArchivePath(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 2048 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    value !== value.normalize("NFC")
  ) return null;

  const segments = value.split("/");
  if (segments.some(segment => segment.length === 0 || segment === "." || segment === "..")) return null;
  return value;
}

/**
 * Resolve a package-relative EPUB href without URL/network access.
 * Query and fragment components are ignored for resource identity.
 */
export function resolveHoidEpubHref(baseDocumentPath: unknown, href: unknown): string | null {
  const base = canonicalArchivePath(baseDocumentPath);
  if (base === null || typeof href !== "string" || href.length === 0 || href.length > 4096) return null;
  if (href.startsWith("/") || href.startsWith("//") || href.includes("\\") || /[\u0000-\u001f\u007f]/.test(href)) {
    return null;
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(href)) return null;

  const withoutFragment = href.split("#", 1)[0];
  const rawPath = withoutFragment.split("?", 1)[0];
  if (/%2f|%5c/i.test(rawPath)) return null;

  const baseSegments = base.split("/");
  baseSegments.pop();
  if (rawPath.length === 0) return base;

  for (const rawSegment of rawPath.split("/")) {
    if (rawSegment.length === 0) return null;
    let segment: string;
    try {
      segment = decodeURIComponent(rawSegment);
    } catch {
      return null;
    }
    if (
      segment.includes("/") ||
      segment.includes("\\") ||
      /[\u0000-\u001f\u007f]/.test(segment) ||
      segment !== segment.normalize("NFC")
    ) return null;

    if (segment === ".") continue;
    if (segment === "..") {
      if (baseSegments.length === 0) return null;
      baseSegments.pop();
      continue;
    }
    baseSegments.push(segment);
  }

  return baseSegments.length === 0 ? null : baseSegments.join("/");
}

function normalizeArchiveEntries(value: unknown): ReadonlyMap<string, HoidEpubArchiveEntry> {
  if (!denseArray(value, HOID_EPUB_INGESTION_LIMITS.maxArchiveEntries) || value.length === 0) {
    reject("archive-limit-exceeded");
  }

  const byPath = new Map<string, HoidEpubArchiveEntry>();
  const foldedPaths = new Set<string>();
  const ordinals = new Set<number>();
  let totalUncompressed = 0;

  for (const raw of value) {
    if (!exactDataRecord(raw, [
      "path", "ordinal", "localHeaderExtraFieldLength", "kind", "compressionMethod", "compressedSize",
      "uncompressedSize", "encrypted",
    ])) reject("invalid-archive-entry");

    if (raw.kind !== "file" && raw.kind !== "directory" && raw.kind !== "symlink") reject("invalid-archive-entry");
    const rawPath = raw.kind === "directory" && typeof raw.path === "string" && raw.path.endsWith("/")
      ? raw.path.slice(0, -1)
      : raw.path;
    const path = canonicalArchivePath(rawPath);
    if (path === null) reject("unsafe-archive-path");
    if (
      !Number.isSafeInteger(raw.ordinal) ||
      (raw.ordinal as number) < 0 ||
      !(raw.localHeaderExtraFieldLength === null || (
        Number.isSafeInteger(raw.localHeaderExtraFieldLength) &&
        (raw.localHeaderExtraFieldLength as number) >= 0
      )) ||
      !Number.isSafeInteger(raw.compressedSize) ||
      (raw.compressedSize as number) < 0 ||
      !Number.isSafeInteger(raw.uncompressedSize) ||
      (raw.uncompressedSize as number) < 0 ||
      (raw.kind !== "file" && raw.kind !== "directory" && raw.kind !== "symlink") ||
      (raw.compressionMethod !== "stored" && raw.compressionMethod !== "deflated" && raw.compressionMethod !== "unsupported") ||
      typeof raw.encrypted !== "boolean"
    ) reject("invalid-archive-entry");

    if (raw.kind === "symlink") reject("unsafe-archive-path");
    if (raw.kind === "file" && typeof raw.path === "string" && raw.path.endsWith("/")) reject("unsafe-archive-path");
    if (raw.encrypted) reject("encrypted-entry");
    if (raw.compressionMethod === "unsupported") reject("unsupported-compression");

    const folded = path.toLowerCase();
    if (byPath.has(path) || foldedPaths.has(folded)) reject("duplicate-archive-path");
    if (ordinals.has(raw.ordinal as number)) reject("invalid-archive-entry");
    ordinals.add(raw.ordinal as number);
    foldedPaths.add(folded);

    const uncompressedSize = raw.uncompressedSize as number;
    const compressedSize = raw.compressedSize as number;
    if (uncompressedSize > HOID_EPUB_INGESTION_LIMITS.maxEntryUncompressedBytes) reject("archive-size-limit");
    totalUncompressed += uncompressedSize;
    if (!Number.isSafeInteger(totalUncompressed) || totalUncompressed > HOID_EPUB_INGESTION_LIMITS.maxTotalUncompressedBytes) {
      reject("archive-size-limit");
    }
    if (uncompressedSize > 0 && compressedSize === 0) reject("compression-ratio-limit");
    if (compressedSize > 0 && uncompressedSize / compressedSize > HOID_EPUB_INGESTION_LIMITS.maxCompressionRatio) {
      reject("compression-ratio-limit");
    }

    byPath.set(path, Object.freeze({
      path,
      ordinal: raw.ordinal as number,
      localHeaderExtraFieldLength: raw.localHeaderExtraFieldLength as number | null,
      kind: raw.kind,
      compressionMethod: raw.compressionMethod,
      compressedSize,
      uncompressedSize,
      encrypted: raw.encrypted,
    }));
  }

  if (ordinals.size !== value.length) reject("invalid-archive-entry");
  for (let ordinal = 0; ordinal < value.length; ordinal += 1) {
    if (!ordinals.has(ordinal)) reject("invalid-archive-entry");
  }

  const firstFile = [...byPath.values()]
    .filter(entry => entry.kind === "file")
    .sort((left, right) => left.ordinal - right.ordinal)[0];
  if (
    firstFile === undefined ||
    firstFile.path !== "mimetype" ||
    firstFile.compressionMethod !== "stored" ||
    firstFile.localHeaderExtraFieldLength !== 0 ||
    firstFile.compressedSize !== 20 ||
    firstFile.uncompressedSize !== 20
  ) reject("mimetype-invalid");

  return byPath;
}

function archiveInventoryText(entries: ReadonlyMap<string, HoidEpubArchiveEntry>): string {
  return [...entries.values()]
    .sort((left, right) => left.ordinal - right.ordinal)
    .map(entry => [
      entry.ordinal, entry.path,
      entry.localHeaderExtraFieldLength === null ? "unknown" : entry.localHeaderExtraFieldLength,
      entry.kind, entry.compressionMethod,
      entry.compressedSize, entry.uncompressedSize, entry.encrypted ? 1 : 0,
    ].join("\\t"))
    .join("\\n");
}

function requireFile(
  entries: ReadonlyMap<string, HoidEpubArchiveEntry>,
  path: string,
): HoidEpubArchiveEntry {
  const entry = entries.get(path);
  if (entry === undefined || entry.kind !== "file") reject("required-entry-missing");
  return entry;
}

async function readCheckedEntry(
  archive: HoidEpubArchivePort,
  sourceId: string,
  entry: HoidEpubArchiveEntry,
  maximumBytes: number,
): Promise<Uint8Array> {
  if (entry.uncompressedSize > maximumBytes) {
    reject(maximumBytes === HOID_EPUB_INGESTION_LIMITS.maxChapterDocumentBytes
      ? "chapter-size-limit"
      : "archive-size-limit");
  }
  let bytes: Uint8Array | null;
  try {
    bytes = await archive.readEntry(sourceId, entry.path, maximumBytes);
  } catch {
    reject("source-read-failed");
  }
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== entry.uncompressedSize || bytes.byteLength > maximumBytes) {
    reject("source-read-failed");
  }
  return bytes;
}

function validateContainer(value: unknown): string {
  if (!exactDataRecord(value, ["rootfiles"]) || !denseArray(value.rootfiles, 32) || value.rootfiles.length === 0) {
    reject("container-invalid");
  }
  if (value.rootfiles.length !== 1) reject("multiple-rootfiles");
  const rootfile = value.rootfiles[0];
  if (!exactDataRecord(rootfile, ["fullPath", "mediaType"])) reject("container-invalid");
  const path = canonicalArchivePath(rootfile.fullPath);
  if (path === null || rootfile.mediaType !== PACKAGE_MEDIA_TYPE) reject("container-invalid");
  return path;
}

type NormalizedPackage = Readonly<{
  version: string;
  title: string;
  language: string;
  uniqueIdentifier: string;
  manifestByPath: ReadonlyMap<string, Readonly<{ id: string; mediaType: string }>>;
  manifestItemCount: number;
  spineItemCount: number;
  navigationPath: string;
  navigationFormat: HoidEpubNavigationFormat;
}>;

function normalizePackage(value: unknown, packagePath: string): NormalizedPackage {
  if (!exactDataRecord(value, [
    "version", "uniqueIdentifierId", "metadata", "manifestItems", "spine", "spineTocId",
  ])) reject("package-invalid");
  if (
    typeof value.version !== "string" ||
    !/^(2\.0|3\.[0-2])$/.test(value.version) ||
    !isBoundedString(value.uniqueIdentifierId, 256) ||
    !exactDataRecord(value.metadata, ["title", "language", "identifiers"]) ||
    !isBoundedString(value.metadata.title, 512) ||
    !isBoundedString(value.metadata.language, 64) ||
    !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value.metadata.language) ||
    !denseArray(value.metadata.identifiers, 256) ||
    !denseArray(value.manifestItems, HOID_EPUB_INGESTION_LIMITS.maxManifestItems) ||
    value.manifestItems.length === 0 ||
    !denseArray(value.spine, HOID_EPUB_INGESTION_LIMITS.maxSpineItems) ||
    value.spine.length === 0 ||
    !(value.spineTocId === null || isBoundedString(value.spineTocId, 256))
  ) reject("package-invalid");

  const identifiers = new Map<string, string>();
  for (const raw of value.metadata.identifiers) {
    if (!exactDataRecord(raw, ["id", "value"]) || !isBoundedString(raw.id, 256) || !isBoundedString(raw.value, 512)) {
      reject("package-invalid");
    }
    if (identifiers.has(raw.id)) reject("package-invalid");
    identifiers.set(raw.id, raw.value);
  }
  const uniqueIdentifier = identifiers.get(value.uniqueIdentifierId);
  if (uniqueIdentifier === undefined) reject("package-invalid");

  const manifestById = new Map<string, Readonly<{ path: string; mediaType: string; properties: readonly string[] }>>();
  const manifestByPath = new Map<string, Readonly<{ id: string; mediaType: string }>>();
  const foldedManifestPaths = new Set<string>();
  for (const raw of value.manifestItems) {
    if (!exactDataRecord(raw, ["id", "href", "mediaType", "properties"])) reject("manifest-invalid");
    if (
      !isBoundedString(raw.id, 256) ||
      !isBoundedString(raw.href, 4096) ||
      !isBoundedString(raw.mediaType, 128) ||
      !denseArray(raw.properties, 64)
    ) reject("manifest-invalid");
    const properties: string[] = [];
    for (const property of raw.properties) {
      if (!isBoundedString(property, 128)) reject("manifest-invalid");
      properties.push(property);
    }
    const path = resolveHoidEpubHref(packagePath, raw.href);
    if (path === null || manifestById.has(raw.id) || manifestByPath.has(path) || foldedManifestPaths.has(path.toLowerCase())) reject("manifest-invalid");
    foldedManifestPaths.add(path.toLowerCase());
    const mediaType = raw.mediaType.toLowerCase();
    manifestById.set(raw.id, Object.freeze({ path, mediaType, properties: Object.freeze(properties) }));
    manifestByPath.set(path, Object.freeze({ id: raw.id, mediaType }));
  }

  const spineIds = new Set<string>();
  for (const raw of value.spine) {
    if (!exactDataRecord(raw, ["idref", "linear"]) || !isBoundedString(raw.idref, 256) || typeof raw.linear !== "boolean") {
      reject("spine-invalid");
    }
    if (spineIds.has(raw.idref) || !manifestById.has(raw.idref)) reject("spine-invalid");
    spineIds.add(raw.idref);
  }

  const navItems = [...manifestById.entries()].filter(([, item]) => item.properties.includes("nav"));
  if (navItems.length > 1) reject("navigation-invalid");

  let navigationItem: Readonly<{ path: string; mediaType: string }> | undefined;
  let navigationFormat: HoidEpubNavigationFormat;
  if (navItems.length === 1) {
    const item = navItems[0][1];
    if (item.mediaType !== XHTML_MEDIA_TYPE) reject("navigation-invalid");
    navigationItem = item;
    navigationFormat = "epub3-nav";
  } else {
    if (value.version.startsWith("3.")) reject("navigation-invalid");
    if (value.spineTocId === null) reject("navigation-invalid");
    const ncx = manifestById.get(value.spineTocId);
    if (ncx === undefined || ncx.mediaType !== NCX_MEDIA_TYPE) reject("navigation-invalid");
    navigationItem = ncx;
    navigationFormat = "epub2-ncx";
  }

  return Object.freeze({
    version: value.version,
    title: value.metadata.title,
    language: value.metadata.language,
    uniqueIdentifier,
    manifestByPath,
    manifestItemCount: manifestById.size,
    spineItemCount: spineIds.size,
    navigationPath: navigationItem.path,
    navigationFormat,
  });
}

function flattenNavigation(
  nodes: unknown,
  basePath: string,
  manifest: ReadonlyMap<string, Readonly<{ id: string; mediaType: string }>>,
): Readonly<{ count: number; navigationPaths: ReadonlySet<string>; xhtmlPaths: ReadonlySet<string> }> {
  const navigationPaths = new Set<string>();
  const xhtmlPaths = new Set<string>();
  let count = 0;

  const visit = (value: unknown, depth: number): void => {
    if (depth > HOID_EPUB_INGESTION_LIMITS.maxNavigationDepth || !denseArray(value, HOID_EPUB_INGESTION_LIMITS.maxNavigationNodes)) {
      reject("navigation-invalid");
    }
    for (const raw of value) {
      if (!exactDataRecord(raw, ["label", "href", "children"])) reject("navigation-invalid");
      if (
        !isBoundedString(raw.label, 512) ||
        !isBoundedString(raw.href, 4096) ||
        !denseArray(raw.children, HOID_EPUB_INGESTION_LIMITS.maxNavigationNodes)
      ) reject("navigation-invalid");
      count += 1;
      if (count > HOID_EPUB_INGESTION_LIMITS.maxNavigationNodes) reject("navigation-invalid");
      const path = resolveHoidEpubHref(basePath, raw.href);
      if (path === null) reject("navigation-target-unresolved");
      const item = manifest.get(path);
      if (item === undefined) reject("navigation-target-unresolved");
      navigationPaths.add(path);
      if (item.mediaType === XHTML_MEDIA_TYPE) xhtmlPaths.add(path);
      visit(raw.children, depth + 1);
    }
  };

  visit(nodes, 0);
  if (count === 0) reject("navigation-invalid");
  return Object.freeze({ count, navigationPaths, xhtmlPaths });
}

async function digestBytes(digest: HoidEpubDigestPort, bytes: Uint8Array): Promise<string> {
  const result = await digest.sha256(bytes);
  if (!validDigest(result)) reject("digest-invalid");
  return result;
}

async function digestText(digest: HoidEpubDigestPort, value: string): Promise<string> {
  const result = await digest.sha256Utf8(value);
  if (!validDigest(result)) reject("digest-invalid");
  return result;
}

type PackageState = Readonly<{
  source: HoidEpubSourceDescriptor;
  report: HoidEpubPackageInspectionCandidate;
  packagePath: string;
  navigationPath: string;
  navigationTargets: ReadonlySet<string>;
  xhtmlTargets: ReadonlySet<string>;
  manifestByPath: ReadonlyMap<string, Readonly<{ id: string; mediaType: string }>>;
}>;

export function createHoidEpubIngestionService(dependencies: Readonly<{
  archive: HoidEpubArchivePort;
  xml: HoidEpubXmlPort;
  digest: HoidEpubDigestPort;
}>): HoidEpubIngestionService {
  const states = new WeakMap<object, PackageState>();

  async function inspectPackage(sourceValue: unknown): Promise<HoidEpubInspectionResult<HoidEpubPackageInspectionCandidate>> {
    const source = validateSourceDescriptor(sourceValue);
    if (source === null) return Object.freeze({ status: "rejected", reason: "invalid-source-descriptor" });

    try {
      const rawEntries = await dependencies.archive.listEntries(source.sourceId);
      const entries = normalizeArchiveEntries(rawEntries);
      const mimetypeEntry = requireFile(entries, "mimetype");
      const mimetypeBytes = await readCheckedEntry(
        dependencies.archive, source.sourceId, mimetypeEntry, HOID_EPUB_INGESTION_LIMITS.maxMetadataDocumentBytes,
      );
      const mimetypeText = String.fromCharCode(...mimetypeBytes);
      if (mimetypeText !== MIME_TYPE) reject("mimetype-invalid");
      const mimetypeSha = await digestBytes(dependencies.digest, mimetypeBytes);

      const containerEntry = requireFile(entries, "META-INF/container.xml");
      const containerBytes = await readCheckedEntry(
        dependencies.archive, source.sourceId, containerEntry, HOID_EPUB_INGESTION_LIMITS.maxMetadataDocumentBytes,
      );
      let container: HoidEpubContainerDocument;
      try {
        container = await dependencies.xml.parseContainerXml(containerBytes);
      } catch {
        reject("container-invalid");
      }
      const containerSha = await digestBytes(dependencies.digest, containerBytes);
      const packagePath = validateContainer(container);
      const packageEntry = requireFile(entries, packagePath);
      const packageBytes = await readCheckedEntry(
        dependencies.archive, source.sourceId, packageEntry, HOID_EPUB_INGESTION_LIMITS.maxMetadataDocumentBytes,
      );

      let parsedPackage: HoidEpubPackageDocument;
      try {
        parsedPackage = await dependencies.xml.parsePackageDocument(packageBytes);
      } catch {
        reject("package-invalid");
      }
      const normalized = normalizePackage(parsedPackage, packagePath);
      for (const [manifestPath] of normalized.manifestByPath) {
        const manifestEntry = entries.get(manifestPath);
        if (manifestEntry === undefined || manifestEntry.kind !== "file") reject("manifest-invalid");
      }
      const navigationEntry = requireFile(entries, normalized.navigationPath);
      const navigationBytes = await readCheckedEntry(
        dependencies.archive, source.sourceId, navigationEntry, HOID_EPUB_INGESTION_LIMITS.maxNavigationDocumentBytes,
      );

      let navigation: readonly HoidEpubNavigationNode[];
      try {
        navigation = await dependencies.xml.parseNavigationDocument(navigationBytes, normalized.navigationFormat);
      } catch {
        reject("navigation-invalid");
      }
      const flattened = flattenNavigation(navigation, normalized.navigationPath, normalized.manifestByPath);

      const inventory = archiveInventoryText(entries);
      const [inventorySha, packageSha, navigationSha] = await Promise.all([
        digestText(dependencies.digest, inventory),
        digestBytes(dependencies.digest, packageBytes),
        digestBytes(dependencies.digest, navigationBytes),
      ]);

      // Re-read every package-defining member before issuing a candidate. This
      // closes the inspection-time TOCTOU window even when ZIP inventory sizes
      // remain unchanged while the source bytes are replaced.
      const finalEntries = normalizeArchiveEntries(await dependencies.archive.listEntries(source.sourceId));
      const finalInventorySha = await digestText(
        dependencies.digest,
        archiveInventoryText(finalEntries),
      );
      if (finalInventorySha !== inventorySha) reject("source-changed");

      const packageDefiningDocuments = [
        {
          path: "mimetype",
          digest: mimetypeSha,
          maximumBytes: HOID_EPUB_INGESTION_LIMITS.maxMetadataDocumentBytes,
        },
        {
          path: "META-INF/container.xml",
          digest: containerSha,
          maximumBytes: HOID_EPUB_INGESTION_LIMITS.maxMetadataDocumentBytes,
        },
        {
          path: packagePath,
          digest: packageSha,
          maximumBytes: HOID_EPUB_INGESTION_LIMITS.maxMetadataDocumentBytes,
        },
        {
          path: normalized.navigationPath,
          digest: navigationSha,
          maximumBytes: HOID_EPUB_INGESTION_LIMITS.maxNavigationDocumentBytes,
        },
      ] as const;

      for (const document of packageDefiningDocuments) {
        const finalEntry = requireFile(finalEntries, document.path);
        let finalBytes: Uint8Array;
        try {
          finalBytes = await readCheckedEntry(
            dependencies.archive,
            source.sourceId,
            finalEntry,
            document.maximumBytes,
          );
        } catch {
          reject("source-changed");
        }
        if (await digestBytes(dependencies.digest, finalBytes) !== document.digest) {
          reject("source-changed");
        }
      }

      const expectedEdition = HOID_EDITION_STRUCTURES.find(edition =>
        edition.editionId === source.editionId &&
        edition.sourceGroup === source.sourceGroup &&
        edition.works.some(work => work.workIds.includes(source.workId)),
      );
      if (expectedEdition === undefined || navigationSha !== expectedEdition.navigationSha256) {
        reject("edition-navigation-mismatch");
      }
      const sourceFingerprint = await digestText(dependencies.digest, JSON.stringify({
        sourceId: source.sourceId,
        workId: source.workId,
        editionId: source.editionId,
        sourceGroup: source.sourceGroup,
        archiveInventorySha256: inventorySha,
        mimetypeSha256: mimetypeSha,
        containerDocumentSha256: containerSha,
        packageDocumentSha256: packageSha,
        navigationDocumentSha256: navigationSha,
      }));

      const report: HoidEpubPackageInspectionCandidate = Object.freeze({
        status: "candidate-only",
        sourceId: source.sourceId,
        workId: source.workId,
        declaredEditionId: source.editionId,
        sourceGroup: source.sourceGroup,
        editionBinding: "catalogue-navigation-digest-match",
        packageVersion: normalized.version,
        title: normalized.title,
        language: normalized.language,
        uniqueIdentifier: normalized.uniqueIdentifier,
        archiveEntryCount: entries.size,
        manifestItemCount: normalized.manifestItemCount,
        spineItemCount: normalized.spineItemCount,
        navigationEntryCount: flattened.count,
        navigationXhtmlTargetCount: flattened.xhtmlPaths.size,
        archiveInventorySha256: inventorySha,
        mimetypeSha256: mimetypeSha,
        containerDocumentSha256: containerSha,
        packageDocumentSha256: packageSha,
        navigationDocumentSha256: navigationSha,
        sourceFingerprint,
      });
      states.set(report, Object.freeze({
        source,
        report,
        packagePath,
        navigationPath: normalized.navigationPath,
        navigationTargets: flattened.navigationPaths,
        xhtmlTargets: flattened.xhtmlPaths,
        manifestByPath: normalized.manifestByPath,
      }));
      return Object.freeze({ status: "candidate", candidate: report });
    } catch (error) {
      const reason = error instanceof InspectionError ? error.reason : "inspection-failed";
      return Object.freeze({ status: "rejected", reason });
    }
  }

  async function inspectChapterDocument(
    packageCandidate: unknown,
    navigationHref: unknown,
  ): Promise<HoidEpubInspectionResult<HoidEpubChapterInspectionCandidate>> {
    if (typeof packageCandidate !== "object" || packageCandidate === null) {
      return Object.freeze({ status: "rejected", reason: "report-not-issued-here" });
    }
    const state = states.get(packageCandidate);
    if (state === undefined || state.report !== packageCandidate) {
      return Object.freeze({ status: "rejected", reason: "report-not-issued-here" });
    }
    if (typeof navigationHref !== "string" || navigationHref.length === 0 || navigationHref.length > 4096) {
      return Object.freeze({ status: "rejected", reason: "chapter-not-in-navigation" });
    }

    try {
      const path = resolveHoidEpubHref(state.navigationPath, navigationHref);
      if (path === null || !state.navigationTargets.has(path)) reject("chapter-not-in-navigation");
      if (!state.xhtmlTargets.has(path)) reject("chapter-not-xhtml");
      const manifestItem = state.manifestByPath.get(path);
      if (manifestItem === undefined || manifestItem.mediaType !== XHTML_MEDIA_TYPE) reject("chapter-not-xhtml");

      const entries = normalizeArchiveEntries(await dependencies.archive.listEntries(state.source.sourceId));
      const currentInventorySha = await digestText(dependencies.digest, archiveInventoryText(entries));
      if (currentInventorySha !== state.report.archiveInventorySha256) reject("source-changed");

      const currentMimetypeEntry = requireFile(entries, "mimetype");
      const currentMimetypeBytes = await readCheckedEntry(
        dependencies.archive, state.source.sourceId, currentMimetypeEntry,
        HOID_EPUB_INGESTION_LIMITS.maxMetadataDocumentBytes,
      );
      if (
        String.fromCharCode(...currentMimetypeBytes) !== MIME_TYPE ||
        await digestBytes(dependencies.digest, currentMimetypeBytes) !== state.report.mimetypeSha256
      ) reject("source-changed");

      const currentContainerEntry = requireFile(entries, "META-INF/container.xml");
      const currentContainerBytes = await readCheckedEntry(
        dependencies.archive, state.source.sourceId, currentContainerEntry,
        HOID_EPUB_INGESTION_LIMITS.maxMetadataDocumentBytes,
      );
      if (await digestBytes(dependencies.digest, currentContainerBytes) !== state.report.containerDocumentSha256) {
        reject("source-changed");
      }

      const currentPackageEntry = requireFile(entries, state.packagePath);
      const currentPackageBytes = await readCheckedEntry(
        dependencies.archive, state.source.sourceId, currentPackageEntry,
        HOID_EPUB_INGESTION_LIMITS.maxMetadataDocumentBytes,
      );
      if (await digestBytes(dependencies.digest, currentPackageBytes) !== state.report.packageDocumentSha256) {
        reject("source-changed");
      }

      const currentNavigationEntry = requireFile(entries, state.navigationPath);
      const currentNavigationBytes = await readCheckedEntry(
        dependencies.archive, state.source.sourceId, currentNavigationEntry,
        HOID_EPUB_INGESTION_LIMITS.maxNavigationDocumentBytes,
      );
      if (await digestBytes(dependencies.digest, currentNavigationBytes) !== state.report.navigationDocumentSha256) {
        reject("source-changed");
      }

      const entry = entries.get(path);
      if (entry === undefined || entry.kind !== "file") reject("chapter-not-in-navigation");
      if (entry.uncompressedSize > HOID_EPUB_INGESTION_LIMITS.maxChapterDocumentBytes) reject("chapter-size-limit");

      const bytes = await readCheckedEntry(
        dependencies.archive, state.source.sourceId, entry, HOID_EPUB_INGESTION_LIMITS.maxChapterDocumentBytes,
      );
      let validXhtml = false;
      try {
        validXhtml = await dependencies.xml.validateXhtml(bytes);
      } catch {
        reject("xhtml-invalid");
      }
      if (validXhtml !== true) reject("xhtml-invalid");

      const documentSha = await digestBytes(dependencies.digest, bytes);
      const candidateFingerprint = await digestText(dependencies.digest, JSON.stringify({
        workId: state.source.workId,
        editionId: state.source.editionId,
        navigationDocumentSha256: state.report.navigationDocumentSha256,
        navigationHref,
        documentSha256: documentSha,
      }));

      return Object.freeze({
        status: "candidate",
        candidate: Object.freeze({
          status: "candidate-only",
          workId: state.source.workId,
          declaredEditionId: state.source.editionId,
          sourceGroup: state.source.sourceGroup,
          navigationHref,
          byteLength: bytes.byteLength,
          documentSha256: documentSha,
          navigationDocumentSha256: state.report.navigationDocumentSha256,
          packageSourceFingerprint: state.report.sourceFingerprint,
          candidateFingerprint,
        }),
      });
    } catch (error) {
      const reason = error instanceof InspectionError ? error.reason : "inspection-failed";
      return Object.freeze({ status: "rejected", reason });
    }
  }

  return Object.freeze({ inspectPackage, inspectChapterDocument });
}
