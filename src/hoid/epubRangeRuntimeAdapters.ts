import { inflateSync, strFromU8, strToU8 } from "fflate";
import { HOID_EPUB_INGESTION_LIMITS } from "./epubIngestion";
import type { HoidEpubArchiveEntry, HoidEpubArchivePort, HoidEpubCompressionMethod } from "./epubIngestion";
import {
  createHoidNobleDigestPort,
  createHoidXmldomXmlPort,
} from "./epubRuntimeAdapters";

export const HOID_EPUB_RANGE_RUNTIME_LIMITS = Object.freeze({
  maxArchiveBytes: HOID_EPUB_INGESTION_LIMITS.maxArchiveBytes,
  maxCentralDirectoryBytes: 16 * 1024 * 1024,
  maxArchiveEntries: 50_000,
  maxCompressedMemberBytes: 16 * 1024 * 1024,
  maxUncompressedMemberBytes: 64 * 1024 * 1024,
});

export interface HoidEpubRandomAccessSource {
  readonly size: number;
  readRange(offset: number, length: number): Promise<Uint8Array>;
}

export type HoidEpubRandomAccessSourceResolver = (
  sourceId: string,
) => Promise<HoidEpubRandomAccessSource | null>;

type CentralEntry = Readonly<{
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
  kind: "file" | "directory";
  ordinal: number;
}>;

type ZipIndex = Readonly<{
  size: number;
  centralOffset: number;
  entries: readonly CentralEntry[];
  byPath: ReadonlyMap<string, CentralEntry>;
}>;

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;

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

function decodeName(rawName: Uint8Array, flags: number): string {
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

function validatePath(path: string): void {
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
  if (value.split("/").some(segment => segment.length === 0 || segment === "." || segment === "..")) {
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

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    let value = (crc ^ byte) & 0xff;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value >>> 1) ^ ((value & 1) === 1 ? 0xedb88320 : 0);
    }
    crc = value ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function readExact(
  source: HoidEpubRandomAccessSource,
  offset: number,
  length: number,
): Promise<Uint8Array> {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset + length > source.size
  ) throw new Error("EPUB range is outside the source");
  if (length === 0) return new Uint8Array(0);
  const bytes = await source.readRange(offset, length);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== length) {
    throw new Error("EPUB range read returned an unexpected byte count");
  }
  return bytes;
}

function findEocd(tail: Uint8Array): number {
  const minimum = Math.max(0, tail.byteLength - 22 - 0xffff);
  for (let offset = tail.byteLength - 22; offset >= minimum; offset -= 1) {
    if (readU32(tail, offset) !== EOCD_SIGNATURE) continue;
    const commentLength = readU16(tail, offset + 20);
    if (offset + 22 + commentLength === tail.byteLength) return offset;
  }
  throw new Error("ZIP end-of-central-directory record was not found");
}

async function parseIndex(source: HoidEpubRandomAccessSource): Promise<ZipIndex> {
  if (
    !Number.isSafeInteger(source.size) ||
    source.size < 22 ||
    source.size > HOID_EPUB_RANGE_RUNTIME_LIMITS.maxArchiveBytes
  ) throw new Error("EPUB archive size is invalid");

  const tailLength = Math.min(source.size, 22 + 0xffff);
  const tailOffset = source.size - tailLength;
  const tail = await readExact(source, tailOffset, tailLength);
  const eocdInTail = findEocd(tail);
  const eocdOffset = tailOffset + eocdInTail;

  if (eocdOffset >= 20) {
    const locator = await readExact(source, eocdOffset - 20, 20);
    if (readU32(locator, 0) === ZIP64_LOCATOR_SIGNATURE) {
      throw new Error("ZIP64 archives are not supported");
    }
  }

  const diskNumber = readU16(tail, eocdInTail + 4);
  const centralDisk = readU16(tail, eocdInTail + 6);
  const entriesOnDisk = readU16(tail, eocdInTail + 8);
  const totalEntries = readU16(tail, eocdInTail + 10);
  const centralSize = readU32(tail, eocdInTail + 12);
  const centralOffset = readU32(tail, eocdInTail + 16);

  if (
    diskNumber !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== totalEntries ||
    totalEntries === 0 ||
    totalEntries > HOID_EPUB_RANGE_RUNTIME_LIMITS.maxArchiveEntries ||
    entriesOnDisk === 0xffff ||
    totalEntries === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff ||
    centralSize > HOID_EPUB_RANGE_RUNTIME_LIMITS.maxCentralDirectoryBytes ||
    centralOffset + centralSize !== eocdOffset
  ) throw new Error("ZIP directory layout is unsupported or inconsistent");

  const central = await readExact(source, centralOffset, centralSize);
  const parsed: CentralEntry[] = [];
  const exactPaths = new Set<string>();
  const foldedPaths = new Set<string>();
  const localOffsets = new Set<number>();
  let cursor = 0;
  let totalUncompressed = 0;

  for (let index = 0; index < totalEntries; index += 1) {
    if (cursor + 46 > central.byteLength || readU32(central, cursor) !== CENTRAL_SIGNATURE) {
      throw new Error("ZIP central directory entry is malformed");
    }
    const versionMadeBy = readU16(central, cursor + 4);
    const flags = readU16(central, cursor + 8);
    const method = readU16(central, cursor + 10);
    const checksum = readU32(central, cursor + 16);
    const compressedSize = readU32(central, cursor + 20);
    const uncompressedSize = readU32(central, cursor + 24);
    const nameLength = readU16(central, cursor + 28);
    const extraLength = readU16(central, cursor + 30);
    const commentLength = readU16(central, cursor + 32);
    const diskStart = readU16(central, cursor + 34);
    const externalAttributes = readU32(central, cursor + 38);
    const localOffset = readU32(central, cursor + 42);
    const recordLength = 46 + nameLength + extraLength + commentLength;

    if (
      nameLength === 0 ||
      nameLength > 2048 ||
      cursor + recordLength > central.byteLength ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localOffset === 0xffffffff ||
      diskStart === 0xffff ||
      diskStart !== 0 ||
      localOffset >= centralOffset ||
      (flags & (0x0001 | 0x0040 | 0x2000)) !== 0 ||
      (method !== 0 && method !== 8)
    ) throw new Error("ZIP64, encrypted, or unsupported ZIP entry");

    const rawName = central.slice(cursor + 46, cursor + 46 + nameLength);
    validateExtraFields(central, cursor + 46 + nameLength, extraLength);
    const path = decodeName(rawName, flags);
    validatePath(path);

    const folded = path.toLowerCase();
    if (exactPaths.has(path) || foldedPaths.has(folded) || localOffsets.has(localOffset)) {
      throw new Error("ZIP entry paths or local offsets collide");
    }
    exactPaths.add(path);
    foldedPaths.add(folded);
    localOffsets.add(localOffset);

    const hostSystem = versionMadeBy >>> 8;
    const unixType = hostSystem === 3 || hostSystem === 19
      ? (externalAttributes >>> 16) & 0xf000
      : 0;
    if (unixType === 0xa000) throw new Error("ZIP symbolic links are not supported");
    const directory = path.endsWith("/") || unixType === 0x4000 || (externalAttributes & 0x10) !== 0;

    totalUncompressed += uncompressedSize;
    if (
      !Number.isSafeInteger(totalUncompressed) ||
      totalUncompressed > 512 * 1024 * 1024 ||
      uncompressedSize > HOID_EPUB_RANGE_RUNTIME_LIMITS.maxUncompressedMemberBytes ||
      compressedSize > HOID_EPUB_RANGE_RUNTIME_LIMITS.maxCompressedMemberBytes ||
      (uncompressedSize > 0 && compressedSize === 0) ||
      (compressedSize > 0 && uncompressedSize / compressedSize > 200)
    ) throw new Error("ZIP member exceeds a resource or compression-ratio limit");

    parsed.push(Object.freeze({
      path,
      rawName,
      flags,
      method,
      crc: checksum,
      compressedSize,
      uncompressedSize,
      localOffset,
      hostSystem,
      externalAttributes,
      kind: directory ? "directory" : "file",
      ordinal: -1,
    }));
    cursor += recordLength;
  }

  if (cursor !== central.byteLength) throw new Error("ZIP central directory length is inconsistent");
  parsed.sort((left, right) => left.localOffset - right.localOffset);
  const ordered = parsed.map((entry, ordinal) => Object.freeze({ ...entry, ordinal }));
  const byPath = new Map(ordered.map(entry => [entry.path, entry]));
  return Object.freeze({
    size: source.size,
    centralOffset,
    entries: Object.freeze(ordered),
    byPath,
  });
}

async function inspectLocalRecord(
  source: HoidEpubRandomAccessSource,
  index: ZipIndex,
  entry: CentralEntry,
): Promise<Readonly<{ dataOffset: number; extraLength: number }>> {
  const nextOffset = index.entries[entry.ordinal + 1]?.localOffset ?? index.centralOffset;
  const fixed = await readExact(source, entry.localOffset, 30);
  if (readU32(fixed, 0) !== LOCAL_SIGNATURE) throw new Error("ZIP local file header is malformed");

  const flags = readU16(fixed, 6);
  const method = readU16(fixed, 8);
  const localCrc = readU32(fixed, 14);
  const localCompressedSize = readU32(fixed, 18);
  const localUncompressedSize = readU32(fixed, 22);
  const nameLength = readU16(fixed, 26);
  const extraLength = readU16(fixed, 28);
  if (nameLength !== entry.rawName.byteLength || nameLength > 2048) {
    throw new Error("ZIP local and central filename lengths disagree");
  }

  const variable = await readExact(source, entry.localOffset + 30, nameLength + extraLength);
  const localName = variable.subarray(0, nameLength);
  if (!equalBytes(localName, entry.rawName)) throw new Error("ZIP local and central filenames disagree");
  validateExtraFields(variable, nameLength, extraLength);

  if (flags !== entry.flags || method !== entry.method) {
    throw new Error("ZIP local and central flags or compression methods disagree");
  }

  const usesDescriptor = (flags & 0x0008) !== 0;
  if (usesDescriptor) {
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

  const dataOffset = entry.localOffset + 30 + nameLength + extraLength;
  const dataEnd = dataOffset + entry.compressedSize;
  if (!Number.isSafeInteger(dataEnd) || dataEnd > nextOffset) {
    throw new Error("ZIP member data overlaps the next local record");
  }

  let recordEnd = dataEnd;
  if (usesDescriptor) {
    const available = nextOffset - dataEnd;
    if (available < 12) throw new Error("ZIP data descriptor is truncated");
    const descriptor = await readExact(source, dataEnd, Math.min(16, available));
    const descriptorStart = readU32(descriptor, 0) === DATA_DESCRIPTOR_SIGNATURE ? 4 : 0;
    if (descriptorStart + 12 > descriptor.byteLength) throw new Error("ZIP data descriptor is truncated");
    if (
      readU32(descriptor, descriptorStart) !== entry.crc ||
      readU32(descriptor, descriptorStart + 4) !== entry.compressedSize ||
      readU32(descriptor, descriptorStart + 8) !== entry.uncompressedSize
    ) throw new Error("ZIP data descriptor disagrees with the central directory");
    recordEnd += descriptorStart + 12;
  }
  if (recordEnd > nextOffset) throw new Error("ZIP local records overlap");
  return Object.freeze({ dataOffset, extraLength });
}

export function createHoidFflateRangeArchivePort(
  resolveSource: HoidEpubRandomAccessSourceResolver,
): HoidEpubArchivePort {
  const indexes = new Map<string, ZipIndex>();

  async function load(sourceId: string): Promise<Readonly<{
    source: HoidEpubRandomAccessSource;
    index: ZipIndex;
  }>> {
    if (typeof sourceId !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(sourceId)) {
      throw new Error("EPUB source identifier is invalid");
    }
    const source = await resolveSource(sourceId);
    if (source === null) throw new Error("EPUB source is unavailable");
    const index = await parseIndex(source);
    return Object.freeze({ source, index });
  }

  return Object.freeze({
    async listEntries(sourceId: string): Promise<readonly HoidEpubArchiveEntry[]> {
      const loaded = await load(sourceId);
      indexes.set(sourceId, loaded.index);
      const firstFile = loaded.index.entries.find(entry => entry.kind === "file");
      if (firstFile === undefined || firstFile.path !== "mimetype" || firstFile.method !== 0 ||
        firstFile.compressedSize !== 20 || firstFile.uncompressedSize !== 20) {
        throw new Error("EPUB mimetype entry is not the first stored file");
      }
      const mimetypeLocal = await inspectLocalRecord(loaded.source, loaded.index, firstFile);
      if (mimetypeLocal.extraLength !== 0) throw new Error("EPUB mimetype local header has an extra field");

      return Object.freeze(loaded.index.entries.map(entry => Object.freeze({
        path: entry.path,
        ordinal: entry.ordinal,
        localHeaderExtraFieldLength: entry.path === "mimetype" ? mimetypeLocal.extraLength : null,
        kind: entry.kind,
        compressionMethod: (entry.method === 0 ? "stored" : "deflated") as HoidEpubCompressionMethod,
        compressedSize: entry.compressedSize,
        uncompressedSize: entry.uncompressedSize,
        encrypted: false,
      })));
    },

    async readEntry(sourceId: string, canonicalPath: string, maximumBytes: number): Promise<Uint8Array | null> {
      if (
        typeof canonicalPath !== "string" ||
        canonicalPath.length === 0 ||
        !Number.isSafeInteger(maximumBytes) ||
        maximumBytes < 0 ||
        maximumBytes > HOID_EPUB_RANGE_RUNTIME_LIMITS.maxUncompressedMemberBytes
      ) throw new Error("EPUB member read request is invalid");

      let index = indexes.get(sourceId);
      let source: HoidEpubRandomAccessSource;
      if (index === undefined) {
        const loaded = await load(sourceId);
        source = loaded.source;
        index = loaded.index;
        indexes.set(sourceId, index);
      } else {
        const resolved = await resolveSource(sourceId);
        if (resolved === null || resolved.size !== index.size) throw new Error("EPUB source changed or is unavailable");
        source = resolved;
      }

      const entry = index.byPath.get(canonicalPath);
      if (entry === undefined || entry.kind !== "file") return null;
      if (
        entry.uncompressedSize > maximumBytes ||
        entry.compressedSize > HOID_EPUB_RANGE_RUNTIME_LIMITS.maxCompressedMemberBytes
      ) throw new Error("EPUB member exceeds the requested read limit");

      const local = await inspectLocalRecord(source, index, entry);
      const compressed = await readExact(source, local.dataOffset, entry.compressedSize);
      let output: Uint8Array;
      if (entry.method === 0) {
        if (compressed.byteLength !== entry.uncompressedSize) {
          throw new Error("Stored ZIP member has inconsistent sizes");
        }
        output = compressed;
      } else if (entry.method === 8) {
        if (compressed.byteLength === 0) throw new Error("DEFLATE member is empty");
        const target = new Uint8Array(entry.uncompressedSize + 1);
        try {
          output = inflateSync(compressed, { out: target });
        } catch {
          throw new Error("DEFLATE member could not be decompressed within its declared size");
        }
      } else {
        throw new Error("ZIP compression method is unsupported");
      }

      if (output.byteLength !== entry.uncompressedSize || crc32(output) !== entry.crc) {
        throw new Error("ZIP member integrity check failed");
      }
      return output;
    },
  });
}

export function createHoidEpubRangeRuntimePorts(
  resolveSource: HoidEpubRandomAccessSourceResolver,
): Readonly<{
  archive: HoidEpubArchivePort;
  xml: ReturnType<typeof createHoidXmldomXmlPort>;
  digest: ReturnType<typeof createHoidNobleDigestPort>;
}> {
  return Object.freeze({
    archive: createHoidFflateRangeArchivePort(resolveSource),
    xml: createHoidXmldomXmlPort(),
    digest: createHoidNobleDigestPort(),
  });
}
