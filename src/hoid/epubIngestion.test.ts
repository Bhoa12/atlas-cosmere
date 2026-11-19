import { describe, expect, it, vi } from "vitest";
import { getHoidSourceCoverageReport } from "./sourceCoverage";
import {
  createHoidEpubIngestionService,
  resolveHoidEpubHref,
  type HoidEpubArchiveEntry,
  type HoidEpubArchivePort,
  type HoidEpubDigestPort,
  type HoidEpubNavigationNode,
  type HoidEpubPackageDocument,
  type HoidEpubXmlPort,
} from "./epubIngestion";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const EXPECTED_NAVIGATION_SHA256 = "85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee";

function bytes(value: string): Uint8Array {
  return encoder.encode(value);
}

function digest(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").repeat(8);
}

const packageDocument: HoidEpubPackageDocument = {
  version: "3.0",
  uniqueIdentifierId: "publication-id",
  metadata: {
    title: "Obra sintética de prueba",
    language: "es",
    identifiers: [{ id: "publication-id", value: "urn:fixture:work" }],
  },
  manifestItems: [
    { id: "nav", href: "nav.xhtml", mediaType: "application/xhtml+xml", properties: ["nav"] },
    { id: "chapter-one", href: "Text/chapter-1.xhtml", mediaType: "application/xhtml+xml", properties: [] },
    { id: "chapter-two", href: "Text/chapter-2.xhtml", mediaType: "application/xhtml+xml", properties: [] },
  ],
  spine: [
    { idref: "chapter-one", linear: true },
    { idref: "chapter-two", linear: true },
  ],
  spineTocId: null,
};

const navigation: readonly HoidEpubNavigationNode[] = [
  {
    label: "Capítulo 1",
    href: "Text/chapter-1.xhtml#chapter-1",
    children: [],
  },
];

function makeFixture(navigationSha256 = EXPECTED_NAVIGATION_SHA256) {
  const contents = new Map<string, Uint8Array>([
    ["mimetype", bytes("application/epub+zip")],
    ["META-INF/container.xml", bytes("<container/>")],
    ["OEBPS/package.opf", bytes("<package/>")],
    ["OEBPS/nav.xhtml", bytes("<nav/>")],
    ["OEBPS/Text/chapter-1.xhtml", bytes("<html><body>synthetic</body></html>")],
    ["OEBPS/Text/chapter-2.xhtml", bytes("<html><body>not in nav</body></html>")],
  ]);

  const paths = [...contents.keys()];
  const entries: HoidEpubArchiveEntry[] = paths.map((path, ordinal) => {
    const data = contents.get(path)!;
    return Object.freeze({
      path,
      ordinal,
      kind: "file" as const,
      compressionMethod: ordinal === 0 ? "stored" as const : "deflated" as const,
      compressedSize: data.byteLength === 20 && ordinal === 0 ? 20 : Math.max(1, Math.ceil(data.byteLength / 2)),
      uncompressedSize: data.byteLength,
      encrypted: false,
    });
  });

  const archive: HoidEpubArchivePort = {
    listEntries: vi.fn(async () => entries),
    readEntry: vi.fn(async (_sourceId: string, path: string, _maximumBytes: number) => contents.get(path) ?? null),
  };

  const xml: HoidEpubXmlPort = {
    parseContainerXml: vi.fn(async () => ({
      rootfiles: [{ fullPath: "OEBPS/package.opf", mediaType: "application/oebps-package+xml" }],
    })),
    parsePackageDocument: vi.fn(async () => packageDocument),
    parseNavigationDocument: vi.fn(async () => navigation),
    validateXhtml: vi.fn(async (data: Uint8Array) => decoder.decode(data).startsWith("<html>")),
  };

  const digestPort: HoidEpubDigestPort = {
    sha256: vi.fn(async (data: Uint8Array) => {
      const decoded = decoder.decode(data);
      return decoded === "<nav/>" || decoded === "<ncx/>" ? navigationSha256 : digest(decoded);
    }),
    sha256Utf8: vi.fn(async (value: string) => digest(value)),
  };

  const service = createHoidEpubIngestionService({ archive, xml, digest: digestPort });
  const source = Object.freeze({
    sourceId: "fixture-source",
    workId: "tfe",
    editionId: "cosmere-epub-merged-v1",
    sourceGroup: "cosmere.epub" as const,
  });

  return { service, source, archive, xml, entries, contents };
}

describe("offline EPUB ingestion core", () => {
  it("inspects package metadata and navigation without returning source prose", async () => {
    const fixture = makeFixture();
    const result = await fixture.service.inspectPackage(fixture.source);

    expect(result.status).toBe("candidate");
    if (result.status !== "candidate") return;
    expect(result.candidate).toMatchObject({
      status: "candidate-only",
      workId: "tfe",
      declaredEditionId: "cosmere-epub-merged-v1",
      sourceGroup: "cosmere.epub",
      editionBinding: "catalogue-navigation-digest-match",
      packageVersion: "3.0",
      title: "Obra sintética de prueba",
      language: "es",
      archiveEntryCount: 6,
      manifestItemCount: 3,
      spineItemCount: 2,
      navigationEntryCount: 1,
      navigationXhtmlTargetCount: 1,
    });
    expect(result.candidate.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.candidate).not.toHaveProperty("content");
    expect(result.candidate).not.toHaveProperty("chapterText");
    expect(result.candidate).not.toHaveProperty("body");
    expect(Object.isFrozen(result.candidate)).toBe(true);
  });

  it("does not mutate catalogue coverage or production authorization state", async () => {
    const fixture = makeFixture();
    const before = getHoidSourceCoverageReport();
    const result = await fixture.service.inspectPackage(fixture.source);
    expect(result.status).toBe("candidate");
    expect(getHoidSourceCoverageReport()).toEqual(before);
    expect(before.editorial.productionKnowledgeEntryCount).toBe(0);
    expect(before.editorial.approvedClaimCount).toBe(0);
  });

  it("rejects a navigation document that does not match the catalogue edition fingerprint", async () => {
    const fixture = makeFixture("0".repeat(64));
    await expect(fixture.service.inspectPackage(fixture.source))
      .resolves.toEqual({ status: "rejected", reason: "edition-navigation-mismatch" });
  });

  it("inspects one navigation-backed XHTML body and returns only its digest", async () => {
    const fixture = makeFixture();
    const packageResult = await fixture.service.inspectPackage(fixture.source);
    expect(packageResult.status).toBe("candidate");
    if (packageResult.status !== "candidate") return;

    const chapterResult = await fixture.service.inspectChapterDocument(
      packageResult.candidate,
      "Text/chapter-1.xhtml#chapter-1",
    );
    expect(chapterResult.status).toBe("candidate");
    if (chapterResult.status !== "candidate") return;
    expect(chapterResult.candidate).toMatchObject({
      status: "candidate-only",
      workId: "tfe",
      declaredEditionId: "cosmere-epub-merged-v1",
      navigationHref: "Text/chapter-1.xhtml#chapter-1",
      byteLength: fixture.contents.get("OEBPS/Text/chapter-1.xhtml")!.byteLength,
    });
    expect(chapterResult.candidate.documentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(chapterResult.candidate.candidateFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(chapterResult.candidate).not.toHaveProperty("text");
    expect(chapterResult.candidate).not.toHaveProperty("bytes");
    expect(chapterResult.candidate).not.toHaveProperty("content");
    expect(fixture.xml.validateXhtml).toHaveBeenCalledTimes(1);
  });

  it("rejects a chapter that exists in the manifest but is absent from navigation", async () => {
    const fixture = makeFixture();
    const packageResult = await fixture.service.inspectPackage(fixture.source);
    if (packageResult.status !== "candidate") throw new Error("Expected package candidate");
    await expect(fixture.service.inspectChapterDocument(
      packageResult.candidate,
      "Text/chapter-2.xhtml",
    )).resolves.toEqual({ status: "rejected", reason: "chapter-not-in-navigation" });
  });

  it("rejects a forged or cross-service package report", async () => {
    const first = makeFixture();
    const second = makeFixture();
    const packageResult = await first.service.inspectPackage(first.source);
    if (packageResult.status !== "candidate") throw new Error("Expected package candidate");
    const forged = Object.freeze({ ...packageResult.candidate });
    await expect(second.service.inspectChapterDocument(forged, "Text/chapter-1.xhtml"))
      .resolves.toEqual({ status: "rejected", reason: "report-not-issued-here" });
  });

  it("detects package replacement between package inspection and chapter inspection", async () => {
    const fixture = makeFixture();
    const packageResult = await fixture.service.inspectPackage(fixture.source);
    if (packageResult.status !== "candidate") throw new Error("Expected package candidate");
    const previous = fixture.contents.get("OEBPS/package.opf")!;
    fixture.contents.set("OEBPS/package.opf", new Uint8Array(previous.byteLength).fill(65));

    await expect(fixture.service.inspectChapterDocument(
      packageResult.candidate,
      "Text/chapter-1.xhtml",
    )).resolves.toEqual({ status: "rejected", reason: "source-changed" });
  });

  it("detects container replacement between package inspection and chapter inspection", async () => {
    const fixture = makeFixture();
    const packageResult = await fixture.service.inspectPackage(fixture.source);
    if (packageResult.status !== "candidate") throw new Error("Expected package candidate");
    const previous = fixture.contents.get("META-INF/container.xml")!;
    fixture.contents.set("META-INF/container.xml", new Uint8Array(previous.byteLength).fill(66));

    await expect(fixture.service.inspectChapterDocument(
      packageResult.candidate,
      "Text/chapter-1.xhtml",
    )).resolves.toEqual({ status: "rejected", reason: "source-changed" });
  });

  it("rejects work, source-group or edition declarations outside the canonical catalogue", async () => {
    const fixture = makeFixture();
    await expect(fixture.service.inspectPackage({
      ...fixture.source,
      workId: "unknown-work",
    })).resolves.toEqual({ status: "rejected", reason: "invalid-source-descriptor" });
    await expect(fixture.service.inspectPackage({
      ...fixture.source,
      sourceGroup: "roshar-epubs",
    })).resolves.toEqual({ status: "rejected", reason: "invalid-source-descriptor" });
    await expect(fixture.service.inspectPackage({
      ...fixture.source,
      editionId: "wrong-edition",
    })).resolves.toEqual({ status: "rejected", reason: "invalid-source-descriptor" });
  });

  it("rejects source descriptors with getters without evaluating them", async () => {
    const fixture = makeFixture();
    let getterCalled = false;
    const descriptor = Object.defineProperties({}, {
      sourceId: { enumerable: true, get: () => { getterCalled = true; return "fixture-source"; } },
      workId: { enumerable: true, value: "tfe" },
      editionId: { enumerable: true, value: "cosmere-epub-merged-v1" },
      sourceGroup: { enumerable: true, value: "cosmere.epub" },
    });
    await expect(fixture.service.inspectPackage(descriptor))
      .resolves.toEqual({ status: "rejected", reason: "invalid-source-descriptor" });
    expect(getterCalled).toBe(false);
    expect(fixture.archive.listEntries).not.toHaveBeenCalled();
  });

  it("rejects parser arrays with custom prototypes without evaluating inherited getters", async () => {
    const fixture = makeFixture();
    let getterCalled = false;
    const rootfiles = [{
      fullPath: "OEBPS/package.opf",
      mediaType: "application/oebps-package+xml",
    }];
    Object.setPrototypeOf(rootfiles, {
      get 0() {
        getterCalled = true;
        return { fullPath: "OEBPS/package.opf", mediaType: "application/oebps-package+xml" };
      },
    });
    fixture.xml.parseContainerXml = vi.fn(async () => ({ rootfiles }));
    await expect(fixture.service.inspectPackage(fixture.source))
      .resolves.toEqual({ status: "rejected", reason: "container-invalid" });
    expect(getterCalled).toBe(false);
  });

  it("rejects traversal, external URLs, encoded separators and malformed hrefs", () => {
    expect(resolveHoidEpubHref("OEBPS/nav.xhtml", "../Text/chapter.xhtml#part")).toBe("Text/chapter.xhtml");
    expect(resolveHoidEpubHref("OEBPS/nav.xhtml", "../../outside.xhtml")).toBeNull();
    expect(resolveHoidEpubHref("OEBPS/nav.xhtml", "https://example.invalid/chapter.xhtml")).toBeNull();
    expect(resolveHoidEpubHref("OEBPS/nav.xhtml", "Text%2fchapter.xhtml")).toBeNull();
    expect(resolveHoidEpubHref("OEBPS/nav.xhtml", "Text/%E0%A4%A.xhtml")).toBeNull();
  });

  it("rejects an invalid mimetype entry before parsing XML", async () => {
    const fixture = makeFixture();
    fixture.entries[0] = Object.freeze({ ...fixture.entries[0], path: "not-mimetype" });
    await expect(fixture.service.inspectPackage(fixture.source))
      .resolves.toEqual({ status: "rejected", reason: "mimetype-invalid" });
    expect(fixture.xml.parseContainerXml).not.toHaveBeenCalled();
  });

  it("rejects duplicate archive paths and case-fold collisions", async () => {
    const fixture = makeFixture();
    fixture.entries.push(Object.freeze({
      ...fixture.entries[fixture.entries.length - 1],
      path: "OEBPS/TEXT/CHAPTER-2.XHTML",
      ordinal: fixture.entries.length,
    }));
    await expect(fixture.service.inspectPackage(fixture.source))
      .resolves.toEqual({ status: "rejected", reason: "duplicate-archive-path" });
  });

  it("rejects compression bombs before reading package documents", async () => {
    const fixture = makeFixture();
    const index = fixture.entries.findIndex(entry => entry.path === "OEBPS/Text/chapter-1.xhtml");
    fixture.entries[index] = Object.freeze({
      ...fixture.entries[index],
      compressedSize: 1,
      uncompressedSize: 1000,
    });
    await expect(fixture.service.inspectPackage(fixture.source))
      .resolves.toEqual({ status: "rejected", reason: "compression-ratio-limit" });
  });

  it("supports explicit ZIP directory entries without confusing them with files", async () => {
    const fixture = makeFixture();
    fixture.entries.splice(1, 0, Object.freeze({
      path: "META-INF/",
      ordinal: 1,
      kind: "directory" as const,
      compressionMethod: "stored" as const,
      compressedSize: 0,
      uncompressedSize: 0,
      encrypted: false,
    }));
    for (let index = 2; index < fixture.entries.length; index += 1) {
      fixture.entries[index] = Object.freeze({ ...fixture.entries[index], ordinal: index });
    }
    const result = await fixture.service.inspectPackage(fixture.source);
    expect(result.status).toBe("candidate");
  });


  it("allows a ZIP directory entry before the first file while keeping mimetype first among files", async () => {
    const fixture = makeFixture();
    fixture.entries.unshift(Object.freeze({
      path: "META-INF/",
      ordinal: 0,
      kind: "directory" as const,
      compressionMethod: "stored" as const,
      compressedSize: 0,
      uncompressedSize: 0,
      encrypted: false,
    }));
    for (let index = 0; index < fixture.entries.length; index += 1) {
      fixture.entries[index] = Object.freeze({ ...fixture.entries[index], ordinal: index });
    }
    const result = await fixture.service.inspectPackage(fixture.source);
    expect(result.status).toBe("candidate");
  });

  it("uses the EPUB 2 NCX fallback only when a valid spine toc id exists", async () => {
    const fixture = makeFixture();
    const ncxBytes = bytes("<ncx/>");
    fixture.contents.set("OEBPS/toc.ncx", ncxBytes);
    fixture.entries.push(Object.freeze({
      path: "OEBPS/toc.ncx",
      ordinal: fixture.entries.length,
      kind: "file",
      compressionMethod: "deflated",
      compressedSize: Math.max(1, Math.ceil(ncxBytes.byteLength / 2)),
      uncompressedSize: ncxBytes.byteLength,
      encrypted: false,
    }));
    const epub2Package: HoidEpubPackageDocument = {
      ...packageDocument,
      version: "2.0",
      manifestItems: [
        ...packageDocument.manifestItems.filter(item => item.id !== "nav"),
        { id: "ncx", href: "toc.ncx", mediaType: "application/x-dtbncx+xml", properties: [] },
      ],
      spineTocId: "ncx",
    };
    fixture.xml.parsePackageDocument = vi.fn(async () => epub2Package);
    fixture.xml.parseNavigationDocument = vi.fn(async (_data: Uint8Array, format: "epub3-nav" | "epub2-ncx") => {
      expect(format).toBe("epub2-ncx");
      return navigation;
    });
    const result = await fixture.service.inspectPackage(fixture.source);
    expect(result.status).toBe("candidate");
  });

  it("rejects archive entry paths that attempt to escape the package root", async () => {
    const fixture = makeFixture();
    fixture.entries[2] = Object.freeze({ ...fixture.entries[2], path: "../outside.opf" });
    await expect(fixture.service.inspectPackage(fixture.source))
      .resolves.toEqual({ status: "rejected", reason: "unsafe-archive-path" });
  });

  it("rejects multiple package rootfiles rather than selecting one implicitly", async () => {
    const fixture = makeFixture();
    fixture.xml.parseContainerXml = vi.fn(async () => ({
      rootfiles: [
        { fullPath: "OEBPS/package.opf", mediaType: "application/oebps-package+xml" },
        { fullPath: "OEBPS/alternate.opf", mediaType: "application/oebps-package+xml" },
      ],
    }));
    await expect(fixture.service.inspectPackage(fixture.source))
      .resolves.toEqual({ status: "rejected", reason: "multiple-rootfiles" });
  });

  it("rejects navigation targets absent from the OPF manifest", async () => {
    const fixture = makeFixture();
    fixture.xml.parseNavigationDocument = vi.fn(async () => [{
      label: "Capítulo 1",
      href: "Text/not-in-manifest.xhtml",
      children: [],
    }]);
    await expect(fixture.service.inspectPackage(fixture.source))
      .resolves.toEqual({ status: "rejected", reason: "navigation-target-unresolved" });
  });

  it("rejects XHTML that the injected parser cannot validate", async () => {
    const fixture = makeFixture();
    fixture.xml.validateXhtml = vi.fn(async () => false);
    const packageResult = await fixture.service.inspectPackage(fixture.source);
    if (packageResult.status !== "candidate") throw new Error("Expected package candidate");
    await expect(fixture.service.inspectChapterDocument(
      packageResult.candidate,
      "Text/chapter-1.xhtml",
    )).resolves.toEqual({ status: "rejected", reason: "xhtml-invalid" });
  });

  it("rejects encrypted and unsupported archive entries", async () => {
    const encrypted = makeFixture();
    encrypted.entries[2] = Object.freeze({ ...encrypted.entries[2], encrypted: true });
    await expect(encrypted.service.inspectPackage(encrypted.source))
      .resolves.toEqual({ status: "rejected", reason: "encrypted-entry" });

    const unsupported = makeFixture();
    unsupported.entries[2] = Object.freeze({
      ...unsupported.entries[2],
      compressionMethod: "unsupported",
    });
    await expect(unsupported.service.inspectPackage(unsupported.source))
      .resolves.toEqual({ status: "rejected", reason: "unsupported-compression" });
  });
});
