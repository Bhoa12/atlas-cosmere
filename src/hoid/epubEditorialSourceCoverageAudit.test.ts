import { describe, expect, it, vi } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  auditHoidEpubEditorialSourceCoverage,
} from "./epubEditorialSourceCoverageAudit";
import type {
  HoidEditorialSourceDocumentAccessRequest,
} from "./editorialClaimPromotionPreflight";
import {
  getVerifiedChapterDocumentNumbers,
} from "./verifiedChapterDocuments";

function port(
  inspectChapter: (request: HoidEditorialSourceDocumentAccessRequest) => Promise<unknown>,
) {
  return Object.freeze({ inspectChapter: vi.fn(inspectChapter) });
}

describe("Hoid local EPUB editorial source coverage audit", () => {
  it("rechecks every registered chapter digest and reports only chapter numbers and counts", async () => {
    const workId = "edgedancer";
    const numbers = getVerifiedChapterDocumentNumbers(workId);
    const inspect = port(async request => ({
      status: "available",
      documentSha256: request.expectedDocumentSha256,
    }));
    const progress: number[] = [];

    const result = await auditHoidEpubEditorialSourceCoverage(
      inspect,
      workId,
      new AbortController().signal,
      value => progress.push(value.checkedChapterCount),
    );

    expect(result).toMatchObject({
      status: "completed",
      workId,
      scope: "registered-digest-chapters-only",
      totalAllowlistedChapterCount: numbers.length,
      checkedChapterCount: numbers.length,
      availableChapterNumbers: numbers,
      unavailableChapterNumbers: [],
      sourceTextReturned: false,
      sourceTextPersisted: false,
      providerEgress: "none",
    });
    expect(inspect.inspectChapter).toHaveBeenCalledTimes(numbers.length);
    expect(progress[progress.length - 1]).toBe(numbers.length);
    for (const call of inspect.inspectChapter.mock.calls) {
      expect(Object.keys(call[0]).sort()).toEqual([
        "bookId",
        "chapterNumber",
        "editionId",
        "expectedDocumentSha256",
        "locatorId",
        "navigationSha256",
      ]);
    }
    expect(JSON.stringify(result)).not.toContain("xhtml");
    expect(JSON.stringify(result)).not.toContain("file://");
  });

  it("counts mismatched or expanded responses as unavailable without leaking their contents", async () => {
    const inspect = port(async () => ({
      status: "available",
      documentSha256: "0".repeat(64),
      extractedText: "private passage must not escape",
      fileUri: "file:///private/cosmere.epub",
    }));

    const result = await auditHoidEpubEditorialSourceCoverage(
      inspect,
      "edgedancer",
      new AbortController().signal,
    );

    expect(result).toMatchObject({
      status: "completed",
      availableChapterNumbers: [],
    });
    if (result.status !== "completed") return;
    expect(result.unavailableChapterNumbers.length).toBe(result.totalAllowlistedChapterCount);
    expect(JSON.stringify(result)).not.toContain("private passage");
    expect(JSON.stringify(result)).not.toContain("/private/cosmere.epub");
  });

  it("fails closed for unknown works and malformed source ports", async () => {
    const validPort = port(async () => ({ status: "available", documentSha256: "a".repeat(64) }));
    expect(await auditHoidEpubEditorialSourceCoverage(
      validPort,
      "unknown-work",
      new AbortController().signal,
    )).toEqual({ status: "unavailable", reason: "unknown-work" });

    const malformed = Object.defineProperty({}, "inspectChapter", {
      enumerable: true,
      get() { throw new Error("must not execute"); },
    });
    expect(await auditHoidEpubEditorialSourceCoverage(
      malformed,
      "edgedancer",
      new AbortController().signal,
    )).toEqual({ status: "unavailable", reason: "invalid-port" });
  });

  it("reports when a catalogued work has no registered chapter-body digest", async () => {
    const work = HOID_SOURCE_BIBLIOGRAPHY.find(
      item => getVerifiedChapterDocumentNumbers(item.id).length === 0,
    );
    expect(work).toBeDefined();
    if (!work) return;
    const inspect = port(async () => ({ status: "available", documentSha256: "a".repeat(64) }));

    const result = await auditHoidEpubEditorialSourceCoverage(
      inspect,
      work.id,
      new AbortController().signal,
    );

    expect(result).toEqual({ status: "unavailable", reason: "no-verified-chapters" });
    expect(inspect.inspectChapter).not.toHaveBeenCalled();
  });

  it("discards partial audit output when the source session is cancelled", async () => {
    const controller = new AbortController();
    const inspect = port(async () => {
      controller.abort();
      return { status: "available", documentSha256: "a".repeat(64) };
    });

    const result = await auditHoidEpubEditorialSourceCoverage(
      inspect,
      "edgedancer",
      controller.signal,
    );

    expect(result).toMatchObject({
      status: "cancelled",
      workId: "edgedancer",
      checkedChapterCount: 0,
    });
  });

  it("does not allow progress observers to interrupt or alter the audit", async () => {
    const inspect = port(async request => ({
      status: "available",
      documentSha256: request.expectedDocumentSha256,
    }));

    const result = await auditHoidEpubEditorialSourceCoverage(
      inspect,
      "edgedancer",
      new AbortController().signal,
      () => { throw new Error("observer failure"); },
    );

    expect(result.status).toBe("completed");
    expect(inspect.inspectChapter).toHaveBeenCalled();
  });
});
