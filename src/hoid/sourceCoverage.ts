import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { HOID_SOURCE_CATALOG_MANIFEST } from "./sourceCatalogManifest";
import type { HoidEditionProgressPolicy } from "./editionStructure";
import { getHoidEditionProgressPolicy } from "./editionStructure";
import { getHoidReadingManifest } from "./readingManifest";
import { getVerifiedChapterDocumentNumbers } from "./verifiedChapterDocuments";
import {
  getVerifiedAmbiguousChapterLocatorEntries,
  getVerifiedChapterLocatorCount,
} from "./verifiedChapterLocators";
import { HOID_EDITORIAL_DRAFTS, getHoidEditorialDraftStatus } from "./editorialDrafts";
import {
  HOID_APPROVED_CLAIMS,
  HOID_EDITORIAL_KNOWLEDGE,
  getHoidEditorialRegistryStatus,
} from "./editorialRegistry";

/**
 * Metadata-only source coverage. This report describes what has been
 * catalogued, structurally mapped, individually inspected and staged.
 * It is descriptive only: it never authorizes knowledge or reading progress.
 */

export type HoidSourceNavigationCoverage =
  | Readonly<{
      kind: "numeric-chapters";
      status: "complete" | "partial" | "missing" | "inconsistent";
      chapterCount: number;
      verifiedLocatorCount: number;
      manifestUnitCount: number | null;
      scope: "numbered-chapter-navigation-only";
    }>
  | Readonly<{
      kind: "ambiguous-numbered-chapters";
      status: "partial" | "inconsistent";
      chapterCount: number;
      safeNumericProgressThroughChapter: number;
      ambiguousChapterNumbers: readonly number[];
      verifiedLocatorCount: number;
      manifestUnitCount: number | null;
      safePrefixComplete: boolean;
      scope: "numbered-chapter-navigation-only";
    }>
  | Readonly<{
      kind: "requires-volume-segmentation";
      status: "blocked";
      verifiedLocatorCount: number;
    }>
  | Readonly<{
      kind: "collection-sections";
      status: "blocked";
      verifiedLocatorCount: number;
    }>
  | Readonly<{
      kind: "unknown";
      status: "unavailable";
      verifiedLocatorCount: number;
    }>;

export type HoidSourceManifestCoverage =
  | Readonly<{
      status: "ready";
      unitCount: number;
      coverage: "verified-numeric-chapters" | "partial-before-ambiguous-chapter";
    }>
  | Readonly<{
      status: "unavailable";
      reason: "unknown-work" | "segmentation-unverified";
    }>;

export type HoidSourceWorkCoverage = Readonly<{
  workId: string;
  title: string;
  sourceGroup: "cosmere.epub" | "roshar-epubs";
  editionId: string | null;
  readingManifest: HoidSourceManifestCoverage;
  navigation: HoidSourceNavigationCoverage;
  /** Chapter numbers only; no titles, XHTML, hashes or source prose. */
  inspectedChapterNumbers: readonly number[];
  inspectedChapterDocumentCount: number;
  stagedSummaryChapterNumbers: readonly number[];
  stagedSummaryCount: number;
  pendingReviewSummaryCount: number;
  productionKnowledgeEntryCount: number;
}>;

export type HoidSourceCoverageReport = Readonly<{
  schemaVersion: 1;
  scope: "metadata-only";
  integrity: "consistent" | "inconsistent";
  catalogue: Readonly<{
    totalWorks: number;
    cosmereWorks: number;
    rosharWorks: number;
    fingerprint: string;
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
  works: readonly HoidSourceWorkCoverage[];
}>;

function getManifestCoverage(bookId: string): HoidSourceManifestCoverage {
  const result = getHoidReadingManifest(bookId);
  if (result.status === "ready") {
    return Object.freeze({
      status: "ready",
      unitCount: result.manifest.units.length,
      coverage: result.manifest.coverage,
    });
  }
  return Object.freeze({ status: "unavailable", reason: result.reason });
}

function getEditionId(policy: HoidEditionProgressPolicy): string | null {
  return "editionId" in policy ? policy.editionId : null;
}

function getNavigationCoverage(
  bookId: string,
  policy: HoidEditionProgressPolicy,
  verifiedLocatorCount: number,
  manifest: HoidSourceManifestCoverage,
): HoidSourceNavigationCoverage {
  if (policy.kind === "numeric-chapters") {
    const manifestUnitCount = manifest.status === "ready" ? manifest.unitCount : null;
    const consistent = manifestUnitCount === policy.chapterCount && verifiedLocatorCount <= policy.chapterCount;
    const status = !consistent
      ? "inconsistent"
      : verifiedLocatorCount === policy.chapterCount
        ? "complete"
        : verifiedLocatorCount === 0
          ? "missing"
          : "partial";
    return Object.freeze({
      kind: "numeric-chapters",
      status,
      chapterCount: policy.chapterCount,
      verifiedLocatorCount,
      manifestUnitCount,
      scope: "numbered-chapter-navigation-only",
    });
  }

  if (policy.kind === "chapter-number-with-duplicate-locators") {
    const manifestUnitCount = manifest.status === "ready" ? manifest.unitCount : null;
    const safeThrough = policy.safeNumericProgressThroughChapter;
    const fullManifestResult = getHoidReadingManifest(bookId);
    const fullManifest = fullManifestResult.status === "ready"
      ? fullManifestResult.manifest
      : null;
    const safeUnits = fullManifest?.units.filter(unit =>
      unit.chapterNumber <= safeThrough &&
      !policy.duplicateChapterNumbers.includes(unit.chapterNumber),
    ) ?? [];
    const safePrefixComplete = safeUnits.length === safeThrough &&
      safeUnits.every((unit, index) =>
        unit.chapterNumber === index + 1 &&
        unit.ordinal === index + 1 &&
        typeof unit.locatorId === "string",
      );
    const verifiedAmbiguousLocators = fullManifest
      ? getVerifiedAmbiguousChapterLocatorEntries(
          bookId,
          fullManifest.editionId,
          fullManifest.navigationSha256,
        )
      : [];
    const manifestAmbiguousUnits = fullManifest?.units.filter(unit =>
      policy.duplicateChapterNumbers.includes(unit.chapterNumber),
    ) ?? [];
    const ambiguousLocatorsConsistent =
      verifiedAmbiguousLocators.length === manifestAmbiguousUnits.length &&
      verifiedAmbiguousLocators.every(entry =>
        policy.duplicateChapterNumbers.includes(entry.chapterNumber) &&
        manifestAmbiguousUnits.some(unit =>
          unit.chapterNumber === entry.chapterNumber &&
          unit.ordinal === entry.ordinal &&
          unit.locatorId === entry.locatorId,
        ),
      );
    const manifestInventoryConsistent =
      manifestUnitCount !== null &&
      manifestUnitCount === safeThrough + verifiedAmbiguousLocators.length &&
      verifiedLocatorCount === manifestUnitCount;
    const consistent = Boolean(
      fullManifest &&
      safePrefixComplete &&
      ambiguousLocatorsConsistent &&
      manifestInventoryConsistent,
    );
    return Object.freeze({
      kind: "ambiguous-numbered-chapters",
      status: consistent ? "partial" : "inconsistent",
      chapterCount: policy.chapterCount,
      safeNumericProgressThroughChapter: safeThrough,
      ambiguousChapterNumbers: Object.freeze([...policy.duplicateChapterNumbers]),
      verifiedLocatorCount,
      manifestUnitCount,
      safePrefixComplete: consistent && safePrefixComplete,
      scope: "numbered-chapter-navigation-only",
    });
  }

  if (policy.kind === "requires-volume-segmentation") {
    return Object.freeze({
      kind: "requires-volume-segmentation",
      status: "blocked",
      verifiedLocatorCount,
    });
  }

  if (policy.kind === "collection-sections") {
    return Object.freeze({
      kind: "collection-sections",
      status: "blocked",
      verifiedLocatorCount,
    });
  }

  return Object.freeze({ kind: "unknown", status: "unavailable", verifiedLocatorCount });
}

/**
 * Build a deterministic, immutable coverage snapshot from the checked-in
 * bibliography, edition structures, sparse locator/document allowlists and
 * editorial staging/production registries.
 *
 * The report contains metadata and counts only. It must never be used as an
 * authorization input; EvidenceRuntime remains the sole narrative gate.
 */
export function getHoidSourceCoverageReport(): HoidSourceCoverageReport {
  const works: HoidSourceWorkCoverage[] = HOID_SOURCE_BIBLIOGRAPHY.map(source => {
    const policy = getHoidEditionProgressPolicy(source.id);
    const manifest = getManifestCoverage(source.id);
    const locatorCount = getVerifiedChapterLocatorCount(source.id);
    const inspectedChapterNumbers = getVerifiedChapterDocumentNumbers(source.id);
    const drafts = HOID_EDITORIAL_DRAFTS.filter(draft => draft.evidenceSource.bookId === source.id);
    const stagedSummaryChapterNumbers = Object.freeze(
      [...new Set(drafts.map(draft => draft.evidenceSource.chapter))].sort((a, b) => a - b),
    );
    const productionKnowledgeEntryCount = HOID_EDITORIAL_KNOWLEDGE.filter(entry =>
      (entry.evidenceSource?.bookId ?? entry.firstSafeAppearance.bookId) === source.id,
    ).length;

    return Object.freeze({
      workId: source.id,
      title: source.title,
      sourceGroup: source.sourceGroup,
      editionId: getEditionId(policy),
      readingManifest: manifest,
      navigation: getNavigationCoverage(source.id, policy, locatorCount, manifest),
      inspectedChapterNumbers,
      inspectedChapterDocumentCount: inspectedChapterNumbers.length,
      stagedSummaryChapterNumbers,
      stagedSummaryCount: drafts.length,
      pendingReviewSummaryCount: drafts.filter(draft => draft.review.status === "pending-review").length,
      productionKnowledgeEntryCount,
    });
  });

  const cosmereWorks = works.filter(work => work.sourceGroup === "cosmere.epub");
  const rosharWorks = works.filter(work => work.sourceGroup === "roshar-epubs");
  const worksWithVerifiedLocators = works.filter(work => work.navigation.verifiedLocatorCount > 0);
  const worksWithInspectedDocuments = works.filter(work => work.inspectedChapterDocumentCount > 0);
  const worksWithStagedSummaries = works.filter(work => work.stagedSummaryCount > 0);
  const draftRegistryStatus = getHoidEditorialDraftStatus();
  const productionRegistryStatus = getHoidEditorialRegistryStatus();
  const hasInconsistentNavigation = works.some(work => work.navigation.status === "inconsistent");
  const hasUnbackedStagedSummary = works.some(work =>
    work.stagedSummaryChapterNumbers.some(chapter => !work.inspectedChapterNumbers.includes(chapter)),
  );

  return Object.freeze({
    schemaVersion: 1,
    scope: "metadata-only",
    integrity: draftRegistryStatus === "invalid" || hasInconsistentNavigation || hasUnbackedStagedSummary
      ? "inconsistent"
      : "consistent",
    catalogue: Object.freeze({
      totalWorks: works.length,
      cosmereWorks: cosmereWorks.length,
      rosharWorks: rosharWorks.length,
      fingerprint: HOID_SOURCE_CATALOG_MANIFEST.fingerprint,
      accessStatus: HOID_SOURCE_CATALOG_MANIFEST.accessStatus,
      sourceContentIncluded: HOID_SOURCE_CATALOG_MANIFEST.sourceContentIncluded,
    }),
    navigation: Object.freeze({
      worksWithVerifiedLocators: worksWithVerifiedLocators.length,
      totalVerifiedChapterLocators: works.reduce((sum, work) => sum + work.navigation.verifiedLocatorCount, 0),
    }),
    chapterBodies: Object.freeze({
      worksWithInspectedDocuments: worksWithInspectedDocuments.length,
      totalInspectedChapterDocuments: works.reduce((sum, work) => sum + work.inspectedChapterDocumentCount, 0),
    }),
    editorial: Object.freeze({
      worksWithStagedSummaries: worksWithStagedSummaries.length,
      stagedSummaryCount: HOID_EDITORIAL_DRAFTS.length,
      pendingReviewSummaryCount: works.reduce((sum, work) => sum + work.pendingReviewSummaryCount, 0),
      draftRegistryStatus,
      productionKnowledgeEntryCount: HOID_EDITORIAL_KNOWLEDGE.length,
      approvedClaimCount: HOID_APPROVED_CLAIMS.length,
      productionRegistryStatus,
    }),
    works: Object.freeze(works),
  });
}
