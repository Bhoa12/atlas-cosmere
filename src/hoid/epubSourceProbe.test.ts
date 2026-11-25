import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { probeHoidEpubStructure } from "./epubSourceProbe";

function buildEpub(options: Readonly<{
  navigation?: string;
  packageXml?: string;
  containerXml?: string;
  chapterBody?: string;
  navHref?: string;
  includeNcx?: boolean;
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
  if (options.includeNcx) {
    return zipSync({
      mimetype: [strToU8("application/epub+zip"), { level: 0 }],
      "META-INF/container.xml": strToU8(containerXml),
      "OEBPS/content.opf": strToU8([
        '<package xmlns="http://www.idpf.org/2007/opf" version="2.0">',
        '<metadata/>',
        '<manifest>',
        '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
        '<item id="ch1" href="Text/ch1.xhtml" media-type="application/xhtml+xml"/>',
        '<item id="ch2" href="Text/ch2.xhtml" media-type="application/xhtml+xml"/>',
        '</manifest>',
        '<spine toc="ncx"><itemref idref="ch1"/><itemref idref="ch2"/></spine>',
        '</package>',
      ].join("")),
      "OEBPS/toc.ncx": strToU8([
        '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap>',
        '<navPoint id="n1"><navLabel><text>Chapter 1</text></navLabel><content src="Text/ch1.xhtml"/></navPoint>',
        '<navPoint id="n2"><navLabel><text>Chapter 2</text></navLabel><content src="Text/ch2.xhtml"/></navPoint>',
        '</navMap></ncx>',
      ].join("")),
      "OEBPS/Text/ch1.xhtml": chapter1,
      "OEBPS/Text/ch2.xhtml": chapter2,
    });
  }
  return zipSync({
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(containerXml),
    "OEBPS/content.opf": strToU8(packageXml),
    "OEBPS/nav.xhtml": strToU8(navigation),
    "OEBPS/Text/ch1.xhtml": chapter1,
    "OEBPS/Text/ch2.xhtml": chapter2,
    "OEBPS/images/large-unused-image.bin": new Uint8Array(128 * 1024).fill(7),
  });
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

  it("preserves duplicate chapter numbers as separate locator identities", () => {
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
    expect(probeHoidEpubStructure(buildEpub({ containerXml }))).toMatchObject({
      status: "invalid", reason: "invalid-container-xml",
    });
  });

  it("rejects malformed package XML", () => {
    expect(probeHoidEpubStructure(buildEpub({ packageXml: "<package><manifest></package>" }))).toMatchObject({
      status: "invalid", reason: "invalid-package-xml",
    });
  });

  it("rejects a navigation target outside the package manifest", () => {
    expect(probeHoidEpubStructure(buildEpub({ navHref: "Text/missing.xhtml" }))).toMatchObject({
      status: "invalid", reason: "navigation-target-not-in-manifest",
    });
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
    expect(probeHoidEpubStructure(buildEpub({ packageXml }))).toMatchObject({
      status: "invalid", reason: "navigation-target-not-in-spine",
    });
  });

  it("rejects unsafe relative paths in the ZIP directory", () => {
    const archive = zipSync({
      mimetype: [strToU8("application/epub+zip"), { level: 0 }],
      "../escape.txt": strToU8("not allowed"),
      "META-INF/container.xml": strToU8("<container/>"),
    });
    expect(probeHoidEpubStructure(archive)).toMatchObject({
      status: "invalid", reason: "unsafe-archive-path",
    });
  });

  it("rejects a non-EPUB mimetype", () => {
    const archive = zipSync({
      mimetype: [strToU8("application/zip"), { level: 0 }],
      "META-INF/container.xml": strToU8("<container/>"),
    });
    expect(probeHoidEpubStructure(archive)).toMatchObject({
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
