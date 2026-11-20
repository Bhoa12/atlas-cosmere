import { describe, expect, it } from "vitest";
import { getHoidSourceCoverageReport } from "./sourceCoverage";
import { getVerifiedChapterDocumentNumbers } from "./verifiedChapterDocuments";

function work(id: string) {
  const result = getHoidSourceCoverageReport().works.find(candidate => candidate.workId === id);
  if (!result) throw new Error(`Missing source coverage for ${id}`);
  return result;
}

describe("Hoid metadata-only source coverage", () => {
  it("covers the complete supplied 24-work bibliography without implying narrative inspection", () => {
    const report = getHoidSourceCoverageReport();

    expect(report.integrity).toBe("consistent");
    expect(report.scope).toBe("metadata-only");
    expect(report.catalogue).toEqual({ totalWorks: 24, cosmereWorks: 17, rosharWorks: 7 });
    expect(report.works).toHaveLength(24);
  });

  it("distinguishes verified navigation locators from inspected chapter bodies", () => {
    const report = getHoidSourceCoverageReport();

    expect(report.navigation).toEqual({
      worksWithVerifiedLocators: 20,
      totalVerifiedChapterLocators: 1106,
    });
    expect(report.chapterBodies).toEqual({
      worksWithInspectedDocuments: 4,
      totalInspectedChapterDocuments: 43,
    });
  });

  it("reports only the four works with individually inspected chapter documents", () => {
    expect(work("tfe").inspectedChapterNumbers).toEqual([1, 2, 3, 4, 5]);
    expect(work("twok").inspectedChapterNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(work("edgedancer").inspectedChapterNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(work("dawnshard").inspectedChapterNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);

    for (const id of ["woa", "hoa", "aol", "sos", "bom", "tlm", "warbreaker", "elantris", "tress", "yumi", "sunlit", "isles", "arcanum", "wor", "ob", "row", "sawt"]) {
      expect(work(id).inspectedChapterDocumentCount).toBe(0);
    }
  });

  it("keeps the current 43 summaries in pending review and production empty", () => {
    const report = getHoidSourceCoverageReport();

    expect(report.editorial).toEqual({
      worksWithStagedSummaries: 4,
      stagedSummaryCount: 43,
      pendingReviewSummaryCount: 43,
      draftRegistryStatus: "pending-review",
      productionKnowledgeEntryCount: 0,
      approvedClaimCount: 0,
      productionRegistryStatus: "empty",
    });
    expect(work("tfe").stagedSummaryChapterNumbers).toEqual([1, 2, 3, 4, 5]);
    expect(work("twok").stagedSummaryChapterNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(work("edgedancer").stagedSummaryChapterNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(work("dawnshard").stagedSummaryChapterNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it("reports Elantris and Viento y Verdad as partial rather than complete", () => {
    const elantris = work("elantris").navigation;
    expect(elantris).toMatchObject({
      kind: "ambiguous-numbered-chapters",
      status: "partial",
      chapterCount: 63,
      safeNumericProgressThroughChapter: 47,
      ambiguousChapterNumbers: [48, 51, 57],
      verifiedLocatorCount: 47,
      manifestUnitCount: 47,
      safePrefixComplete: true,
    });

    const sawt = work("sawt").navigation;
    expect(sawt).toMatchObject({
      kind: "ambiguous-numbered-chapters",
      status: "partial",
      chapterCount: 147,
      safeNumericProgressThroughChapter: 11,
      ambiguousChapterNumbers: [12, 14],
      verifiedLocatorCount: 11,
      manifestUnitCount: 11,
      safePrefixComplete: true,
    });
  });

  it("keeps White Sand volume segmentation and Arcanum section segmentation blocked", () => {
    for (const id of ["white-sand-1", "white-sand-2", "white-sand-3"]) {
      expect(work(id).navigation).toMatchObject({
        kind: "requires-volume-segmentation",
        status: "blocked",
        verifiedLocatorCount: 0,
      });
      expect(work(id).readingManifest).toEqual({
        status: "unavailable",
        reason: "segmentation-unverified",
      });
    }

    expect(work("arcanum").navigation).toMatchObject({
      kind: "collection-sections",
      status: "blocked",
      verifiedLocatorCount: 0,
    });
  });

  it("does not expose summary prose, document hashes or chapter titles", () => {
    const report = getHoidSourceCoverageReport();
    for (const entry of report.works) {
      expect(entry).not.toHaveProperty("summary");
      expect(entry).not.toHaveProperty("documentSha256");
      expect(entry).not.toHaveProperty("navigationSha256");
      expect(entry).not.toHaveProperty("chapterTitles");
    }
    expect(JSON.stringify(report)).not.toContain("Rysn recibe");
  });

  it("returns immutable, sorted inspected chapter-number snapshots", () => {
    const numbers = getVerifiedChapterDocumentNumbers("twok");
    expect(numbers).toEqual(work("twok").inspectedChapterNumbers);
    expect(Object.isFrozen(numbers)).toBe(true);
    expect(getVerifiedChapterDocumentNumbers("unknown-work")).toEqual([]);
    expect(Object.isFrozen(getVerifiedChapterDocumentNumbers(null))).toBe(true);

    const report = getHoidSourceCoverageReport();
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.works)).toBe(true);
    expect(Object.isFrozen(report.works[0])).toBe(true);
    expect(Object.isFrozen(report.works[0].inspectedChapterNumbers)).toBe(true);
  });
});
