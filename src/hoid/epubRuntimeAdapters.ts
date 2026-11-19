import { sha256 } from "@noble/hashes/sha256";
import { inflateSync, strFromU8, strToU8 } from "fflate";
import { SaxesParser, type SaxesTagNS } from "saxes";
import type {
  HoidEpubArchiveEntry,
  HoidEpubArchivePort,
  HoidEpubContainerDocument,
  HoidEpubDigestPort,
  HoidEpubManifestItem,
  HoidEpubNavigationFormat,
  HoidEpubNavigationNode,
  HoidEpubPackageDocument,
  HoidEpubSpineItem,
  HoidEpubXmlPort,
} from "./epubIngestion";

export const HOID_EPUB_RUNTIME_LIMITS = Object.freeze({
  maxArchiveBytes: 256 * 1024 * 1024,
  maxCentralDirectoryBytes: 16 * 1024 * 1024,
  maxArchiveEntries: 50_000,
  maxReadEntryBytes: 64 * 1024 * 1024,
  maxXmlBytes: 12 * 1024 * 1024,
  maxXmlNodes: 100_000,
  maxXmlDepth: 256,
});

export type HoidEpubByteSourceResolver = (
  sourceId: string,
) => Uint8Array | null | Promise<Uint8Array | null>;

const ZIP_LOCAL_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP_DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const MIME_TYPE = "application/epub+zip";
const CONTAINER_NS = "urn:oasis:names:tc:opendocument:xmlns:container";
const OPF_NS = "http://www.idpf.org/2007/opf";
const DC_NS = "http://purl.org/dc/elements/1.1/";
const XHTML_NS = "http://www.w3.org/1999/xhtml";
const OPS_NS = "http://www.idpf.org/2007/ops";
const NCX_NS = "http://www.daisy.org/z3986/2005/ncx/";

type ParsedZipEntry = Readonly<{
  publicEntry: HoidEpubArchiveEntry;
  localHeaderOffset: number;
  dataOffset: number;
  recordEnd: number;
  crc32: number;
  compressionCode: number;
}>;

type ParsedZipArchive = Readonly<{
  entries: readonly ParsedZipEntry[];
  byPath: ReadonlyMap<string, ParsedZipEntry>;
}>;

function readU16(bytes: Uint8Array, offset: number): number {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + 2 > bytes.byteLength) {
    throw new Error("ZIP structure is truncated");
  }
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true);
}

function readU32(bytes: Uint8Array, offset: number): number {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset + 4 > bytes.byteLength) {
    throw new Error("ZIP structure is truncated");
  }
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function decodeZipName(rawName: Uint8Array, flags: number): string {
  if ((flags & 0x0800) !== 0) {
    const decoded = strFromU8(rawName);
    if (!equalBytes(strToU8(decoded), rawName)) throw new Error("ZIP filename is not valid UTF-8");
    return decoded;
  }

  let decoded = "";
  for (const byte of rawName) {
    if (byte > 0x7f) throw new Error("Legacy non-ASCII ZIP filename encoding is unsupported");
    decoded += String.fromCharCode(byte);
  }
  return decoded;
}

function validateArchivePath(path: string): void {
  const directory = path.endsWith("/");
  const value = directory ? path.slice(0, -1) : path;
  if (
    value.length === 0 ||
    value.length > 2048 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    /^[A-Za-z]:/.test(value) ||
    /%2f|%5c/i.test(value) ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    value !== value.normalize("NFC")
  ) throw new Error("Unsafe ZIP entry path");

  const segments = value.split("/");
  if (segments.some(segment => segment.length === 0 || segment === "." || segment === "..")) {
    throw new Error("Unsafe ZIP entry path");
  }
}

function validateExtraFields(bytes: Uint8Array, start: number, length: number): void {
  const end = start + length;
  if (!Number.isSafeInteger(end) || start < 0 || end > bytes.byteLength) {
    throw new Error("ZIP extra field is truncated");
  }
  let cursor = start;
  while (cursor < end) {
    if (cursor + 4 > end) throw new Error("ZIP extra field header is truncated");
    const tag = readU16(bytes, cursor);
    const size = readU16(bytes, cursor + 2);
    cursor += 4;
    if (cursor + size > end) throw new Error("ZIP extra field payload is truncated");
    if (tag === 0x0001) throw new Error("ZIP64 archives are not supported");
    cursor += size;
  }
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const minimum = Math.max(0, bytes.byteLength - 22 - 0xffff);
  for (let offset = bytes.byteLength - 22; offset >= minimum; offset -= 1) {
    if (readU32(bytes, offset) !== ZIP_EOCD_SIGNATURE) continue;
    const commentLength = readU16(bytes, offset + 20);
    if (offset + 22 + commentLength === bytes.byteLength) return offset;
  }
  throw new Error("ZIP end-of-central-directory record was not found");
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ ((value & 1) === 1 ? 0xedb88320 : 0);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function parseZipArchive(bytes: Uint8Array): ParsedZipArchive {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength < 22 ||
    bytes.byteLength > HOID_EPUB_RUNTIME_LIMITS.maxArchiveBytes
  ) throw new Error("EPUB archive size is invalid");

  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset >= 20 && readU32(bytes, eocdOffset - 20) === ZIP64_LOCATOR_SIGNATURE) {
    throw new Error("ZIP64 archives are not supported");
  }

  const diskNumber = readU16(bytes, eocdOffset + 4);
  const centralDisk = readU16(bytes, eocdOffset + 6);
  const entriesOnDisk = readU16(bytes, eocdOffset + 8);
  const totalEntries = readU16(bytes, eocdOffset + 10);
  const centralSize = readU32(bytes, eocdOffset + 12);
  const centralOffset = readU32(bytes, eocdOffset + 16);

  if (
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== totalEntries ||
    totalEntries === 0 ||
    totalEntries > HOID_EPUB_RUNTIME_LIMITS.maxArchiveEntries ||
    entriesOnDisk === 0xffff ||
    totalEntries === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff ||
    centralSize > HOID_EPUB_RUNTIME_LIMITS.maxCentralDirectoryBytes ||
    centralOffset + centralSize !== eocdOffset
  ) throw new Error("ZIP directory layout is unsupported or inconsistent");

  const centralEnd = centralOffset + centralSize;
  const centralEntries: Array<{
    path: string;
    rawName: Uint8Array;
    flags: number;
    method: number;
    crc: number;
    compressedSize: number;
    uncompressedSize: number;
    localOffset: number;
    hostSystem: number;
    externalAttributes: number;
  }> = [];

  let cursor = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > centralEnd || readU32(bytes, cursor) !== ZIP_CENTRAL_SIGNATURE) {
      throw new Error("ZIP central directory entry is malformed");
    }

    const versionMadeBy = readU16(bytes, cursor + 4);
    const flags = readU16(bytes, cursor + 8);
    const method = readU16(bytes, cursor + 10);
    const checksum = readU32(bytes, cursor + 16);
    const compressedSize = readU32(bytes, cursor + 20);
    const uncompressedSize = readU32(bytes, cursor + 24);
    const nameLength = readU16(bytes, cursor + 28);
    const extraLength = readU16(bytes, cursor + 30);
    const commentLength = readU16(bytes, cursor + 32);
    const diskStart = readU16(bytes, cursor + 34);
    const externalAttributes = readU32(bytes, cursor + 38);
    const localOffset = readU32(bytes, cursor + 42);
    const recordLength = 46 + nameLength + extraLength + commentLength;

    if (
      nameLength === 0 ||
      cursor + recordLength > centralEnd ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localOffset === 0xffffffff ||
      diskStart === 0xffff ||
      diskStart !== 0
    ) throw new Error("ZIP64 or multi-disk entry is unsupported");

    const rawName = bytes.slice(cursor + 46, cursor + 46 + nameLength);
    const extraStart = cursor + 46 + nameLength;
    validateExtraFields(bytes, extraStart, extraLength);
    const path = decodeZipName(rawName, flags);
    validateArchivePath(path);

    centralEntries.push({
      path,
      rawName,
      flags,
      method,
      crc: checksum,
      compressedSize,
      uncompressedSize,
      localOffset,
      hostSystem: versionMadeBy >>> 8,
      externalAttributes,
    });
    cursor += recordLength;
  }

  if (cursor !== centralEnd || centralEntries.length !== totalEntries) {
    throw new Error("ZIP central directory length is inconsistent");
  }

  const exactPaths = new Set<string>();
  const foldedPaths = new Set<string>();
  const parsed: ParsedZipEntry[] = [];

  for (const entry of centralEntries) {
    const folded = entry.path.toLowerCase();
    if (exactPaths.has(entry.path) || foldedPaths.has(folded)) {
      throw new Error("ZIP entry paths collide");
    }
    exactPaths.add(entry.path);
    foldedPaths.add(folded);

    const local = entry.localOffset;
    if (local + 30 > centralOffset || readU32(bytes, local) !== ZIP_LOCAL_SIGNATURE) {
      throw new Error("ZIP local file header is malformed");
    }

    const localFlags = readU16(bytes, local + 6);
    const localMethod = readU16(bytes, local + 8);
    const localCrc = readU32(bytes, local + 14);
    const localCompressedSize = readU32(bytes, local + 18);
    const localUncompressedSize = readU32(bytes, local + 22);
    const localNameLength = readU16(bytes, local + 26);
    const localExtraLength = readU16(bytes, local + 28);
    const localNameStart = local + 30;
    const localExtraStart = localNameStart + localNameLength;
    const dataOffset = localExtraStart + localExtraLength;

    if (
      localFlags !== entry.flags ||
      localMethod !== entry.method ||
      localNameLength !== entry.rawName.byteLength ||
      dataOffset > centralOffset ||
      !equalBytes(bytes.subarray(localNameStart, localExtraStart), entry.rawName)
    ) throw new Error("ZIP local and central headers disagree");

    validateExtraFields(bytes, localExtraStart, localExtraLength);

    const usesDataDescriptor = (entry.flags & 0x0008) !== 0;
    if (usesDataDescriptor) {
      if (
        (localCrc !== 0 && localCrc !== entry.crc) ||
        (localCompressedSize !== 0 && localCompressedSize !== entry.compressedSize) ||
        (localUncompressedSize !== 0 && localUncompressedSize !== entry.uncompressedSize)
      ) throw new Error("ZIP data descriptor header is inconsistent");
    } else if (
      localCrc !== entry.crc ||
      localCompressedSize !== entry.compressedSize ||
      localUncompressedSize !== entry.uncompressedSize
    ) throw new Error("ZIP local sizes disagree with the central directory");

    const dataEnd = dataOffset + entry.compressedSize;
    if (!Number.isSafeInteger(dataEnd) || dataEnd > centralOffset) {
      throw new Error("ZIP member data exceeds the archive boundary");
    }

    let recordEnd = dataEnd;
    if (usesDataDescriptor) {
      const candidates = [dataEnd];
      if (
        dataEnd + 4 <= centralOffset &&
        readU32(bytes, dataEnd) === ZIP_DATA_DESCRIPTOR_SIGNATURE
      ) candidates.unshift(dataEnd + 4);
      const descriptorOffset = candidates.find(offset =>
        offset + 12 <= centralOffset &&
        readU32(bytes, offset) === entry.crc &&
        readU32(bytes, offset + 4) === entry.compressedSize &&
        readU32(bytes, offset + 8) === entry.uncompressedSize,
      );
      if (descriptorOffset === undefined) {
        throw new Error("ZIP data descriptor disagrees with the central directory");
      }
      recordEnd = descriptorOffset + 12;
    }

    const unixType = entry.hostSystem === 3 || entry.hostSystem === 19
      ? (entry.externalAttributes >>> 16) & 0xf000
      : 0;
    const symlink = unixType === 0xa000;
    const directory = !symlink && (
      entry.path.endsWith("/") ||
      unixType === 0x4000 ||
      (entry.externalAttributes & 0x10) !== 0
    );
    const kind = symlink ? "symlink" : directory ? "directory" : "file";
    const compressionMethod = entry.method === 0
      ? "stored"
      : entry.method === 8
        ? "deflated"
        : "unsupported";
    const encrypted = (entry.flags & (0x0001 | 0x0040 | 0x2000)) !== 0;

    parsed.push({
      publicEntry: Object.freeze({
        path: entry.path,
        ordinal: -1,
        localHeaderExtraFieldLength: localExtraLength,
        kind,
        compressionMethod,
        compressedSize: entry.compressedSize,
        uncompressedSize: entry.uncompressedSize,
        encrypted,
      }),
      localHeaderOffset: local,
      dataOffset,
      recordEnd,
      crc32: entry.crc,
      compressionCode: entry.method,
    });
  }

  parsed.sort((left, right) => left.localHeaderOffset - right.localHeaderOffset);
  for (let index = 0; index < parsed.length; index += 1) {
    const current = parsed[index];
    const next = parsed[index + 1];
    if (
      next !== undefined &&
      (current.localHeaderOffset >= next.localHeaderOffset || current.recordEnd > next.localHeaderOffset)
    ) throw new Error("ZIP local records overlap");
    if (current.recordEnd > centralOffset) throw new Error("ZIP local record overlaps the central directory");
  }

  const entries = parsed.map((entry, ordinal) => Object.freeze({
    ...entry,
    publicEntry: Object.freeze({ ...entry.publicEntry, ordinal }),
  }));
  const byPath = new Map(entries.map(entry => [entry.publicEntry.path, entry]));
  return Object.freeze({ entries: Object.freeze(entries), byPath });
}

export function createHoidFflateArchivePort(
  resolveSourceBytes: HoidEpubByteSourceResolver,
): HoidEpubArchivePort {
  async function load(sourceId: string): Promise<Readonly<{ bytes: Uint8Array; index: ParsedZipArchive }>> {
    if (typeof sourceId !== "string" || sourceId.length === 0 || sourceId.length > 128) {
      throw new Error("EPUB source identifier is invalid");
    }
    const bytes = await resolveSourceBytes(sourceId);
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.byteLength === 0 ||
      bytes.byteLength > HOID_EPUB_RUNTIME_LIMITS.maxArchiveBytes
    ) throw new Error("EPUB source bytes are unavailable or exceed the archive limit");
    return Object.freeze({ bytes, index: parseZipArchive(bytes) });
  }

  return Object.freeze({
    async listEntries(sourceId: string): Promise<readonly HoidEpubArchiveEntry[]> {
      const loaded = await load(sourceId);
      return Object.freeze(loaded.index.entries.map(entry => entry.publicEntry));
    },

    async readEntry(sourceId: string, canonicalPath: string, maximumBytes: number): Promise<Uint8Array | null> {
      if (
        typeof canonicalPath !== "string" ||
        canonicalPath.length === 0 ||
        !Number.isSafeInteger(maximumBytes) ||
        maximumBytes < 0 ||
        maximumBytes > HOID_EPUB_RUNTIME_LIMITS.maxReadEntryBytes
      ) throw new Error("EPUB member read request is invalid");

      const loaded = await load(sourceId);
      const entry = loaded.index.byPath.get(canonicalPath);
      if (entry === undefined || entry.publicEntry.kind !== "file") return null;
      if (entry.publicEntry.encrypted) throw new Error("Encrypted ZIP members are not supported");
      if (entry.publicEntry.compressionMethod === "unsupported") throw new Error("ZIP compression method is unsupported");
      if (entry.publicEntry.uncompressedSize > maximumBytes) throw new Error("ZIP member exceeds the requested read limit");

      const compressed = loaded.bytes.subarray(
        entry.dataOffset,
        entry.dataOffset + entry.publicEntry.compressedSize,
      );
      let output: Uint8Array;

      if (entry.compressionCode === 0) {
        if (compressed.byteLength !== entry.publicEntry.uncompressedSize) {
          throw new Error("Stored ZIP member has inconsistent sizes");
        }
        output = compressed.slice();
      } else if (entry.compressionCode === 8) {
        try {
          const target = new Uint8Array(entry.publicEntry.uncompressedSize);
          output = entry.publicEntry.uncompressedSize === 0
            ? inflateSync(compressed)
            : inflateSync(compressed, { out: target });
        } catch {
          throw new Error("DEFLATE member could not be decompressed");
        }
      } else {
        throw new Error("ZIP compression method is unsupported");
      }

      if (
        output.byteLength !== entry.publicEntry.uncompressedSize ||
        crc32(output) !== entry.crc32
      ) throw new Error("ZIP member integrity check failed");

      return output;
    },
  });
}

type XmlAttribute = Readonly<{
  name: string;
  local: string;
  uri: string;
  value: string;
}>;

type XmlElement = {
  local: string;
  uri: string;
  attributes: XmlAttribute[];
  children: XmlElement[];
  content: Array<string | XmlElement>;
};

function decodeXml(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > HOID_EPUB_RUNTIME_LIMITS.maxXmlBytes) {
    throw new Error("XML document size is invalid");
  }
  const xml = strFromU8(bytes);
  if (!equalBytes(strToU8(xml), bytes)) throw new Error("XML document is not valid UTF-8");
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error("DTD and entity declarations are forbidden");
  if (xml.includes("\u0000")) throw new Error("XML document contains a forbidden character");
  return xml;
}

function parseXmlTree(bytes: Uint8Array): XmlElement {
  const xml = decodeXml(bytes);
  const parser = new SaxesParser({ xmlns: true, position: false });
  const stack: XmlElement[] = [];
  let root: XmlElement | null = null;
  let nodeCount = 0;
  let parseError: Error | null = null;
  let doctypeSeen = false;

  parser.on("error", error => { parseError = error; });
  parser.on("doctype", () => { doctypeSeen = true; });
  parser.on("opentag", (tag: SaxesTagNS) => {
    nodeCount += 1;
    if (nodeCount > HOID_EPUB_RUNTIME_LIMITS.maxXmlNodes || stack.length >= HOID_EPUB_RUNTIME_LIMITS.maxXmlDepth) {
      throw new Error("XML structural limit exceeded");
    }
    const node: XmlElement = {
      local: tag.local,
      uri: tag.uri,
      attributes: Object.freeze(Object.values(tag.attributes).map(attribute => Object.freeze({
        name: attribute.name,
        local: attribute.local,
        uri: attribute.uri,
        value: attribute.value,
      }))) as unknown as XmlAttribute[],
      children: [],
      content: [],
    };
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node);
      stack[stack.length - 1].content.push(node);
    } else if (root === null) {
      root = node;
    } else {
      throw new Error("XML document has multiple roots");
    }
    stack.push(node);
  });
  parser.on("text", text => {
    if (stack.length > 0) stack[stack.length - 1].content.push(text);
    else if (text.trim().length > 0) parseError = new Error("Text appears outside the XML root");
  });
  parser.on("cdata", text => {
    if (stack.length > 0) stack[stack.length - 1].content.push(text);
    else if (text.trim().length > 0) parseError = new Error("CDATA appears outside the XML root");
  });
  parser.on("closetag", () => {
    if (stack.length === 0) {
      parseError = new Error("XML closing tag is unmatched");
      return;
    }
    stack.pop();
  });

  try {
    parser.write(xml).close();
  } catch {
    throw new Error("XML document is malformed or exceeds structural limits");
  }

  if (parseError !== null || doctypeSeen || root === null || stack.length !== 0) {
    throw new Error("XML document is malformed or uses a forbidden DTD");
  }
  return root;
}

function directChildren(node: XmlElement, local: string, uri: string): readonly XmlElement[] {
  return node.children.filter(child => child.local === local && child.uri === uri);
}

function firstChild(node: XmlElement, local: string, uri: string): XmlElement | null {
  return directChildren(node, local, uri)[0] ?? null;
}

function descendants(node: XmlElement, local: string, uri: string): XmlElement[] {
  const found: XmlElement[] = [];
  const visit = (current: XmlElement): void => {
    for (const child of current.children) {
      if (child.local === local && child.uri === uri) found.push(child);
      visit(child);
    }
  };
  visit(node);
  return found;
}

function attribute(node: XmlElement, local: string, uri = ""): string | null {
  return node.attributes.find(value => value.local === local && value.uri === uri)?.value ?? null;
}

function textContent(node: XmlElement): string {
  return node.content.map(part => typeof part === "string" ? part : textContent(part)).join("");
}

function normalizedLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseEpub3Navigation(root: XmlElement): readonly HoidEpubNavigationNode[] {
  if (root.local !== "html" || root.uri !== XHTML_NS) throw new Error("EPUB 3 navigation root is invalid");
  const toc = descendants(root, "nav", XHTML_NS).find(node => {
    const type = attribute(node, "type", OPS_NS);
    return type !== null && type.split(/\s+/).includes("toc");
  });
  if (toc === undefined) throw new Error("EPUB 3 table of contents is missing");

  let count = 0;
  const parseList = (list: XmlElement, depth: number): HoidEpubNavigationNode[] => {
    if (depth > 24) throw new Error("EPUB navigation depth exceeded");
    const result: HoidEpubNavigationNode[] = [];
    for (const item of directChildren(list, "li", XHTML_NS)) {
      const link = firstChild(item, "a", XHTML_NS);
      const labelNode = link ?? firstChild(item, "span", XHTML_NS);
      const nestedList = firstChild(item, "ol", XHTML_NS);
      const children = nestedList === null ? [] : parseList(nestedList, depth + 1);
      const href = link === null ? null : attribute(link, "href");
      const label = labelNode === null ? "" : normalizedLabel(textContent(labelNode));

      if (href !== null && href.length > 0 && label.length > 0) {
        count += 1;
        if (count > 50_000) throw new Error("EPUB navigation node limit exceeded");
        result.push(Object.freeze({ label, href, children: Object.freeze(children) }));
      } else if (children.length > 0) {
        result.push(...children);
      }
    }
    return result;
  };

  const orderedList = firstChild(toc, "ol", XHTML_NS);
  if (orderedList === null) throw new Error("EPUB 3 navigation list is missing");
  const result = parseList(orderedList, 0);
  if (result.length === 0) throw new Error("EPUB 3 navigation contains no usable entries");
  return Object.freeze(result);
}

function parseEpub2Navigation(root: XmlElement): readonly HoidEpubNavigationNode[] {
  if (root.local !== "ncx" || root.uri !== NCX_NS) throw new Error("EPUB 2 NCX root is invalid");
  const navMap = firstChild(root, "navMap", NCX_NS);
  if (navMap === null) throw new Error("EPUB 2 navigation map is missing");

  let count = 0;
  const parsePoints = (parent: XmlElement, depth: number): HoidEpubNavigationNode[] => {
    if (depth > 24) throw new Error("EPUB navigation depth exceeded");
    const result: HoidEpubNavigationNode[] = [];
    for (const point of directChildren(parent, "navPoint", NCX_NS)) {
      const label = descendants(point, "text", NCX_NS)[0];
      const content = firstChild(point, "content", NCX_NS);
      const href = content === null ? null : attribute(content, "src");
      const labelValue = label === undefined ? "" : normalizedLabel(textContent(label));
      if (href === null || href.length === 0 || labelValue.length === 0) {
        throw new Error("EPUB 2 navigation point is incomplete");
      }
      count += 1;
      if (count > 50_000) throw new Error("EPUB navigation node limit exceeded");
      const children = parsePoints(point, depth + 1);
      result.push(Object.freeze({ label: labelValue, href, children: Object.freeze(children) }));
    }
    return result;
  };

  const result = parsePoints(navMap, 0);
  if (result.length === 0) throw new Error("EPUB 2 navigation contains no entries");
  return Object.freeze(result);
}

export function createHoidSaxesXmlPort(): HoidEpubXmlPort {
  return Object.freeze({
    async parseContainerXml(bytes: Uint8Array): Promise<HoidEpubContainerDocument> {
      const root = parseXmlTree(bytes);
      if (root.local !== "container" || root.uri !== CONTAINER_NS) {
        throw new Error("EPUB container document has an invalid root");
      }
      const rootfilesElement = firstChild(root, "rootfiles", CONTAINER_NS);
      if (rootfilesElement === null) throw new Error("EPUB rootfiles are missing");
      const rootfiles = directChildren(rootfilesElement, "rootfile", CONTAINER_NS).map(item => Object.freeze({
        fullPath: attribute(item, "full-path") ?? "",
        mediaType: attribute(item, "media-type") ?? "",
      }));
      return Object.freeze({ rootfiles: Object.freeze(rootfiles) });
    },

    async parsePackageDocument(bytes: Uint8Array): Promise<HoidEpubPackageDocument> {
      const root = parseXmlTree(bytes);
      if (root.local !== "package" || root.uri !== OPF_NS) {
        throw new Error("EPUB package document has an invalid root");
      }
      const metadata = firstChild(root, "metadata", OPF_NS);
      const manifest = firstChild(root, "manifest", OPF_NS);
      const spineElement = firstChild(root, "spine", OPF_NS);
      if (metadata === null || manifest === null || spineElement === null) {
        throw new Error("EPUB package document is incomplete");
      }

      const titleNode = descendants(metadata, "title", DC_NS)[0];
      const languageNode = descendants(metadata, "language", DC_NS)[0];
      const identifiers = descendants(metadata, "identifier", DC_NS).map(item => Object.freeze({
        id: attribute(item, "id") ?? "",
        value: normalizedLabel(textContent(item)),
      }));
      const manifestItems: HoidEpubManifestItem[] = directChildren(manifest, "item", OPF_NS).map(item => {
        const properties = (attribute(item, "properties") ?? "").split(/\s+/).filter(Boolean);
        return Object.freeze({
          id: attribute(item, "id") ?? "",
          href: attribute(item, "href") ?? "",
          mediaType: attribute(item, "media-type") ?? "",
          properties: Object.freeze(properties),
        });
      });
      const spine: HoidEpubSpineItem[] = directChildren(spineElement, "itemref", OPF_NS).map(item => Object.freeze({
        idref: attribute(item, "idref") ?? "",
        linear: attribute(item, "linear") !== "no",
      }));

      return Object.freeze({
        version: attribute(root, "version") ?? "",
        uniqueIdentifierId: attribute(root, "unique-identifier") ?? "",
        metadata: Object.freeze({
          title: titleNode === undefined ? "" : normalizedLabel(textContent(titleNode)),
          language: languageNode === undefined ? "" : normalizedLabel(textContent(languageNode)),
          identifiers: Object.freeze(identifiers),
        }),
        manifestItems: Object.freeze(manifestItems),
        spine: Object.freeze(spine),
        spineTocId: attribute(spineElement, "toc"),
      });
    },

    async parseNavigationDocument(
      bytes: Uint8Array,
      format: HoidEpubNavigationFormat,
    ): Promise<readonly HoidEpubNavigationNode[]> {
      const root = parseXmlTree(bytes);
      return format === "epub3-nav"
        ? parseEpub3Navigation(root)
        : parseEpub2Navigation(root);
    },

    async validateXhtml(bytes: Uint8Array): Promise<boolean> {
      try {
        const root = parseXmlTree(bytes);
        return root.local === "html" && root.uri === XHTML_NS;
      } catch {
        return false;
      }
    },
  });
}

function toHex(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) result += byte.toString(16).padStart(2, "0");
  return result;
}

export function createHoidNobleDigestPort(): HoidEpubDigestPort {
  return Object.freeze({
    async sha256(bytes: Uint8Array): Promise<string> {
      if (!(bytes instanceof Uint8Array)) throw new Error("Digest input must be a byte array");
      return toHex(sha256(bytes));
    },
    async sha256Utf8(value: string): Promise<string> {
      if (typeof value !== "string") throw new Error("Digest input must be a string");
      return toHex(sha256(strToU8(value)));
    },
  });
}

export function createHoidEpubRuntimePorts(resolveSourceBytes: HoidEpubByteSourceResolver): Readonly<{
  archive: HoidEpubArchivePort;
  xml: HoidEpubXmlPort;
  digest: HoidEpubDigestPort;
}> {
  return Object.freeze({
    archive: createHoidFflateArchivePort(resolveSourceBytes),
    xml: createHoidSaxesXmlPort(),
    digest: createHoidNobleDigestPort(),
  });
}
