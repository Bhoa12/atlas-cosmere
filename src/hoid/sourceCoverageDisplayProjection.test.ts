import { describe, expect, it } from "vitest";
import { getHoidSourceCoverageDisplayProjection } from "./sourceCoverageDisplayProjection";

describe("Hoid metadata-only source coverage display projection", () => {
  it("reports the complete 24-work catalogue without asserting source-byte access", () => {
    const result = getHoidSourceCoverageDisplayProjection();

    expect(result).toMatchObject({
      schemaVersion: 1,
      scope: "metadata-only",
      integrity: "consistent",
      catalogue: {
        totalWorks: 24,
        cosmereWorks: 17,
        rosharWorks: 7,
        accessStatus: "not-asserted",
        sourceContentIncluded: false,
      },
      authorizationEffect: "none",
      selectedWorkStatus: "not-requested",
      selectedWork: null,
    });
  });

  it("distinguishes navigation locators, inspected chapter documents and editorial approval", () => {
    const result = getHoidSourceCoverageDisplayProjection();

    expect(result.navigation).toEqual({
      worksWithVerifiedLocators: 20,
      totalVerifiedChapterLocators: 1110,
    });
    expect(result.chapterBodies).toEqual({
      worksWithInspectedDocuments: 8,
      totalInspectedChapterDocuments: 114,
    });
    expect(result.editorial).toEqual({
      worksWithStagedSummaries: 4,
      stagedSummaryCount: 69,
      pendingReviewSummaryCount: 69,
      draftRegistryStatus: "pending-review",
      productionKnowledgeEntryCount: 0,
      approvedClaimCount: 0,
      productionRegistryStatus: "empty",
    });
  });

  it("projects El Imperio Final chapter receipts without exposing XHTML bytes or prose", () => {
    const result = getHoidSourceCoverageDisplayProjection("tfe");

    expect(result.selectedWorkStatus).toBe("ready");
    expect(result.selectedWork).toMatchObject({
      workId: "tfe",
      title: "El Imperio Final",
      manifest: { status: "ready", coverage: "verified-numeric-chapters" },
      navigation: { kind: "numeric-chapters", status: "complete" },
      inspectedChapterNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      inspectedChapterDocumentCount: 11,
      stagedSummaryChapterNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11],
      stagedSummaryCount: 10,
      pendingReviewSummaryCount: 10,
      productionKnowledgeEntryCount: 0,
    });
  });

  it("projects El Camino de los Reyes receipts independently from its reading manifest", () => {
    const result = getHoidSourceCoverageDisplayProjection("twok");

    expect(result.selectedWork).toMatchObject({
      workId: "twok",
      title: "El Camino de los Reyes",
      inspectedChapterDocumentCount: 23,
      stagedSummaryCount: 22,
      pendingReviewSummaryCount: 22,
      productionKnowledgeEntryCount: 0,
    });
    expect(result.selectedWork?.inspectedChapterNumbers).toEqual(
      Array.from({ length: 23 }, (_, index) => index + 1),
    );
  });

  it("keeps ambiguous chapter numbering explicitly partial", () => {
    const result = getHoidSourceCoverageDisplayProjection("elantris");

    expect(result.selectedWork?.navigation).toMatchObject({
      kind: "ambiguous-numbered-chapters",
      status: "partial",
      chapterCount: 63,
      safeNumericProgressThroughChapter: 47,
      ambiguousChapterNumbers: [48, 51, 57],
      verifiedLocatorCount: 47,
    });
    expect(result.selectedWork?.inspectedChapterDocumentCount).toBe(0);
  });

  it("keeps White Sand volume segmentation blocked", () => {
    const result = getHoidSourceCoverageDisplayProjection("white-sand-1");

    expect(result.selectedWork?.navigation).toMatchObject({
      kind: "requires-volume-segmentation",
      status: "blocked",
      verifiedLocatorCount: 0,
    });
    expect(result.selectedWork?.manifest).toEqual({
      status: "unavailable",
      unitCount: null,
      coverage: null,
      reason: "segmentation-unverified",
    });
  });

  it("keeps Arcanum section segmentation blocked", () => {
    const result = getHoidSourceCoverageDisplayProjection("arcanum");

    expect(result.selectedWork?.navigation).toMatchObject({
      kind: "collection-sections",
      status: "blocked",
      verifiedLocatorCount: 0,
    });
  });

  it("does not silently map an unknown or malformed selection to another work", () => {
    expect(getHoidSourceCoverageDisplayProjection("unknown-work")).toMatchObject({
      selectedWorkStatus: "unknown-work",
      selectedWork: null,
    });
    expect(getHoidSourceCoverageDisplayProjection(" tfe ")).toMatchObject({
      selectedWorkStatus: "unknown-work",
      selectedWork: null,
    });
    expect(getHoidSourceCoverageDisplayProjection({ bookId: "tfe" })).toMatchObject({
      selectedWorkStatus: "unknown-work",
      selectedWork: null,
    });
  });

  it("exposes only safe chapter-number metadata for staged summaries", () => {
    const result = getHoidSourceCoverageDisplayProjection("dawnshard");

    expect(result.selectedWork?.stagedSummaryChapterNumbers).toEqual(
      Array.from({ length: 18 }, (_, index) => index + 1),
    );
    expect(result.selectedWork?.pendingReviewSummaryCount).toBe(18);
    expect(result.selectedWork?.productionKnowledgeEntryCount).toBe(0);
  });

  it("never exposes summaries, source text, locators, document hashes or fingerprints", () => {
    const result = getHoidSourceCoverageDisplayProjection("twok");
    const serialized = JSON.stringify(result);

    for (const forbidden of [
      '"summary":',
      '"text":',
      "documentSha256",
      "navigationSha256",
      "locatorId",
      "sourceFingerprint",
      "privateEpubBytes",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(result.scope).toBe("metadata-only");
    expect(result.catalogue.sourceContentIncluded).toBe(false);
    expect(result.catalogue.accessStatus).toBe("not-asserted");
    expect(result.authorizationEffect).toBe("none");
  });

  it("returns immutable nested arrays and records", () => {
    const result = getHoidSourceCoverageDisplayProjection("twok");

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.catalogue)).toBe(true);
    expect(Object.isFrozen(result.selectedWork)).toBe(true);
    expect(Object.isFrozen(result.selectedWork?.inspectedChapterNumbers)).toBe(true);
    expect(Object.isFrozen(result.selectedWork?.navigation.ambiguousChapterNumbers)).toBe(true);
  });
});
