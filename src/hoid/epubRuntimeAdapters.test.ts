import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  createHoidEpubRuntimePorts,
  createHoidFflateArchivePort,
  createHoidNobleDigestPort,
  createHoidSaxesXmlPort,
} from "./epubRuntimeAdapters";

const CONTAINER_XML = strToU8(
  '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
);
const PACKAGE_XML = strToU8(
  '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">' +
  '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Fixture Book</dc:title>' +
  '<dc:language>es</dc:language><dc:identifier id="uid">urn:fixture:book</dc:identifier></metadata>' +
  '<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' +
  '<item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest>' +
  '<spine><itemref idref="chapter"/></spine></package>',
);
const NAV_XML = strToU8(
  '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">' +
  '<body><nav epub:type="toc"><ol><li><a href="chapter.xhtml#one">Chapter One</a></li>' +
  '<li><a href="chapter-two.xhtml">Chapter Two</a><ol><li><a href="chapter-three.xhtml">Chapter Three</a></li></ol></li>' +
  '</ol></nav></body></html>',
);
const XHTML = strToU8(
  '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Synthetic</title></head>' +
  '<body><p>Non-copyright fixture text.</p></body></html>',
);
const NCX_XML = strToU8(
  '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap>' +
  '<navPoint id="n1"><navLabel><text>Part One</text></navLabel><content src="chapter.xhtml"/>' +
  '<navPoint id="n2"><navLabel><text>Part Two</text></navLabel><content src="chapter-two.xhtml"/></navPoint>' +
  '</navPoint></navMap></ncx>',
);

function makeZip(extra: Readonly<Record<string, Uint8Array>> = {}): Uint8Array {
  const files: Record<string, Uint8Array | [Uint8Array, { level: number }]> = {
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": CONTAINER_XML,
    "OEBPS/content.opf": PACKAGE_XML,
    "OEBPS/nav.xhtml": NAV_XML,
    "OEBPS/chapter.xhtml": [XHTML, { level: 6 }],
  };
  for (const [path, bytes] of Object.entries(extra)) files[path] = bytes;
  return zipSync(files, { level: 6, mtime: new Date("1980-01-01T00:00:00.000Z") });
}

function findSequence(bytes: Uint8Array, needle: Uint8Array, start = 0): number {
  for (let offset = start; offset <= bytes.byteLength - needle.byteLength; offset += 1) {
    let matched = true;
    for (let index = 0; index < needle.byteLength; index += 1) {
      if (bytes[offset + index] !== needle[index]) {
        matched = false;
        break;
      }
    }
    if (matched) return offset;
  }
  return -1;
}

function readU16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true);
}

function writeU16(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset + offset, 2).setUint16(0, value, true);
}

function writeU32(bytes: Uint8Array, offset: number, value: number): void {
  new DataView(bytes.buffer, bytes.byteOffset + offset, 4).setUint32(0, value, true);
}

function archiveFor(bytes: Uint8Array) {
  return createHoidFflateArchivePort(sourceId => sourceId === "fixture" ? bytes : null);
}

describe("concrete local EPUB runtime adapters", () => {
  it("indexes physical ZIP entries and preserves the EPUB mimetype constraints", async () => {
    const archive = archiveFor(makeZip());
    const entries = await archive.listEntries("fixture");
    expect(entries[0]).toMatchObject({
      path: "mimetype",
      ordinal: 0,
      localHeaderExtraFieldLength: 0,
      kind: "file",
      compressionMethod: "stored",
      compressedSize: 20,
      uncompressedSize: 20,
      encrypted: false,
    });
    expect(entries.map(entry => entry.ordinal)).toEqual(entries.map((_entry, index) => index));
  });

  it("reads stored and DEFLATE members with exact length and CRC verification", async () => {
    const archive = archiveFor(makeZip());
    await expect(archive.readEntry("fixture", "mimetype", 64))
      .resolves.toEqual(strToU8("application/epub+zip"));
    await expect(archive.readEntry("fixture", "OEBPS/chapter.xhtml", 4096))
      .resolves.toEqual(XHTML);
  });

  it("returns null for missing paths and directory entries", async () => {
    const archive = archiveFor(makeZip());
    await expect(archive.readEntry("fixture", "missing.xhtml", 1024)).resolves.toBeNull();
    await expect(archive.readEntry("fixture", "mimetype", -1)).rejects.toThrow();
  });

  it("rejects path traversal before exposing the archive inventory", async () => {
    const archive = archiveFor(makeZip({ "../outside.txt": strToU8("no") }));
    await expect(archive.listEntries("fixture")).rejects.toThrow();
  });

  it("rejects case-fold collisions in ZIP paths", async () => {
    const archive = archiveFor(makeZip({
      "OEBPS/Chapter.xhtml": strToU8("one"),
      "OEBPS/chapter.xhtml": strToU8("two"),
    }));
    await expect(archive.listEntries("fixture")).rejects.toThrow();
  });

  it("rejects ZIP64 sentinels before invoking a decompressor", async () => {
    const bytes = makeZip();
    const centralSignature = findSequence(bytes, Uint8Array.from([0x50, 0x4b, 0x01, 0x02]));
    expect(centralSignature).toBeGreaterThanOrEqual(0);
    const nameOffset = findSequence(bytes, strToU8("mimetype"), centralSignature + 46);
    expect(nameOffset).toBe(centralSignature + 46);
    writeU32(bytes, centralSignature + 20, 0xffffffff);
    await expect(archiveFor(bytes).listEntries("fixture")).rejects.toThrow(/ZIP64/);
  });

  it("rejects local and central header disagreement", async () => {
    const bytes = makeZip();
    const localName = strToU8("OEBPS/chapter.xhtml");
    const localNameOffset = findSequence(bytes, localName);
    expect(localNameOffset).toBeGreaterThanOrEqual(30);
    const localOffset = localNameOffset - 30;
    writeU16(bytes, localOffset + 8, 99);
    await expect(archiveFor(bytes).listEntries("fixture")).rejects.toThrow();
  });

  it("rejects encrypted members", async () => {
    const bytes = makeZip();
    const name = strToU8("OEBPS/chapter.xhtml");
    const localNameOffset = findSequence(bytes, name);
    const centralNameOffset = findSequence(bytes, name, localNameOffset + name.byteLength);
    expect(localNameOffset).toBeGreaterThanOrEqual(30);
    expect(centralNameOffset).toBeGreaterThanOrEqual(46);
    writeU16(bytes, localNameOffset - 30 + 6, 1);
    writeU16(bytes, centralNameOffset - 46 + 8, 1);
    await expect(archiveFor(bytes).listEntries("fixture")).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "OEBPS/chapter.xhtml", encrypted: true })]),
    );
  });

  it("detects corrupted member data through DEFLATE or CRC verification", async () => {
    const bytes = makeZip();
    const name = strToU8("OEBPS/chapter.xhtml");
    const nameOffset = findSequence(bytes, name);
    const localOffset = nameOffset - 30;
    const extraLength = readU16(bytes, localOffset + 28);
    const dataOffset = nameOffset + name.byteLength + extraLength;
    bytes[dataOffset] ^= 0x40;
    await expect(archiveFor(bytes).readEntry("fixture", "OEBPS/chapter.xhtml", 4096)).rejects.toThrow();
  });

  it("rejects DEFLATE output larger than the declared uncompressed size", async () => {
    const bytes = makeZip();
    const name = strToU8("OEBPS/chapter.xhtml");
    const localNameOffset = findSequence(bytes, name);
    const centralNameOffset = findSequence(bytes, name, localNameOffset + name.byteLength);
    const localOffset = localNameOffset - 30;
    const centralOffset = centralNameOffset - 46;
    writeU32(bytes, localOffset + 14, 0);
    writeU32(bytes, localOffset + 22, 0);
    writeU32(bytes, centralOffset + 16, 0);
    writeU32(bytes, centralOffset + 24, 0);

    await expect(archiveFor(bytes).readEntry("fixture", "OEBPS/chapter.xhtml", 4096))
      .rejects.toThrow();
  });

  it("parses EPUB container and OPF metadata with namespace-aware XML", async () => {
    const xml = createHoidSaxesXmlPort();
    await expect(xml.parseContainerXml(CONTAINER_XML)).resolves.toEqual({
      rootfiles: [{
        fullPath: "OEBPS/content.opf",
        mediaType: "application/oebps-package+xml",
      }],
    });
    await expect(xml.parsePackageDocument(PACKAGE_XML)).resolves.toMatchObject({
      version: "3.0",
      uniqueIdentifierId: "uid",
      metadata: {
        title: "Fixture Book",
        language: "es",
        identifiers: [{ id: "uid", value: "urn:fixture:book" }],
      },
      manifestItems: [
        expect.objectContaining({ id: "nav", properties: ["nav"] }),
        expect.objectContaining({ id: "chapter", href: "chapter.xhtml" }),
      ],
      spine: [{ idref: "chapter", linear: true }],
      spineTocId: null,
    });
  });

  it("parses nested EPUB 3 navigation without returning chapter bodies", async () => {
    const xml = createHoidSaxesXmlPort();
    const result = await xml.parseNavigationDocument(NAV_XML, "epub3-nav");
    expect(result).toEqual([
      { label: "Chapter One", href: "chapter.xhtml#one", children: [] },
      {
        label: "Chapter Two",
        href: "chapter-two.xhtml",
        children: [{ label: "Chapter Three", href: "chapter-three.xhtml", children: [] }],
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("Non-copyright fixture text");
  });

  it("parses EPUB 2 NCX navigation", async () => {
    const xml = createHoidSaxesXmlPort();
    await expect(xml.parseNavigationDocument(NCX_XML, "epub2-ncx")).resolves.toEqual([
      {
        label: "Part One",
        href: "chapter.xhtml",
        children: [{ label: "Part Two", href: "chapter-two.xhtml", children: [] }],
      },
    ]);
  });

  it("rejects DTDs, external entity declarations and malformed XML", async () => {
    const xml = createHoidSaxesXmlPort();
    await expect(xml.parseContainerXml(strToU8(
      '<!DOCTYPE container [<!ENTITY x SYSTEM "file:///etc/passwd">]><container/>',
    ))).rejects.toThrow(/DTD/);
    await expect(xml.parseContainerXml(strToU8("<container><rootfiles></container>"))).rejects.toThrow();
  });

  it("validates XHTML root and namespace without returning narrative text", async () => {
    const xml = createHoidSaxesXmlPort();
    await expect(xml.validateXhtml(XHTML)).resolves.toBe(true);
    await expect(xml.validateXhtml(strToU8("<html><body>not XHTML</body></html>"))).resolves.toBe(false);
    await expect(xml.validateXhtml(strToU8("<html xmlns='http://www.w3.org/1999/xhtml'><body>"))).resolves.toBe(false);
  });

  it("accepts a valid UTF-8 BOM without weakening byte validation", async () => {
    const xml = createHoidSaxesXmlPort();
    const bom = Uint8Array.from([0xef, 0xbb, 0xbf]);
    const withBom = new Uint8Array(bom.byteLength + CONTAINER_XML.byteLength);
    withBom.set(bom);
    withBom.set(CONTAINER_XML, bom.byteLength);
    await expect(xml.parseContainerXml(withBom)).resolves.toMatchObject({
      rootfiles: [{ fullPath: "OEBPS/content.opf" }],
    });
  });

  it("rejects XML with invalid UTF-8 bytes", async () => {
    const xml = createHoidSaxesXmlPort();
    await expect(xml.parseContainerXml(Uint8Array.from([0x3c, 0x63, 0x80, 0x3e])))
      .rejects.toThrow(/UTF-8/);
  });

  it("calculates standard SHA-256 digests for bytes and UTF-8 text", async () => {
    const digest = createHoidNobleDigestPort();
    const expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    await expect(digest.sha256(strToU8("abc"))).resolves.toBe(expected);
    await expect(digest.sha256Utf8("abc")).resolves.toBe(expected);
  });

  it("composes all runtime ports around an injected local source resolver", async () => {
    const bytes = makeZip();
    const runtime = createHoidEpubRuntimePorts(sourceId => sourceId === "fixture" ? bytes : null);
    const entries = await runtime.archive.listEntries("fixture");
    expect(entries.length).toBeGreaterThan(0);
    await expect(runtime.xml.validateXhtml(XHTML)).resolves.toBe(true);
    await expect(runtime.digest.sha256(XHTML)).resolves.toMatch(/^[a-f0-9]{64}$/);
  });

  it("re-reads source bytes on every operation so replacement is observable", async () => {
    let current = makeZip();
    const archive = createHoidFflateArchivePort(() => current);
    const before = await archive.readEntry("fixture", "OEBPS/chapter.xhtml", 4096);
    current = makeZip({ "OEBPS/extra.txt": strToU8("replacement") });
    const after = await archive.readEntry("fixture", "OEBPS/chapter.xhtml", 4096);
    expect(before).toEqual(after);
    await expect(archive.listEntries("fixture")).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "OEBPS/extra.txt" })]),
    );
  });
});
