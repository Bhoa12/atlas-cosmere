import { inflateSync, strFromU8, strToU8 } from "fflate";
import { DOMParser } from "@xmldom/xmldom";
import { sha256 } from "@noble/hashes/sha256";

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();
function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC32_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

const MAX_ARCHIVE_BYTES = 384 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 20_000;
const MAX_PATH_BYTES = 1_024;
const MAX_METADATA_FILE_BYTES = 2 * 1024 * 1024;
const MAX_METADATA_TOTAL_BYTES = 4 * 1024 * 1024;
const MAX_TOC_ENTRIES = 5_000;
const MAX_COMPRESSION_RATIO = 1_000;
const EPUB_MIMETYPE = "application/epub+zip";
const EPUB_NS = "http://www.idpf.org/2007/ops";

type ZipEntry = Readonly<{
  path: string; flags: number; method: number; crc: number;
  compressedSize: number; uncompressedSize: number; localOffset: number; directory: boolean;
}>;
type ZipIndexResult =
  | Readonly<{ status: "ready"; entries: ReadonlyMap<string, ZipEntry>; centralDirectoryOffset: number }>
  | Readonly<{ status: "invalid"; reason: "invalid-zip" | "unsupported-zip-feature" | "unsafe-archive-path" }>;

export type HoidEpubProbeEntry = Readonly<{
  tocOrdinal: number; numberedEntryOrdinal: number | null; labelledChapterNumber: number | null;
  kind: "numbered-chapter" | "section"; spineOrdinal: number; locatorId: string;
}>;
export type HoidEpubStructureProbe = Readonly<{
  schemaVersion: 1; kind: "hoid-epub-structure-candidate"; scope: "metadata-only";
  workSegmentation: "not-inferred"; packageVersion: string; navigationFormat: "epub3-nav" | "epub2-ncx";
  packageSha256: string; navigationSha256: string; candidateFingerprint: string;
  manifestItemCount: number; spineItemCount: number; navigationEntryCount: number;
  numberedTocEntryCount: number; unnumberedTocEntryCount: number;
  repeatedNumberedLabelsAcrossEdition: readonly number[]; entries: readonly HoidEpubProbeEntry[];
  sourceContentIncluded: false; chapterBodiesInspected: false; progressUnlockGranted: false;
  promotionAllowed: false; productionWritePerformed: false;
}>;
export type HoidEpubStructureProbeResult =
  | Readonly<{ status: "candidate"; probe: HoidEpubStructureProbe }>
  | Readonly<{
      status: "invalid";
      reason:
        | "invalid-input" | "archive-too-large" | "invalid-zip" | "unsupported-zip-feature"
        | "unsafe-archive-path" | "missing-mimetype" | "invalid-mimetype" | "missing-container"
        | "metadata-too-large" | "invalid-container-xml" | "invalid-package-path" | "missing-package"
        | "invalid-package-xml" | "invalid-package-manifest" | "missing-navigation"
        | "invalid-navigation-xml" | "empty-navigation" | "navigation-too-large"
        | "navigation-target-not-in-manifest" | "navigation-target-not-in-spine";
      promotionAllowed: false; productionWritePerformed: false;
    }>;

type ManifestItem = Readonly<{ id: string; path: string; mediaType: string; properties: string }>;
type NavigationLink = Readonly<{ href: string; label: string }>;

function invalid(reason: Extract<HoidEpubStructureProbeResult, { status: "invalid" }>["reason"]): HoidEpubStructureProbeResult {
  return Object.freeze({ status: "invalid", reason, promotionAllowed: false, productionWritePerformed: false });
}
function u16(view: DataView, offset: number): number { return view.getUint16(offset, true); }
function u32(view: DataView, offset: number): number { return view.getUint32(offset, true); }
function toHex(bytes: Uint8Array): string {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}
function digest(bytes: Uint8Array): string { return toHex(sha256(bytes)); }
function localName(element: Element): string {
  return element.localName || element.nodeName.split(":").pop() || element.nodeName;
}
function decodeZipName(bytes: Uint8Array, utf8: boolean): string | null {
  if (!utf8 && bytes.some(byte => byte > 0x7f)) return null;
  try {
    const value = strFromU8(bytes);
    return value.length > 0 && !value.includes("\u0000") && !value.includes("\\") ? value : null;
  } catch { return null; }
}
function canonicalArchivePath(raw: string): Readonly<{ path: string; directory: boolean }> | null {
  if (!raw || raw.length > MAX_PATH_BYTES || raw.startsWith("/") || /^[A-Za-z]:/u.test(raw) ||
      raw.includes("\\") || raw.includes("\u0000")) return null;
  const directory = raw.endsWith("/");
  const value = directory ? raw.slice(0, -1) : raw;
  const segments = value.split("/");
  if (segments.some(segment => !segment || segment === "." || segment === ".." || /[\u0000-\u001f]/u.test(segment))) return null;
  return Object.freeze({ path: segments.join("/"), directory });
}
function hasZip64Extra(extra: Uint8Array): boolean {
  let offset = 0;
  while (offset + 4 <= extra.length) {
    const view = new DataView(extra.buffer, extra.byteOffset + offset, extra.byteLength - offset);
    const id = u16(view, 0);
    const length = u16(view, 2);
    if (offset + 4 + length > extra.length || id === 0x0001) return true;
    offset += 4 + length;
  }
  return offset !== extra.length;
}
function parseZipDirectory(bytes: Uint8Array): ZipIndexResult {
  try {
    if (bytes.length < 22) return { status: "invalid", reason: "invalid-zip" };
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const minimum = Math.max(0, bytes.length - 65_557);
    let eocd = -1;
    for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
      if (u32(view, offset) === 0x06054b50 && offset + 22 + u16(view, offset + 20) === bytes.length) {
        eocd = offset; break;
      }
    }
    if (eocd < 0) return { status: "invalid", reason: "invalid-zip" };
    const disk = u16(view, eocd + 4);
    const centralDisk = u16(view, eocd + 6);
    const diskEntries = u16(view, eocd + 8);
    const totalEntries = u16(view, eocd + 10);
    const centralSize = u32(view, eocd + 12);
    const centralOffset = u32(view, eocd + 16);
    if (disk !== 0 || centralDisk !== 0 || diskEntries !== totalEntries ||
        totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
      return { status: "invalid", reason: "unsupported-zip-feature" };
    }
    if (totalEntries === 0 || totalEntries > MAX_ZIP_ENTRIES ||
        centralOffset + centralSize > eocd || centralOffset + centralSize < centralOffset) {
      return { status: "invalid", reason: "invalid-zip" };
    }
    const entries = new Map<string, ZipEntry>();
    let offset = centralOffset;
    for (let index = 0; index < totalEntries; index += 1) {
      if (offset + 46 > centralOffset + centralSize || u32(view, offset) !== 0x02014b50) {
        return { status: "invalid", reason: "invalid-zip" };
      }
      const madeBy = u16(view, offset + 4);
      const flags = u16(view, offset + 8);
      const method = u16(view, offset + 10);
      const crc = u32(view, offset + 16);
      const compressedSize = u32(view, offset + 20);
      const uncompressedSize = u32(view, offset + 24);
      const nameLength = u16(view, offset + 28);
      const extraLength = u16(view, offset + 30);
      const commentLength = u16(view, offset + 32);
      const diskStart = u16(view, offset + 34);
      const attributes = u32(view, offset + 38);
      const localOffset = u32(view, offset + 42);
      const end = offset + 46 + nameLength + extraLength + commentLength;
      if (!nameLength || nameLength > MAX_PATH_BYTES || extraLength > 4_096 || commentLength > 4_096 ||
          end > centralOffset + centralSize || diskStart !== 0 ||
          compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
        return { status: "invalid", reason: "unsupported-zip-feature" };
      }
      if ((flags & 0x0041) !== 0) return { status: "invalid", reason: "unsupported-zip-feature" };
      const name = decodeZipName(bytes.subarray(offset + 46, offset + 46 + nameLength), (flags & 0x0800) !== 0);
      const canonical = name === null ? null : canonicalArchivePath(name);
      if (!canonical) return { status: "invalid", reason: "unsafe-archive-path" };
      const extraStart = offset + 46 + nameLength;
      if (hasZip64Extra(bytes.subarray(extraStart, extraStart + extraLength))) {
        return { status: "invalid", reason: "unsupported-zip-feature" };
      }
      const host = madeBy >>> 8;
      const unixMode = attributes >>> 16;
      if (host === 3 && (unixMode & 0xf000) === 0xa000) return { status: "invalid", reason: "unsafe-archive-path" };
      if (entries.has(canonical.path)) return { status: "invalid", reason: "unsafe-archive-path" };
      entries.set(canonical.path, Object.freeze({
        path: canonical.path, flags, method, crc, compressedSize, uncompressedSize, localOffset,
        directory: canonical.directory,
      }));
      offset = end;
    }
    if (offset !== centralOffset + centralSize) return { status: "invalid", reason: "invalid-zip" };
    return Object.freeze({ status: "ready", entries, centralDirectoryOffset: centralOffset });
  } catch { return { status: "invalid", reason: "invalid-zip" }; }
}
function extractMetadataEntry(
  bytes: Uint8Array, entry: ZipEntry | undefined, maximumBytes: number, dataLimit: number,
): Uint8Array | null {
  if (!entry || entry.directory || entry.uncompressedSize > maximumBytes || entry.compressedSize > maximumBytes ||
      (entry.compressedSize === 0 && entry.uncompressedSize > 0) ||
      (entry.compressedSize > 0 && entry.uncompressedSize > entry.compressedSize * MAX_COMPRESSION_RATIO) ||
      (entry.method !== 0 && entry.method !== 8)) return null;
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const offset = entry.localOffset;
    if (offset + 30 > dataLimit || u32(view, offset) !== 0x04034b50) return null;
    const flags = u16(view, offset + 6);
    const method = u16(view, offset + 8);
    const nameLength = u16(view, offset + 26);
    const extraLength = u16(view, offset + 28);
    const dataOffset = offset + 30 + nameLength + extraLength;
    if (flags !== entry.flags || method !== entry.method || nameLength > MAX_PATH_BYTES ||
        extraLength > 4_096 || dataOffset > dataLimit || dataOffset + entry.compressedSize > dataLimit) return null;
    const localName = decodeZipName(bytes.subarray(offset + 30, offset + 30 + nameLength), (flags & 0x0800) !== 0);
    if (localName !== entry.path ||
        hasZip64Extra(bytes.subarray(offset + 30 + nameLength, dataOffset))) return null;
    const compressed = bytes.subarray(dataOffset, dataOffset + entry.compressedSize);
    const output = method === 0 ? new Uint8Array(compressed) :
      inflateSync(compressed, { out: new Uint8Array(entry.uncompressedSize) });
    return output.length === entry.uncompressedSize && crc32(output) === entry.crc ? output : null;
  } catch { return null; }
}
function decodeMetadata(bytes: Uint8Array): string | null {
  try {
    const value = strFromU8(bytes);
    return value.includes("\u0000") ? null : value;
  } catch { return null; }
}
function parseXml(value: string, mimeType: string): Document | null {
  if (/<!DOCTYPE|<!ENTITY/iu.test(value)) return null;
  let parseError = false;
  try {
    const parser = new DOMParser({ onError(level) {
      if (level === "error" || level === "fatalError") parseError = true;
    } });
    const document = parser.parseFromString(value, mimeType);
    return !parseError && document?.documentElement ? document : null;
  } catch { return null; }
}
function descendants(root: Document | Element, name: string): Element[] {
  const nodes = root.getElementsByTagName("*");
  const result: Element[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes.item(index);
    if (node && localName(node) === name) result.push(node);
  }
  return result;
}
function directChild(parent: Element, name: string): Element | null {
  let child = parent.firstChild;
  while (child) {
    if (child.nodeType === 1 && localName(child as Element) === name) return child as Element;
    child = child.nextSibling;
  }
  return null;
}
function resolveZipPath(baseFile: string, href: string): string | null {
  if (!href || href.startsWith("/") || href.startsWith("//") ||
      /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(href) || href.includes("\\")) return null;
  const pathPart = href.split(/[?#]/u, 1)[0];
  if (!pathPart) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(pathPart); } catch { return null; }
  if (decoded.includes("\\") || decoded.includes("\u0000")) return null;
  const segments = baseFile.split("/").slice(0, -1);
  for (const segment of decoded.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return null;
      segments.pop();
    } else {
      if (/[\u0000-\u001f]/u.test(segment)) return null;
      segments.push(segment);
    }
  }
  return segments.length > 0 ? segments.join("/") : null;
}
function parseChapterNumber(label: string): number | null {
  const normalized = label.normalize("NFKC").trim();
  const named = /^(?:chapter|cap[ií]tulo)\s+(\d{1,4})(?:\b|$)/iu.exec(normalized);
  const numbered = /^(\d{1,4})(?:\s*(?:[.:—-]|$))/u.exec(normalized);
  const match = named ?? numbered;
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
function parseEpub3Navigation(document: Document): readonly NavigationLink[] | null {
  const toc = descendants(document, "nav").find(nav => {
    const type = nav.getAttribute("epub:type") || nav.getAttributeNS(EPUB_NS, "type") || "";
    return type.split(/\s+/u).includes("toc");
  });
  if (!toc) return null;
  const links = descendants(toc, "a").map(anchor => Object.freeze({
    href: anchor.getAttribute("href") || "", label: anchor.textContent || "",
  })).filter(link => link.href.length > 0);
  return links.length ? Object.freeze(links) : null;
}
function parseEpub2Navigation(document: Document): readonly NavigationLink[] | null {
  const links: NavigationLink[] = [];
  for (const point of descendants(document, "navPoint")) {
    const label = directChild(point, "navLabel");
    const content = directChild(point, "content");
    const text = label ? directChild(label, "text") : null;
    const href = content?.getAttribute("src") || "";
    if (href) links.push(Object.freeze({ href, label: text?.textContent || "" }));
  }
  return links.length ? Object.freeze(links) : null;
}

/**
 * Inspect EPUB container/package/navigation metadata only. Chapter XHTML,
 * images, fonts and other book payloads are never decompressed. The result is
 * an untrusted structural candidate and never updates manifests, allowlists,
 * evidence registries, progress or spoiler permissions.
 */
export function probeHoidEpubStructure(input: unknown): HoidEpubStructureProbeResult {
  if (!(input instanceof Uint8Array)) return invalid("invalid-input");
  let bytes: Uint8Array;
  try { bytes = new Uint8Array(input); } catch { return invalid("invalid-input"); }
  if (bytes.length > MAX_ARCHIVE_BYTES) return invalid("archive-too-large");
  const zip = parseZipDirectory(bytes);
  if (zip.status !== "ready") return invalid(zip.reason);

  const mimetypeEntry = zip.entries.get("mimetype");
  if (!mimetypeEntry || mimetypeEntry.localOffset !== 0 || mimetypeEntry.method !== 0) return invalid("missing-mimetype");
  const mimetypeBytes = extractMetadataEntry(bytes, mimetypeEntry, 64, zip.centralDirectoryOffset);
  if (!mimetypeBytes) return invalid("missing-mimetype");
  if (decodeMetadata(mimetypeBytes) !== EPUB_MIMETYPE) return invalid("invalid-mimetype");

  const containerEntry = zip.entries.get("META-INF/container.xml");
  if (!containerEntry) return invalid("missing-container");
  const containerBytes = extractMetadataEntry(bytes, containerEntry, 128 * 1024, zip.centralDirectoryOffset);
  if (!containerBytes) return invalid("metadata-too-large");
  const containerText = decodeMetadata(containerBytes);
  const containerDocument = containerText ? parseXml(containerText, "application/xml") : null;
  if (!containerDocument) return invalid("invalid-container-xml");

  const rootfile = descendants(containerDocument, "rootfile")[0];
  const packagePath = rootfile?.getAttribute("full-path") || "";
  const canonicalPackagePath = canonicalArchivePath(packagePath);
  if (!canonicalPackagePath || canonicalPackagePath.directory) return invalid("invalid-package-path");
  const packageEntry = zip.entries.get(canonicalPackagePath.path);
  if (!packageEntry) return invalid("missing-package");
  const packageBytes = extractMetadataEntry(bytes, packageEntry, MAX_METADATA_FILE_BYTES, zip.centralDirectoryOffset);
  if (!packageBytes) return invalid("metadata-too-large");
  const packageText = decodeMetadata(packageBytes);
  const packageDocument = packageText ? parseXml(packageText, "application/xml") : null;
  if (!packageDocument) return invalid("invalid-package-xml");

  const packageElement = packageDocument.documentElement;
  if (localName(packageElement) !== "package") return invalid("invalid-package-xml");
  const packageVersion = packageElement.getAttribute("version") || "";
  if (packageVersion !== "2.0" && packageVersion !== "3.0") return invalid("invalid-package-manifest");

  const manifestItems = new Map<string, ManifestItem>();
  const paths = new Set<string>();
  const manifestByPath = new Map<string, ManifestItem>();
  for (const element of descendants(packageElement, "item")) {
    const id = element.getAttribute("id") || "";
    const href = element.getAttribute("href") || "";
    const mediaType = element.getAttribute("media-type") || "";
    const properties = element.getAttribute("properties") || "";
    const path = resolveZipPath(canonicalPackagePath.path, href);
    if (!/^[A-Za-z0-9_.:-]{1,128}$/u.test(id) || !mediaType || !path ||
        manifestItems.has(id) || paths.has(path)) return invalid("invalid-package-manifest");
    const item = Object.freeze({ id, path, mediaType, properties });
    manifestItems.set(id, item);
    manifestByPath.set(path, item);
    paths.add(path);
  }
  if (!manifestItems.size) return invalid("invalid-package-manifest");

  const spine = descendants(packageElement, "spine")[0];
  if (!spine) return invalid("invalid-package-manifest");
  const spineRefs = descendants(spine, "itemref");
  const spineOrdinalById = new Map<string, number>();
  let invalidSpine = false;
  spineRefs.forEach((itemref, index) => {
    const idref = itemref.getAttribute("idref") || "";
    if (!manifestItems.has(idref) || spineOrdinalById.has(idref)) invalidSpine = true;
    else spineOrdinalById.set(idref, index + 1);
  });
  if (invalidSpine || spineOrdinalById.size !== spineRefs.length || !spineRefs.length) {
    return invalid("invalid-package-manifest");
  }

  const navItem = [...manifestItems.values()].find(item => item.properties.split(/\s+/u).includes("nav"));
  const ncxId = spine.getAttribute("toc") || "";
  const ncxItem = ncxId ? manifestItems.get(ncxId) :
    [...manifestItems.values()].find(item => item.mediaType === "application/x-dtbncx+xml");
  const navigationItem = navItem ?? ncxItem;
  if (!navigationItem) return invalid("missing-navigation");
  if (navItem && navigationItem.mediaType !== "application/xhtml+xml") return invalid("invalid-package-manifest");
  if (!navItem && navigationItem.mediaType !== "application/x-dtbncx+xml") return invalid("invalid-package-manifest");
  const navigationEntry = zip.entries.get(navigationItem.path);
  if (!navigationEntry) return invalid("missing-navigation");
  const navigationBytes = extractMetadataEntry(bytes, navigationEntry, MAX_METADATA_FILE_BYTES, zip.centralDirectoryOffset);
  if (!navigationBytes) return invalid("navigation-too-large");
  if (mimetypeBytes.length + containerBytes.length + packageBytes.length + navigationBytes.length > MAX_METADATA_TOTAL_BYTES) {
    return invalid("metadata-too-large");
  }

  const navigationText = decodeMetadata(navigationBytes);
  const navigationDocument = navigationText ? parseXml(
    navigationText, navItem ? "application/xhtml+xml" : "application/xml",
  ) : null;
  if (!navigationDocument) return invalid("invalid-navigation-xml");
  const navigationFormat = navItem ? "epub3-nav" : "epub2-ncx";
  const links = navItem ? parseEpub3Navigation(navigationDocument) : parseEpub2Navigation(navigationDocument);
  if (!links?.length) return invalid("empty-navigation");
  if (links.length > MAX_TOC_ENTRIES) return invalid("navigation-too-large");

  const navigationSha256 = digest(navigationBytes);
  const packageSha256 = digest(packageBytes);
  const entries: HoidEpubProbeEntry[] = [];
  const labelledChapterNumbers = new Map<number, number>();
  let numberedEntryOrdinal = 0;
  for (let index = 0; index < links.length; index += 1) {
    const link = links[index];
    const targetPath = resolveZipPath(navigationItem.path, link.href);
    if (!targetPath) return invalid("navigation-target-not-in-manifest");
    const manifestItem = manifestByPath.get(targetPath);
    if (!manifestItem) return invalid("navigation-target-not-in-manifest");
    const spineOrdinal = spineOrdinalById.get(manifestItem.id);
    if (spineOrdinal === undefined) return invalid("navigation-target-not-in-spine");

    const labelledChapterNumber = parseChapterNumber(link.label);
    if (labelledChapterNumber !== null) {
      numberedEntryOrdinal += 1;
      labelledChapterNumbers.set(labelledChapterNumber, (labelledChapterNumbers.get(labelledChapterNumber) ?? 0) + 1);
    }
    const fragment = link.href.split("#")[1]?.slice(0, 128) ?? "";
    const locatorDigest = digest(strToU8(navigationSha256 + "|" + String(index + 1) + "|" + targetPath + "|" + fragment));
    entries.push(Object.freeze({
      tocOrdinal: index + 1,
      numberedEntryOrdinal: labelledChapterNumber === null ? null : numberedEntryOrdinal,
      labelledChapterNumber,
      kind: labelledChapterNumber === null ? "section" : "numbered-chapter",
      spineOrdinal,
      locatorId: "nav:" + locatorDigest.slice(0, 32),
    }));
  }

  const repeatedNumberedLabelsAcrossEdition = Object.freeze([...labelledChapterNumbers.entries()]
    .filter(([, count]) => count > 1)
    .map(([number]) => number)
    .sort((left, right) => left - right));
  const frozenEntries = Object.freeze(entries);
  const candidateFingerprint = digest(strToU8(JSON.stringify({
    schemaVersion: 1, packageVersion, navigationFormat, packageSha256,
    navigationSha256, manifestItemCount: manifestItems.size,
    spineItemCount: spineRefs.length, entries: frozenEntries,
  })));
  const probe: HoidEpubStructureProbe = Object.freeze({
    schemaVersion: 1,
    kind: "hoid-epub-structure-candidate",
    scope: "metadata-only",
    workSegmentation: "not-inferred",
    packageVersion,
    navigationFormat,
    packageSha256,
    navigationSha256,
    candidateFingerprint,
    manifestItemCount: manifestItems.size,
    spineItemCount: spineRefs.length,
    navigationEntryCount: frozenEntries.length,
    numberedTocEntryCount: numberedEntryOrdinal,
    unnumberedTocEntryCount: frozenEntries.length - numberedEntryOrdinal,
    repeatedNumberedLabelsAcrossEdition,
    entries: frozenEntries,
    sourceContentIncluded: false,
    chapterBodiesInspected: false,
    progressUnlockGranted: false,
    promotionAllowed: false,
    productionWritePerformed: false,
  });
  return Object.freeze({ status: "candidate", probe });
}
