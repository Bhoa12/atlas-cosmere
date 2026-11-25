import { describe, expect, it } from "vitest";
import { deflateSync, strToU8 } from "fflate";
import { probeHoidEpubStructure } from "./epubSourceProbe";

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

type ZipFixtureEntry = Readonly<{ name: string; data: Uint8Array; method?: 0 | 8 }>;

function setU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}
function setU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}
function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}
function createZip(entries: readonly ZipFixtureEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = strToU8(entry.name);
    const method = entry.method ?? (entry.name === "mimetype" ? 0 : 8);
    const compressed = method === 0 ? entry.data : deflateSync(entry.data);
    const checksum = crc32(entry.data);
    const flags = 0x0800;
    const local = new Uint8Array(30 + name.length + compressed.length);
    const localView = new DataView(local.buffer);
    setU32(localView, 0, 0x04034b50);
    setU16(localView, 4, 20);
    setU16(localView, 6, flags);
    setU16(localView, 8, method);
    setU16(localView, 10, 0);
    setU16(localView, 12, 0);
    setU32(localView, 14, checksum);
    setU32(localView, 18, compressed.length);
    setU32(localView, 22, entry.data.length);
    setU16(localView, 26, name.length);
    setU16(localView, 28, 0);
    local.set(name, 30);
    local.set(compressed, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    setU32(centralView, 0, 0x02014b50);
    setU16(centralView, 4, (3 << 8) | 20);
    setU16(centralView, 6, 20);
    setU16(centralView, 8, flags);
    setU16(centralView, 10, method);
    setU16(centralView, 12, 0);
    setU16(centralView, 14, 0);
    setU32(centralView, 16, checksum);
    setU32(centralView, 20, compressed.length);
    setU32(centralView, 24, entry.data.length);
    setU16(centralView, 28, name.length);
    setU16(centralView, 30, 0);
    setU16(centralView, 32, 0);
    setU16(centralView, 34, 0);
    setU16(centralView, 36, 0);
    setU32(centralView, 38, 0);
    setU32(centralView, 42, localOffset);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length;
  }
  const centralOffset = localOffset;
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  setU32(endView, 0, 0x06054b50);
  setU16(endView, 4, 0);
  setU16(endView, 6, 0);
  setU16(endView, 8, entries.length);
  setU16(endView, 10, entries.length);
  setU32(endView, 12, centralSize);
  setU32(endView, 16, centralOffset);
  setU16(endView, 20, 0);
  return concatBytes([...localParts, ...centralParts, end]);
}

function buildEpub(options: Readonly<{
  navigation?: string;
  packageXml?: string;
  containerXml?: string;
  chapterBody?: string;
  navHref?: string;
  includeNcx?: boolean;
  mimetype?: string;
}> = {}): Uint8Array {
  const navHref = options.navHref ?? "Text/ch1.xhtml";
  const navigation = options.navigation ?? [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">',
    '<body><nav epub:type="toc"><ol>',
    '<li><a href="' + navHref + '">Chapter 1: A title that must not leave the parser</a></li>',
    '<li><a href="Text/ch2.xhtml">Chapter 2: Another private heading</a></li>',
    '</ol></nav></body></html>',
  ].join("");
  const packageXml = options.packageXml ?? [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0">',
    '<metadata><title>Private fixture title</title></metadata>',
    '<manifest>',
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '<item id="ch1" href="Text/ch1.xhtml" media-type="application/xhtml+xml"/>',
    '<item id="ch2" href="Text/ch2.xhtml" media-type="application/xhtml+xml"/>',
    '</manifest>',
    '<spine><itemref idref="ch1"/><itemref idref="ch2"/></spine>',
    '</package>',
  ].join("");
  const containerXml = options.containerXml ?? [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">',
    '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>',
    '</container>',
  ].join("");
  const chapter1 = strToU8(options.chapterBody ?? "<html><body>PRIVATE CHAPTER BODY MUST NEVER BE READ</body></html>");
  const chapter2 = strToU8("<html><body>SECOND PRIVATE CHAPTER</body></html>");
  const mimetype = strToU8(options.mimetype ?? "application/epub+zip");
  if (options.includeNcx) {
    return createZip([
      { name: "mimetype", data: mimetype, method: 0 },
      { name: "META-INF/container.xml", data: strToU8(containerXml) },
      { name: "OEBPS/content.opf", data: strToU8([
        '<package xmlns="http://www.idpf.org/2007/opf" version="2.0">',
        '<metadata/>',
        '<manifest>',
        '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
        '<item id="ch1" href="Text/ch1.xhtml" media-type="application/xhtml+xml"/>',
        '<item id="ch2" href="Text/ch2.xhtml" media-type="application/xhtml+xml"/>',
        '</manifest>',
        '<spine toc="ncx"><itemref idref="ch1"/><itemref idref="ch2"/></spine>',
        '</package>',
      ].join("")) },
      { name: "OEBPS/toc.ncx", data: strToU8([
        '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap>',
        '<navPoint id="n1"><navLabel><text>Chapter 1</text></navLabel><content src="Text/ch1.xhtml"/></navPoint>',
        '<navPoint id="n2"><navLabel><text>Chapter 2</text></navLabel><content src="Text/ch2.xhtml"/></navPoint>',
        '</navMap></ncx>',
      ].join("")) },
      { name: "OEBPS/Text/ch1.xhtml", data: chapter1 },
      { name: "OEBPS/Text/ch2.xhtml", data: chapter2 },
    ]);
  }
  return createZip([
    { name: "mimetype", data: mimetype, method: 0 },
    { name: "META-INF/container.xml", data: strToU8(containerXml) },
    { name: "OEBPS/content.opf", data: strToU8(packageXml) },
    { name: "OEBPS/nav.xhtml", data: strToU8(navigation) },
    { name: "OEBPS/Text/ch1.xhtml", data: chapter1 },
    { name: "OEBPS/Text/ch2.xhtml", data: chapter2 },
    { name: "OEBPS/images/large-unused-image.bin", data: new Uint8Array(128 * 1024).fill(7) },
  ]);
}

describe("Hoid metadata-only EPUB structure probe", () => {
  it("maps EPUB 3 navigation to spine ordinals without returning titles, paths or chapter bodies", () => {
    const result = probeHoidEpubStructure(buildEpub());
    expect(result.status).toBe("candidate");
    if (result.status !== "candidate") return;
    expect(result.probe).toMatchObject({
      scope: "metadata-only",
      workSegmentation: "not-inferred",
      packageVersion: "3.0",
      navigationFormat: "epub3-nav",
      manifestItemCount: 3,
      spineItemCount: 2,
      navigationEntryCount: 2,
      numberedTocEntryCount: 2,
      unnumberedTocEntryCount: 0,
      sourceContentIncluded: false,
      chapterBodiesInspected: false,
      progressUnlockGranted: false,
      promotionAllowed: false,
      productionWritePerformed: false,
    });
    expect(result.probe.entries.map(item => [item.labelledChapterNumber, item.spineOrdinal])).toEqual([[1, 1], [2, 2]]);
    const serialized = JSON.stringify(result.probe);
    expect(serialized).not.toContain("A title that must not leave the parser");
    expect(serialized).not.toContain("Another private heading");
    expect(serialized).not.toContain("PRIVATE CHAPTER BODY");
    expect(serialized).not.toContain("OEBPS");
    expect(serialized).not.toContain("ch1.xhtml");
  });

  it("supports EPUB 2 NCX navigation", () => {
    const result = probeHoidEpubStructure(buildEpub({ includeNcx: true }));
    expect(result.status).toBe("candidate");
    if (result.status !== "candidate") return;
    expect(result.probe.navigationFormat).toBe("epub2-ncx");
    expect(result.probe.numberedTocEntryCount).toBe(2);
  });

  it("preserves repeated edition-wide chapter labels as separate locator identities", () => {
    const navigation = [
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">',
      '<body><nav epub:type="toc"><ol>',
      '<li><a href="Text/ch1.xhtml">Chapter 12</a></li>',
      '<li><a href="Text/ch2.xhtml">Chapter 12</a></li>',
      '</ol></nav></body></html>',
    ].join("");
    const result = probeHoidEpubStructure(buildEpub({ navigation }));
    expect(result.status).toBe("candidate");
    if (result.status !== "candidate") return;
    expect(result.probe.repeatedNumberedLabelsAcrossEdition).toEqual([12]);
    expect(result.probe.entries[0].locatorId).not.toBe(result.probe.entries[1].locatorId);
  });

  it("keeps unnumbered sections without assigning them numeric progress cursors", () => {
    const navigation = [
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">',
      '<body><nav epub:type="toc"><ol>',
      '<li><a href="Text/ch1.xhtml">Prelude</a></li>',
      '<li><a href="Text/ch2.xhtml">Chapter 2</a></li>',
      '</ol></nav></body></html>',
    ].join("");
    const result = probeHoidEpubStructure(buildEpub({ navigation }));
    expect(result.status).toBe("candidate");
    if (result.status !== "candidate") return;
    expect(result.probe.entries[0]).toMatchObject({ kind: "section", labelledChapterNumber: null, numberedEntryOrdinal: null });
    expect(result.probe.entries[1]).toMatchObject({ kind: "numbered-chapter", labelledChapterNumber: 2, numberedEntryOrdinal: 1 });
  });

  it("rejects malformed ZIP input", () => {
    expect(probeHoidEpubStructure(new Uint8Array([1, 2, 3]))).toMatchObject({ status: "invalid", reason: "invalid-zip" });
  });

  it("rejects XML with a DTD or entity declaration", () => {
    const containerXml = '<!DOCTYPE container [<!ENTITY x SYSTEM "file:///etc/passwd">]><container><rootfile full-path="OEBPS/content.opf"/></container>';
    expect(probeHoidEpubStructure(buildEpub({ containerXml }))).toMatchObject({ status: "invalid", reason: "invalid-container-xml" });
  });

  it("rejects malformed package XML", () => {
    expect(probeHoidEpubStructure(buildEpub({ packageXml: "<package><manifest></package>" }))).toMatchObject({ status: "invalid", reason: "invalid-package-xml" });
  });

  it("rejects a navigation target outside the package manifest", () => {
    expect(probeHoidEpubStructure(buildEpub({ navHref: "Text/missing.xhtml" }))).toMatchObject({ status: "invalid", reason: "navigation-target-not-in-manifest" });
  });

  it("rejects navigation targets not present in the reading spine", () => {
    const packageXml = [
      '<package xmlns="http://www.idpf.org/2007/opf" version="3.0">',
      '<metadata/>',
      '<manifest>',
      '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
      '<item id="ch1" href="Text/ch1.xhtml" media-type="application/xhtml+xml"/>',
      '<item id="ch2" href="Text/ch2.xhtml" media-type="application/xhtml+xml"/>',
      '</manifest>',
      '<spine><itemref idref="ch1"/></spine>',
      '</package>',
    ].join("");
    expect(probeHoidEpubStructure(buildEpub({ packageXml }))).toMatchObject({ status: "invalid", reason: "navigation-target-not-in-spine" });
  });

  it("rejects unsafe relative paths in the ZIP directory", () => {
    const archive = createZip([
      { name: "mimetype", data: strToU8("application/epub+zip"), method: 0 },
      { name: "../escape.txt", data: strToU8("not allowed") },
      { name: "META-INF/container.xml", data: strToU8("<container/>") },
    ]);
    expect(probeHoidEpubStructure(archive)).toMatchObject({ status: "invalid", reason: "unsafe-archive-path" });
  });

  it("rejects a non-EPUB mimetype", () => {
    expect(probeHoidEpubStructure(buildEpub({ mimetype: "application/zip" }))).toMatchObject({
      status: "invalid", reason: "invalid-mimetype",
    });
  });

  it("rejects metadata entries larger than the configured bound", () => {
    const hugeNavigation = "<html>" + "x".repeat(2 * 1024 * 1024 + 1) + "</html>";
    expect(probeHoidEpubStructure(buildEpub({ navigation: hugeNavigation }))).toMatchObject({
      status: "invalid", reason: "navigation-too-large",
    });
  });

  it("does not decompress an unrelated large chapter body or image", () => {
    const largeBody = "PRIVATE_BODY_".repeat(100_000);
    const result = probeHoidEpubStructure(buildEpub({ chapterBody: largeBody }));
    expect(result.status).toBe("candidate");
    if (result.status !== "candidate") return;
    expect(result.probe.chapterBodiesInspected).toBe(false);
    expect(JSON.stringify(result.probe)).not.toContain("PRIVATE_BODY_");
  });

  it("does not return archive paths or infer an edition/work identity", () => {
    const result = probeHoidEpubStructure(buildEpub());
    expect(result.status).toBe("candidate");
    if (result.status !== "candidate") return;
    const serialized = JSON.stringify(result.probe);
    expect(serialized).not.toContain("editionId");
    expect(serialized).not.toContain("bookId");
    expect(serialized).not.toContain("filePath");
    expect(serialized).not.toContain("href");
  });
});
