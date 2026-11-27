import { HOID_SOURCE_BIBLIOGRAPHY, type HoidSourceWork } from "./bibliography";
import {
  getHoidChapterKnowledgeReadiness,
  type HoidChapterKnowledgeReadinessReport,
} from "./chapterKnowledgeReadiness";
import { sha256Hex } from "./sha256";

export type HoidChapterKnowledgeCoverageCounts = Readonly<{
  totalReadingUnits: number;
  navigationVerifiedUnitCount: number;
  identityOnlyUnitCount: number;
  bodyDigestRegisteredUnitCount: number;
  pendingReviewSummaryCount: number;
  productionKnowledgeEntryCount: number;
  approvedClaimReferenceCount: number;
  invalidEditorialRecordCount: number;
}>;

export type HoidChapterKnowledgeCoverageWork = Readonly<{
  workId: string;
  title: string;
  sourceGroup: HoidSourceWork["sourceGroup"];
  status: "ready" | "unavailable";
  reason: "manifest-unavailable" | "projection-failed" | null;
  integrity: "consistent" | "inconsistent" | "unavailable";
  counts: HoidChapterKnowledgeCoverageCounts | null;
}>;

export type HoidChapterKnowledgeCoverageReport = Readonly<{
  schemaVersion: 1;
  scope: "metadata-only";
  integrity: "consistent" | "inconsistent" | "unavailable";
  catalogue: Readonly<{
    totalWorks: number;
    cosmereWorks: number;
    rosharWorks: number;
    fingerprint: string;
  }>;
  coverage: Readonly<{
    manifestReadyWorkCount: number;
    manifestUnavailableWorkCount: number;
    totalReadingUnitCount: number;
    navigationVerifiedUnitCount: number;
    identityOnlyUnitCount: number;
    bodyDigestRegisteredUnitCount: number;
    pendingReviewSummaryCount: number;
    productionKnowledgeEntryCount: number;
    approvedClaimReferenceCount: number;
    invalidEditorialRecordCount: number;
    worksWithPendingReviewSummaries: number;
    worksWithProductionKnowledge: number;
    worksWithApprovedClaimReferences: number;
  }>;
  localAvailability: "not-audited";
  sourceTextIncluded: false;
  providerEgress: "none";
  authorizationEffect: "none";
  progressEffect: "none";
  spoilerUnlockEffect: "none";
  fingerprint: string;
  works: readonly HoidChapterKnowledgeCoverageWork[];
}>;

const CATALOGUE_FINGERPRINT = sha256Hex(JSON.stringify(
  HOID_SOURCE_BIBLIOGRAPHY.map(work => [work.id, work.title, work.sourceGroup]),
));

function projectCounts(
  counts: HoidChapterKnowledgeReadinessReport["counts"],
): HoidChapterKnowledgeCoverageCounts {
  return Object.freeze({
    totalReadingUnits: counts.totalReadingUnits,
    navigationVerifiedUnitCount: counts.navigationVerifiedUnitCount,
    identityOnlyUnitCount: counts.identityOnlyUnitCount,
    bodyDigestRegisteredUnitCount: counts.bodyDigestRegisteredUnitCount,
    pendingReviewSummaryCount: counts.pendingReviewSummaryCount,
    productionKnowledgeEntryCount: counts.productionKnowledgeEntryCount,
    approvedClaimReferenceCount: counts.approvedClaimReferenceCount,
    invalidEditorialRecordCount: counts.invalidEditorialRecordCount,
  });
}

function projectWork(source: HoidSourceWork): HoidChapterKnowledgeCoverageWork {
  try {
    const result = getHoidChapterKnowledgeReadiness(source.id);
    if (result.status !== "ready") {
      return Object.freeze({
        workId: source.id,
        title: source.title,
        sourceGroup: source.sourceGroup,
        status: "unavailable",
        reason: "manifest-unavailable",
        integrity: "unavailable",
        counts: null,
      });
    }

    return Object.freeze({
      workId: source.id,
      title: source.title,
      sourceGroup: source.sourceGroup,
      status: "ready",
      reason: null,
      integrity: result.report.integrity,
      counts: projectCounts(result.report.counts),
    });
  } catch {
    return Object.freeze({
      workId: source.id,
      title: source.title,
      sourceGroup: source.sourceGroup,
      status: "unavailable",
      reason: "projection-failed",
      integrity: "unavailable",
      counts: null,
    });
  }
}

function sumReadyWorks(
  works: readonly HoidChapterKnowledgeCoverageWork[],
  key: keyof HoidChapterKnowledgeCoverageCounts,
): number {
  return works.reduce((total, work) =>
    total + (work.status === "ready" && work.counts ? work.counts[key] : 0), 0);
}

/**
 * Aggregate the per-work chapter-readiness projections into one catalogue view.
 *
 * This is a static editorial-coverage report, not a reader-progress report.
 * It deliberately omits current EPUB availability because no active local
 * source audit is supplied here. Unavailable manifests retain null counts and
 * are never silently represented as zero-coverage works.
 *
 * The result contains metadata and counts only. It cannot authorize answers,
 * change progress, promote drafts or unlock spoilers.
 */
export function getHoidChapterKnowledgeCoverageReport(): HoidChapterKnowledgeCoverageReport {
  const works = Object.freeze(HOID_SOURCE_BIBLIOGRAPHY.map(projectWork));
  const readyWorks = works.filter(work => work.status === "ready");
  const unavailableWorks = works.length - readyWorks.length;
  const cosmereWorks = works.filter(work => work.sourceGroup === "cosmere.epub").length;
  const rosharWorks = works.filter(work => work.sourceGroup === "roshar-epubs").length;

  const coverage = Object.freeze({
    manifestReadyWorkCount: readyWorks.length,
    manifestUnavailableWorkCount: unavailableWorks,
    totalReadingUnitCount: sumReadyWorks(works, "totalReadingUnits"),
    navigationVerifiedUnitCount: sumReadyWorks(works, "navigationVerifiedUnitCount"),
    identityOnlyUnitCount: sumReadyWorks(works, "identityOnlyUnitCount"),
    bodyDigestRegisteredUnitCount: sumReadyWorks(works, "bodyDigestRegisteredUnitCount"),
    pendingReviewSummaryCount: sumReadyWorks(works, "pendingReviewSummaryCount"),
    productionKnowledgeEntryCount: sumReadyWorks(works, "productionKnowledgeEntryCount"),
    approvedClaimReferenceCount: sumReadyWorks(works, "approvedClaimReferenceCount"),
    invalidEditorialRecordCount: sumReadyWorks(works, "invalidEditorialRecordCount"),
    worksWithPendingReviewSummaries: readyWorks.filter(work =>
      (work.counts?.pendingReviewSummaryCount ?? 0) > 0,
    ).length,
    worksWithProductionKnowledge: readyWorks.filter(work =>
      (work.counts?.productionKnowledgeEntryCount ?? 0) > 0,
    ).length,
    worksWithApprovedClaimReferences: readyWorks.filter(work =>
      (work.counts?.approvedClaimReferenceCount ?? 0) > 0,
    ).length,
  });

  const integrity: HoidChapterKnowledgeCoverageReport["integrity"] =
    readyWorks.length === 0
      ? "unavailable"
      : readyWorks.some(work => work.integrity === "inconsistent")
        ? "inconsistent"
        : "consistent";

  const fingerprint = sha256Hex(JSON.stringify([
    "hoid-chapter-knowledge-coverage-v1",
    CATALOGUE_FINGERPRINT,
    coverage,
    works.map(work => [
      work.workId,
      work.status,
      work.reason,
      work.integrity,
      work.counts ? [
        work.counts.totalReadingUnits,
        work.counts.navigationVerifiedUnitCount,
        work.counts.identityOnlyUnitCount,
        work.counts.bodyDigestRegisteredUnitCount,
        work.counts.pendingReviewSummaryCount,
        work.counts.productionKnowledgeEntryCount,
        work.counts.approvedClaimReferenceCount,
        work.counts.invalidEditorialRecordCount,
      ] : null,
    ]),
  ]));

  return Object.freeze({
    schemaVersion: 1,
    scope: "metadata-only",
    integrity,
    catalogue: Object.freeze({
      totalWorks: works.length,
      cosmereWorks,
      rosharWorks,
      fingerprint: CATALOGUE_FINGERPRINT,
    }),
    coverage,
    localAvailability: "not-audited",
    sourceTextIncluded: false,
    providerEgress: "none",
    authorizationEffect: "none",
    progressEffect: "none",
    spoilerUnlockEffect: "none",
    fingerprint,
    works,
  });
}
