import { describe, expect, it, vi } from "vitest";
import {
  createHoidEpubEditorialSourceAccessRouter,
  type HoidEpubEditorialSourceAccessRouterResult,
} from "./epubEditorialSourceAccess";
import type {
  HoidEpubPackageInspectionCandidate,
} from "./epubIngestion";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentSha256 } from "./verifiedChapterDocuments";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const SHA_D = "d".repeat(64);
const SHA_E = "e".repeat(64);
const SHA_F = "f".repeat(64);

function fixture(
  workId = "edgedancer",
  sourceId = "epub-source-1",
  isCurrent: () => boolean = () => true,
) {
  const manifestResult = getHoidReadingManifest(workId);
  if (manifestResult.status !== "ready") throw new Error("Fixture manifest unavailable");
  const manifest = manifestResult.manifest;
  const chapterNumber = 1;
  const unit = manifest.units.find(item => item.chapterNumber === chapterNumber);
  if (!unit?.locatorId) throw new Error("Fixture locator unavailable");
  const expectedDocumentSha256 = getVerifiedChapterDocumentSha256(
    workId,
    manifest.editionId,
    manifest.navigationSha256,
    chapterNumber,
  );
  if (!expectedDocumentSha256) throw new Error("Fixture document digest unavailable");
  const work = HOID_SOURCE_BIBLIOGRAPHY.find(item => item.id === workId);
  if (!work) throw new Error("Fixture work unavailable");

  const packageCandidate = Object.freeze({
    status: "candidate-only",
    sourceId,
    workId,
    declaredEditionId: manifest.editionId,
    sourceGroup: work.sourceGroup,
    editionBinding: "catalogue-navigation-digest-match",
    packageVersion: "3.0",
    title: work.title,
    language: "es",
    uniqueIdentifier: "urn:hoid:test:edition",
    archiveEntryCount: 128,
    manifestItemCount: 48,
    spineItemCount: 42,
    navigationEntryCount: manifest.units.length,
    navigationXhtmlTargetCount: manifest.units.length,
    archiveInventorySha256: SHA_A,
    mimetypeSha256: SHA_B,
    containerDocumentSha256: SHA_C,
    packageDocumentSha256: SHA_D,
    navigationDocumentSha256: manifest.navigationSha256,
    sourceFingerprint: SHA_E,
  }) as HoidEpubPackageInspectionCandidate;

  const href = unit.locatorId.split(":").slice(3).join(":");
  const chapterCandidate = Object.freeze({
    status: "candidate-only",
    workId,
    declaredEditionId: manifest.editionId,
    sourceGroup: work.sourceGroup,
    navigationHref: href,
    byteLength: 2_048,
    documentSha256: expectedDocumentSha256,
    navigationDocumentSha256: manifest.navigationSha256,
    packageSourceFingerprint: SHA_E,
    candidateFingerprint: SHA_F,
  });

  const inspectChapterDocument = vi.fn(async () => Object.freeze({
    status: "candidate",
    candidate: chapterCandidate,
  }));
  const ingestion = Object.freeze({
    inspectPackage: vi.fn(),
    inspectChapterDocument,
    readChapterContent: vi.fn(),
  }) as unknown as HoidEpubIngestionService;
  const session = Object.freeze({
    sourceId,
    packageCandidate,
    ingestion,
    isCurrent,
  });

  return {
    session,
    packageCandidate,
    inspectChapterDocument,
    request: Object.freeze({
      bookId: workId,
      editionId: manifest.editionId,
      navigationSha256: manifest.navigationSha256,
      chapterNumber,
      locatorId: unit.locatorId,
      expectedDocumentSha256,
    }),
    href,
    expectedDocumentSha256,
  };
}

function readyRouter(...sessions: readonly unknown[]): Extract<
  HoidEpubEditorialSourceAccessRouterResult,
  { status: "ready" }
> {
  const result = createHoidEpubEditorialSourceAccessRouter(sessions);
  if (result.status !== "ready") throw new Error("Router fixture unavailable");
  return result;
}

describe("Hoid local EPUB editorial source access router", () => {
  it("revalidates an exact chapter through the existing local ingestion service", async () => {
    const value = fixture();
    const router = readyRouter(value.session);
    const signal = new AbortController().signal;

    const result = await router.port.inspectChapter(value.request, { signal });

    expect(result).toEqual({
      status: "available",
      documentSha256: value.expectedDocumentSha256,
    });
    expect(value.inspectChapterDocument).toHaveBeenCalledTimes(1);
    expect(value.inspectChapterDocument).toHaveBeenCalledWith(
      value.packageCandidate,
      value.href,
      signal,
    );
  });

  it("returns only an availability flag and digest, never source content or file identity", async () => {
    const value = fixture();
    const router = readyRouter(value.session);
    const result = await router.port.inspectChapter(
      value.request,
      { signal: new AbortController().signal },
    );

    expect(Object.keys(result).sort()).toEqual(["documentSha256", "status"]);
    expect(JSON.stringify(result)).not.toContain("bytes");
    expect(JSON.stringify(result)).not.toContain("text");
    expect(JSON.stringify(result)).not.toContain("epub-source-1");
    expect(JSON.stringify(result)).not.toContain(value.href);
  });

  it("routes by work ID and keeps multi-work EPUB candidates isolated", async () => {
    const edgedancer = fixture("edgedancer", "shared-cosm-archive");
    const finalEmpire = fixture("tfe", "shared-cosm-archive");
    const router = readyRouter(edgedancer.session, finalEmpire.session);

    const [first, second] = await Promise.all([
      router.port.inspectChapter(edgedancer.request, { signal: new AbortController().signal }),
      router.port.inspectChapter(finalEmpire.request, { signal: new AbortController().signal }),
    ]);

    expect(router.activeWorkCount).toBe(2);
    expect(first).toEqual({ status: "available", documentSha256: edgedancer.expectedDocumentSha256 });
    expect(second).toEqual({ status: "available", documentSha256: finalEmpire.expectedDocumentSha256 });
    expect(edgedancer.inspectChapterDocument).toHaveBeenCalledWith(
      edgedancer.packageCandidate,
      edgedancer.href,
      expect.any(Object),
    );
    expect(finalEmpire.inspectChapterDocument).toHaveBeenCalledWith(
      finalEmpire.packageCandidate,
      finalEmpire.href,
      expect.any(Object),
    );
  });

  it("blocks an unregistered work when no active source session exists", async () => {
    const value = fixture();
    const router = readyRouter(value.session);
    const result = await router.port.inspectChapter(
      Object.freeze({ ...value.request, bookId: "unknown-work" }),
      { signal: new AbortController().signal },
    );

    expect(result).toMatchObject({ status: "unavailable", reason: "source-not-loaded" });
    expect(value.inspectChapterDocument).not.toHaveBeenCalled();
  });

  it("blocks a caller-supplied digest that differs from the sparse inspected-document allowlist", async () => {
    const value = fixture();
    const router = readyRouter(value.session);
    const result = await router.port.inspectChapter(
      Object.freeze({ ...value.request, expectedDocumentSha256: SHA_F }),
      { signal: new AbortController().signal },
    );

    expect(result).toMatchObject({ status: "unavailable", reason: "chapter-document-not-allowlisted" });
    expect(value.inspectChapterDocument).not.toHaveBeenCalled();
  });

  it("does not treat a navigation locator as proof that the chapter body was inspected", async () => {
    const manifestResult = getHoidReadingManifest("tfe");
    if (manifestResult.status !== "ready") throw new Error("Fixture manifest unavailable");
    const unit = manifestResult.manifest.units.find(item => item.chapterNumber === 12);
    if (!unit?.locatorId) throw new Error("Fixture chapter locator unavailable");
    expect(getVerifiedChapterDocumentSha256(
      "tfe",
      manifestResult.manifest.editionId,
      manifestResult.manifest.navigationSha256,
      12,
    )).toBeNull();

    const value = fixture("tfe", "tfe-source");
    const router = readyRouter(value.session);
    const result = await router.port.inspectChapter(Object.freeze({
      ...value.request,
      chapterNumber: 12,
      locatorId: unit.locatorId,
      expectedDocumentSha256: SHA_A,
    }), { signal: new AbortController().signal });

    expect(result).toMatchObject({ status: "unavailable", reason: "chapter-document-not-allowlisted" });
    expect(value.inspectChapterDocument).not.toHaveBeenCalled();
  });

  it("rejects a stale source session before reading the chapter", async () => {
    const value = fixture("edgedancer", "stale-source", () => false);
    const router = readyRouter(value.session);
    const result = await router.port.inspectChapter(
      value.request,
      { signal: new AbortController().signal },
    );

    expect(result).toMatchObject({ status: "unavailable", reason: "source-session-stale" });
    expect(value.inspectChapterDocument).not.toHaveBeenCalled();
  });

  it("rechecks the session after the asynchronous document inspection", async () => {
    let checks = 0;
    const value = fixture("edgedancer", "released-during-read", () => {
      checks += 1;
      return checks === 1;
    });
    const router = readyRouter(value.session);
    const result = await router.port.inspectChapter(
      value.request,
      { signal: new AbortController().signal },
    );

    expect(result).toMatchObject({ status: "unavailable", reason: "source-session-stale" });
    expect(value.inspectChapterDocument).toHaveBeenCalledTimes(1);
  });

  it("propagates cancellation and never publishes a late result", async () => {
    const value = fixture();
    const router = readyRouter(value.session);
    const controller = new AbortController();
    controller.abort();

    const result = await router.port.inspectChapter(value.request, { signal: controller.signal });

    expect(result).toMatchObject({ status: "unavailable", reason: "source-session-stale" });
    expect(value.inspectChapterDocument).not.toHaveBeenCalled();
  });

  it("rejects an ingestion result that attempts to return XHTML or extra fields", async () => {
    const value = fixture();
    const hostileIngestion = Object.freeze({
      inspectPackage: vi.fn(),
      inspectChapterDocument: vi.fn(async () => Object.freeze({
        status: "candidate",
        candidate: Object.freeze({
          status: "candidate-only",
          workId: value.request.bookId,
          declaredEditionId: value.request.editionId,
          sourceGroup: "roshar-epubs",
          navigationHref: value.href,
          byteLength: 2_048,
          documentSha256: value.expectedDocumentSha256,
          navigationDocumentSha256: value.request.navigationSha256,
          packageSourceFingerprint: SHA_E,
          candidateFingerprint: SHA_F,
          xhtml: "<html>private content</html>",
        }),
      })),
      readChapterContent: vi.fn(),
    });
    const hostileSession = Object.freeze({
      ...value.session,
      ingestion: hostileIngestion,
    });
    const router = readyRouter(hostileSession);
    const result = await router.port.inspectChapter(
      value.request,
      { signal: new AbortController().signal },
    );

    expect(result).toMatchObject({ status: "unavailable", reason: "source-inspection-rejected" });
    expect(JSON.stringify(result)).not.toContain("private content");
  });

  it("blocks an ingestion result whose document digest no longer matches the registered digest", async () => {
    const value = fixture();
    const changedIngestion = Object.freeze({
      inspectPackage: vi.fn(),
      inspectChapterDocument: vi.fn(async () => Object.freeze({
        status: "candidate",
        candidate: Object.freeze({
          status: "candidate-only",
          workId: value.request.bookId,
          declaredEditionId: value.request.editionId,
          sourceGroup: "roshar-epubs",
          navigationHref: value.href,
          byteLength: 2_048,
          documentSha256: SHA_F,
          navigationDocumentSha256: value.request.navigationSha256,
          packageSourceFingerprint: SHA_E,
          candidateFingerprint: SHA_A,
        }),
      })),
      readChapterContent: vi.fn(),
    });
    const changedSession = Object.freeze({
      ...value.session,
      ingestion: changedIngestion,
    });
    const router = readyRouter(changedSession);
    const result = await router.port.inspectChapter(
      value.request,
      { signal: new AbortController().signal },
    );

    expect(result).toMatchObject({ status: "unavailable", reason: "source-inspection-rejected" });
  });

  it("rejects duplicate work sessions instead of selecting one ambiguously", () => {
    const first = fixture("edgedancer", "source-a");
    const second = fixture("edgedancer", "source-b");

    expect(createHoidEpubEditorialSourceAccessRouter([first.session, second.session])).toEqual({
      status: "unavailable",
      reason: "duplicate-work",
    });
  });

  it("rejects accessor-backed sessions without invoking getters", () => {
    const value = fixture();
    let invoked = false;
    const hostile = Object.defineProperty({}, "sourceId", {
      enumerable: true,
      get() {
        invoked = true;
        return "source";
      },
    });

    expect(createHoidEpubEditorialSourceAccessRouter([hostile])).toMatchObject({
      status: "unavailable",
      reason: "invalid-sessions",
    });
    expect(invoked).toBe(false);
    expect(value.inspectChapterDocument).not.toHaveBeenCalled();
  });

  it("rejects malformed or over-scoped requests without reading the source", async () => {
    const value = fixture();
    const router = readyRouter(value.session);
    const result = await router.port.inspectChapter(
      Object.freeze({ ...value.request, text: "not allowed" }) as never,
      { signal: new AbortController().signal },
    );

    expect(result).toMatchObject({ status: "unavailable", reason: "invalid-request" });
    expect(value.inspectChapterDocument).not.toHaveBeenCalled();
  });

  it("rejects a package candidate bound to a different source work", () => {
    const value = fixture();
    const mismatchedCandidate = Object.freeze({
      ...value.packageCandidate,
      workId: "tfe",
    });
    const session = Object.freeze({
      ...value.session,
      packageCandidate: mismatchedCandidate,
    });

    expect(createHoidEpubEditorialSourceAccessRouter([session])).toMatchObject({
      status: "unavailable",
      reason: "invalid-sessions",
    });
  });
});
