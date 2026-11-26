import {
  getHoidSourceCoverageReport,
  type HoidSourceNavigationCoverage,
  type HoidSourceWorkCoverage,
} from "./sourceCoverage";

export type HoidSourceCoverageDisplayWork = Readonly<{
  workId: string;
  title: string;
  sourceGroup: "cosmere.epub" | "roshar-epubs";
  editionId: string | null;
  manifest: Readonly<{
    status: "ready" | "unavailable";
    unitCount: number | null;
    coverage: "verified-numeric-chapters" | "partial-before-ambiguous-chapter" | null;
    reason: "unknown-work" | "segmentation-unverified" | null;
  }>;
  navigation: Readonly<{
    kind: HoidSourceNavigationCoverage["kind"];
    status: HoidSourceNavigationCoverage["status"];
    verifiedLocatorCount: number;
    chapterCount: number | null;
    safeNumericProgressThroughChapter: number | null;
    ambiguousChapterNumbers: readonly number[];
  }>;
  inspectedChapterNumbers: readonly number[];
  inspectedChapterDocumentCount: number;
  stagedSummaryChapterNumbers: readonly number[];
  stagedSummaryCount: number;
  pendingReviewSummaryCount: number;
  productionKnowledgeEntryCount: number;
}>;

export type HoidSourceCoverageDisplayProjection = Readonly<{
  schemaVersion: 1;
  scope: "metadata-only";
  integrity: "consistent" | "inconsistent";
  catalogue: Readonly<{
    totalWorks: number;
    cosmereWorks: number;
    rosharWorks: number;
    accessStatus: "not-asserted";
    sourceContentIncluded: false;
  }>;
  navigation: Readonly<{
    worksWithVerifiedLocators: number;
    totalVerifiedChapterLocators: number;
  }>;
  chapterBodies: Readonly<{
    worksWithInspectedDocuments: number;
    totalInspectedChapterDocuments: number;
  }>;
  editorial: Readonly<{
    worksWithStagedSummaries: number;
    stagedSummaryCount: number;
    pendingReviewSummaryCount: number;
    draftRegistryStatus: "empty" | "pending-review" | "invalid";
    productionKnowledgeEntryCount: number;
    approvedClaimCount: number;
    productionRegistryStatus: "empty" | "ready";
  }>;
  selectedWorkStatus: "not-requested" | "ready" | "unknown-work";
  selectedWork: HoidSourceCoverageDisplayWork | null;
  authorizationEffect: "none";
}>;

function projectWork(work: HoidSourceWorkCoverage): HoidSourceCoverageDisplayWork {
  const manifest = work.readingManifest;
  const navigation = work.navigation;

  return Object.freeze({
    workId: work.workId,
    title: work.title,
    sourceGroup: work.sourceGroup,
    editionId: work.editionId,
    manifest: Object.freeze({
      status: manifest.status,
      unitCount: manifest.status === "ready" ? manifest.unitCount : null,
      coverage: manifest.status === "ready" ? manifest.coverage : null,
      reason: manifest.status === "unavailable" ? manifest.reason : null,
    }),
    navigation: Object.freeze({
      kind: navigation.kind,
      status: navigation.status,
      verifiedLocatorCount: navigation.verifiedLocatorCount,
      chapterCount: "chapterCount" in navigation ? navigation.chapterCount : null,
      safeNumericProgressThroughChapter:
        "safeNumericProgressThroughChapter" in navigation
          ? navigation.safeNumericProgressThroughChapter
          : null,
      ambiguousChapterNumbers: Object.freeze(
        "ambiguousChapterNumbers" in navigation
          ? [...navigation.ambiguousChapterNumbers]
          : [],
      ),
    }),
    inspectedChapterNumbers: Object.freeze([...work.inspectedChapterNumbers]),
    inspectedChapterDocumentCount: work.inspectedChapterDocumentCount,
    stagedSummaryChapterNumbers: Object.freeze([...work.stagedSummaryChapterNumbers]),
    stagedSummaryCount: work.stagedSummaryCount,
    pendingReviewSummaryCount: work.pendingReviewSummaryCount,
    productionKnowledgeEntryCount: work.productionKnowledgeEntryCount,
  });
}

/**
 * Build a UI-safe, metadata-only source readiness projection.
 *
 * The underlying report deliberately does not assert that the private EPUB
 * bytes are currently accessible. Navigation locators and inspected-document
 * fingerprints are structural receipts, not narrative knowledge. Draft
 * summaries and production claims remain separate counts; this projection
 * never exposes their text and cannot authorize an answer.
 */
export function getHoidSourceCoverageDisplayProjection(
  selectedBookId?: unknown,
): HoidSourceCoverageDisplayProjection {
  const report = getHoidSourceCoverageReport();

  let selectedWorkStatus: HoidSourceCoverageDisplayProjection["selectedWorkStatus"] =
    "not-requested";
  let selectedWork: HoidSourceCoverageDisplayWork | null = null;

  if (selectedBookId !== undefined && selectedBookId !== null) {
    if (typeof selectedBookId !== "string" || selectedBookId.length === 0 ||
        selectedBookId !== selectedBookId.trim()) {
      selectedWorkStatus = "unknown-work";
    } else {
      const match = report.works.find(work => work.workId === selectedBookId);
      if (match) {
        selectedWorkStatus = "ready";
        selectedWork = projectWork(match);
      } else {
        selectedWorkStatus = "unknown-work";
      }
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    scope: "metadata-only",
    integrity: report.integrity,
    catalogue: Object.freeze({
      totalWorks: report.catalogue.totalWorks,
      cosmereWorks: report.catalogue.cosmereWorks,
      rosharWorks: report.catalogue.rosharWorks,
      accessStatus: "not-asserted",
      sourceContentIncluded: false,
    }),
    navigation: Object.freeze({
      worksWithVerifiedLocators: report.navigation.worksWithVerifiedLocators,
      totalVerifiedChapterLocators: report.navigation.totalVerifiedChapterLocators,
    }),
    chapterBodies: Object.freeze({
      worksWithInspectedDocuments: report.chapterBodies.worksWithInspectedDocuments,
      totalInspectedChapterDocuments: report.chapterBodies.totalInspectedChapterDocuments,
    }),
    editorial: Object.freeze({
      worksWithStagedSummaries: report.editorial.worksWithStagedSummaries,
      stagedSummaryCount: report.editorial.stagedSummaryCount,
      pendingReviewSummaryCount: report.editorial.pendingReviewSummaryCount,
      draftRegistryStatus: report.editorial.draftRegistryStatus,
      productionKnowledgeEntryCount: report.editorial.productionKnowledgeEntryCount,
      approvedClaimCount: report.editorial.approvedClaimCount,
      productionRegistryStatus: report.editorial.productionRegistryStatus,
    }),
    selectedWorkStatus,
    selectedWork,
    authorizationEffect: "none",
  });
}
