import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { createHoidFflateRangeArchivePort } from "./epubRangeRuntimeAdapters";

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
      size: 257 * 1024 * 1024,
      async readRange() {
        reads += 1;
        return new Uint8Array(0);
      },
    }));
    await expect(archive.listEntries("fixture")).rejects.toThrow();
    expect(reads).toBe(0);
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
