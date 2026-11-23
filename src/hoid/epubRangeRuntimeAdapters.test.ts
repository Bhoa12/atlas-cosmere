import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  createHoidFflateRangeArchivePort,
  HOID_EPUB_RANGE_RUNTIME_LIMITS,
} from "./epubRangeRuntimeAdapters";

const encoder = new TextEncoder();

function makeZip(): Uint8Array {
  const files: Parameters<typeof zipSync>[0] = {
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": encoder.encode("<container/>"),
    "OEBPS/content.opf": [encoder.encode("<package/>"), { level: 6 }],
    "OEBPS/nav.xhtml": [encoder.encode("<html/>"), { level: 6 }],
    "OEBPS/chapter.xhtml": [encoder.encode("<html><body>fixture</body></html>"), { level: 6 }],
    "OEBPS/padding.bin": [new Uint8Array(70_000).map((_, index) => (index * 73 + (index >>> 8) * 19) & 0xff), { level: 0 }],
  };
  return zipSync(files);
}


function sparseArchiveSource(
  bytes: Uint8Array,
  targetSize: number,
  calls: Array<Readonly<{ offset: number; length: number }>>,
) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocdOffset = -1;
  for (let offset = bytes.byteLength - 22; offset >= Math.max(0, bytes.byteLength - 22 - 0xffff); offset -= 1) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue;
    if (offset + 22 + view.getUint16(offset + 20, true) === bytes.byteLength) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Fixture EOCD was not found");

  const centralOffset = view.getUint32(eocdOffset + 16, true);
  const gapLength = targetSize - bytes.byteLength;
  if (!Number.isSafeInteger(gapLength) || gapLength < 8 || gapLength - 8 > 0xffffffff) {
    throw new Error("Sparse ZIP gap is invalid");
  }

  // ZIP archive-extra-data record: a bounded header followed by a virtual zero-filled payload.
  const extraHeader = new Uint8Array(8);
  const extraView = new DataView(extraHeader.buffer);
  extraView.setUint32(0, 0x08064b50, true);
  extraView.setUint32(4, gapLength - 8, true);

  const tail = bytes.slice(centralOffset);
  new DataView(tail.buffer, tail.byteOffset, tail.byteLength)
    .setUint32(eocdOffset - centralOffset + 16, centralOffset + gapLength, true);
  const gapEnd = centralOffset + gapLength;

  return Object.freeze({
    size: targetSize,
    async readRange(offset: number, length: number): Promise<Uint8Array> {
      calls.push(Object.freeze({ offset, length }));
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > targetSize) {
        throw new Error("Sparse fixture range is invalid");
      }
      const output = new Uint8Array(length);
      const end = offset + length;
      const copyOverlap = (start: number, stop: number, source: Uint8Array, sourceStart: number) => {
        const from = Math.max(offset, start);
        const to = Math.min(end, stop);
        if (to > from) {
          output.set(source.subarray(sourceStart + from - start, sourceStart + to - start), from - offset);
        }
      };
      copyOverlap(0, centralOffset, bytes, 0);
      copyOverlap(centralOffset, centralOffset + extraHeader.byteLength, extraHeader, 0);
      copyOverlap(gapEnd, targetSize, tail, 0);
      return output;
    },
  });
}

function sourceFor(bytes: Uint8Array, calls: Array<Readonly<{ offset: number; length: number }>>) {
  return Object.freeze({
    size: bytes.byteLength,
    async readRange(offset: number, length: number): Promise<Uint8Array> {
      calls.push(Object.freeze({ offset, length }));
      return bytes.slice(offset, offset + length);
    },
  });
}

describe("range-based EPUB ZIP adapter", () => {
  it("lists entries without loading the whole archive and marks uninspected local extras as unknown", async () => {
    const bytes = makeZip();
    expect(bytes.byteLength).toBeGreaterThan(22 + 0xffff);
    const calls: Array<Readonly<{ offset: number; length: number }>> = [];
    const archive = createHoidFflateRangeArchivePort(async id => id === "fixture" ? sourceFor(bytes, calls) : null);
    const entries = await archive.listEntries("fixture");

    expect(entries[0]).toMatchObject({
      path: "mimetype",
      ordinal: 0,
      localHeaderExtraFieldLength: 0,
      compressionMethod: "stored",
    });
    expect(entries.find(entry => entry.path === "OEBPS/chapter.xhtml")?.localHeaderExtraFieldLength).toBeNull();
    expect(calls.some(call => call.offset === 0 && call.length === bytes.byteLength)).toBe(false);
  });

  it("reads and verifies one stored member", async () => {
    const bytes = makeZip();
    const archive = createHoidFflateRangeArchivePort(async () => sourceFor(bytes, []));
    await archive.listEntries("fixture");
    const result = await archive.readEntry("fixture", "mimetype", 20);
    expect(result).toEqual(strToU8("application/epub+zip"));
  });

  it("reads and verifies one DEFLATE member", async () => {
    const bytes = makeZip();
    const archive = createHoidFflateRangeArchivePort(async () => sourceFor(bytes, []));
    await archive.listEntries("fixture");
    const result = await archive.readEntry("fixture", "OEBPS/chapter.xhtml", 1024);
    expect(result).toEqual(encoder.encode("<html><body>fixture</body></html>"));
  });

  it("stops requesting further ZIP ranges when cancellation arrives during a range read", async () => {
    const bytes = makeZip();
    const calls: Array<Readonly<{ offset: number; length: number }>> = [];
    let holdNextRead = false;
    let resolveHeldRead: (value: Uint8Array) => void = () => {};
    let markHeldReadStarted: () => void = () => {};
    const heldReadStarted = new Promise<void>(resolve => {
      markHeldReadStarted = resolve;
    });
    const source = Object.freeze({
      size: bytes.byteLength,
      async readRange(offset: number, length: number, signal?: AbortSignal): Promise<Uint8Array> {
        calls.push(Object.freeze({ offset, length }));
        if (holdNextRead) {
          holdNextRead = false;
          markHeldReadStarted();
          const result = await new Promise<Uint8Array>(resolve => {
            resolveHeldRead = resolve;
          });
          if (signal?.aborted) throw new Error("cancelled");
          return result;
        }
        return bytes.slice(offset, offset + length);
      },
    });
    const archive = createHoidFflateRangeArchivePort(async () => source);
    await archive.listEntries("fixture");
    const previousCallCount = calls.length;
    holdNextRead = true;
    const controller = new AbortController();
    const operation = archive.readEntry("fixture", "OEBPS/chapter.xhtml", 1024, controller.signal);

    await heldReadStarted;
    controller.abort();
    const held = calls[previousCallCount];
    resolveHeldRead(bytes.slice(held.offset, held.offset + held.length));

    await expect(operation).rejects.toThrow("cancelled");
    expect(calls.length - previousCallCount).toBe(1);
  });

  it("rejects a source whose range reader returns a short slice", async () => {
    const bytes = makeZip();
    const archive = createHoidFflateRangeArchivePort(async () => ({
      size: bytes.byteLength,
      async readRange(offset, length) {
        return bytes.slice(offset, Math.max(offset, offset + length - 1));
      },
    }));
    await expect(archive.listEntries("fixture")).rejects.toThrow();
  });

  it("rejects a source beyond the archive size limit before reading it", async () => {
    let reads = 0;
    const archive = createHoidFflateRangeArchivePort(async () => ({
      size: HOID_EPUB_RANGE_RUNTIME_LIMITS.maxArchiveBytes + 1,
      async readRange() {
        reads += 1;
        return new Uint8Array(0);
      },
    }));
    await expect(archive.listEntries("fixture")).rejects.toThrow();
    expect(reads).toBe(0);
  });


  it("accepts a 280 MiB range source without materializing the archive", async () => {
    const bytes = makeZip();
    const targetSize = 280 * 1024 * 1024;
    const calls: Array<Readonly<{ offset: number; length: number }>> = [];
    const source = sparseArchiveSource(bytes, targetSize, calls);
    const archive = createHoidFflateRangeArchivePort(async id => id === "large-fixture" ? source : null);

    const entries = await archive.listEntries("large-fixture");
    expect(entries).toHaveLength(6);
    expect(HOID_EPUB_RANGE_RUNTIME_LIMITS.maxArchiveBytes).toBe(320 * 1024 * 1024);
    expect(targetSize).toBeLessThan(HOID_EPUB_RANGE_RUNTIME_LIMITS.maxArchiveBytes);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(call => call.length <= 16 * 1024 * 1024)).toBe(true);
    expect(calls.some(call => call.offset === 0 && call.length === targetSize)).toBe(false);
  });

  it("rejects a corrupted member through CRC verification", async () => {
    const bytes = makeZip();
    const centralSignature = [0x50, 0x4b, 0x01, 0x02];
    let centralOffset = -1;
    for (let i = 0; i < bytes.byteLength - 4; i += 1) {
      if (centralSignature.every((value, index) => bytes[i + index] === value)) {
        centralOffset = i;
        break;
      }
    }
    expect(centralOffset).toBeGreaterThan(0);
    const corrupt = bytes.slice();
    const localOffset = new DataView(corrupt.buffer).getUint32(centralOffset + 42, true);
    const nameLength = new DataView(corrupt.buffer).getUint16(localOffset + 26, true);
    const extraLength = new DataView(corrupt.buffer).getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + nameLength + extraLength;
    corrupt[dataOffset] ^= 0xff;
    const archive = createHoidFflateRangeArchivePort(async () => sourceFor(corrupt, []));
    await archive.listEntries("fixture");
    await expect(archive.readEntry("fixture", "mimetype", 20)).rejects.toThrow();
  });
});
