import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { getHoidEditionProgressPolicy } from "./editionStructure";
import {
  getHoidReadingManifest,
  type HoidReadingManifest,
  type HoidReadingUnit,
} from "./readingManifest";
import { getVerifiedChapterDocumentNumbers } from "./verifiedChapterDocuments";
import { getHoidSourceCoverageReport } from "./sourceCoverage";

export type HoidSourceIngestionTaskPriority =
  | "continue-inspected-work"
  | "start-cosmere-work"
  | "start-roshar-work";

export type HoidSourceIngestionTask = Readonly<{
  workId: string;
  title: string;
  sourceGroup: "cosmere.epub" | "roshar-epubs";
  editionId: string;
  chapterNumber: number;
  locatorId: string;
  /** Relative archive path from the exact verified locator; never a device URI. */
  navigationHref: string;
  manifestCoverage: "verified-numeric-chapters" | "partial-before-ambiguous-chapter";
  safeChapterCount: number;
  inspectedChapterCount: number;
  priority: HoidSourceIngestionTaskPriority;
  status: "awaiting-explicit-local-source-selection";
  sourceAvailability: "not-checked";
  requiresExplicitSourceSelection: true;
  /** A chapter-N summary must not unlock before the reader reaches N+1. */
  minimumReaderChapter: number;
  scope: "numbered-chapters-only";
}>;

export type HoidSourceIngestionBlockReason =
  | "coverage-integrity-failed"
  | "unknown-edition"
  | "volume-segmentation-required"
  | "collection-section-segmentation-required"
  | "manifest-unavailable"
  | "inspected-document-outside-manifest"
  | "missing-verified-locator"
  | "invalid-relative-locator"
  | "ambiguous-numbering-after-safe-prefix";

export type HoidSourceIngestionBlockedWork = Readonly<{
  workId: string;
  title: string;
  reason: HoidSourceIngestionBlockReason;
  safeChapterCount: number;
  inspectedChapterCount: number;
  nextBlockedChapter?: number;
  ambiguousChapterNumbers?: readonly number[];
}>;

export type HoidSourceIngestionCompletedWork = Readonly<{
  workId: string;
  title: string;
  numberedChapterCount: number;
  scope: "numbered-chapters-only";
}>;

export type HoidSourceIngestionPlan = Readonly<{
  schemaVersion: 1;
  scope: "metadata-only-planning";
  sourceAccessPerformed: false;
  authorizationEffect: "none";
  catalogueWorkCount: number;
  candidateCount: number;
  continuationTaskCount: number;
  newWorkTaskCount: number;
  blockedWorkCount: number;
  completedNumberedChapterWorkCount: number;
  editorial: Readonly<{
    stagedSummaryCount: number;
    pendingReviewSummaryCount: number;
    productionKnowledgeEntryCount: number;
    approvedClaimCount: number;
  }>;
  tasks: readonly HoidSourceIngestionTask[];
  blockedWorks: readonly HoidSourceIngestionBlockedWork[];
  completedWorks: readonly HoidSourceIngestionCompletedWork[];
}>;

function resolveRelativeHref(locatorId: string, editionId: string, navigationSha256: string): string | null {
  const prefix = `nav:${editionId}:${navigationSha256}:`;
  if (!locatorId.startsWith(prefix)) return null;

  const href = locatorId.slice(prefix.length);
  if (
    href.length === 0 ||
    href.length > 2048 ||
    href.startsWith("/") ||
    href.startsWith("//") ||
    href.includes("\\") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(href) ||
    /%2f|%5c/i.test(href) ||
    /%(?![0-9a-f]{2})/i.test(href) ||
    /[\u0000-\u001f\u007f]/.test(href) ||
    href.split("/").some(segment => segment.length === 0 || segment === "." || segment === "..")
  ) return null;

  return href;
}

/**
 * Return only units that can participate in sequential numeric ingestion.
 * Exact locators for duplicated labels are identity/display metadata and must
 * never become chapter-number tasks or unlock thresholds.
 */
export function getHoidSafeIngestionUnits(
  manifest: HoidReadingManifest,
): readonly HoidReadingUnit[] {
  if (manifest.coverage !== "partial-before-ambiguous-chapter") {
    return manifest.units;
  }
  if (manifest.ambiguousChapterNumbers.length === 0) return Object.freeze([]);
  const firstAmbiguousChapter = Math.min(...manifest.ambiguousChapterNumbers);
  const safeThrough = firstAmbiguousChapter - 1;
  if (!Number.isSafeInteger(safeThrough) || safeThrough < 1) return Object.freeze([]);
  return Object.freeze(manifest.units.filter(unit =>
    unit.ordinal <= safeThrough &&
    unit.chapterNumber <= safeThrough &&
    !manifest.ambiguousChapterNumbers.includes(unit.chapterNumber),
  ));
}

function priorityRank(priority: HoidSourceIngestionTaskPriority): number {
  if (priority === "continue-inspected-work") return 0;
  if (priority === "start-cosmere-work") return 1;
  return 2;
}

/**
 * Build a deterministic, read-only queue of the next chapter-body inspections
 * that can be attempted from already verified edition-bound navigation.
 *
 * The plan does not inspect a source, assert that a private EPUB is currently
 * available, authorize reading progress, create a summary, or promote claims.
 * A caller must still obtain an explicit local source selection and run the
 * candidate-only EPUB inspection pipeline.
 */
export function getHoidSourceIngestionPlan(): HoidSourceIngestionPlan {
  const coverage = getHoidSourceCoverageReport();
  const coverageByWork = new Map(coverage.works.map(work => [work.workId, work]));
  const tasks: HoidSourceIngestionTask[] = [];
  const blockedWorks: HoidSourceIngestionBlockedWork[] = [];
  const completedWorks: HoidSourceIngestionCompletedWork[] = [];

  for (const source of HOID_SOURCE_BIBLIOGRAPHY) {
    const workCoverage = coverageByWork.get(source.id);
    const inspected = getVerifiedChapterDocumentNumbers(source.id);
    const inspectedSet = new Set(inspected);
    const policy = getHoidEditionProgressPolicy(source.id);

    const block = (
      reason: HoidSourceIngestionBlockReason,
      safeChapterCount = 0,
      nextBlockedChapter?: number,
      ambiguousChapterNumbers?: readonly number[],
    ) => {
      blockedWorks.push(Object.freeze({
        workId: source.id,
        title: source.title,
        reason,
        safeChapterCount,
        inspectedChapterCount: inspected.length,
        ...(nextBlockedChapter === undefined ? {} : { nextBlockedChapter }),
        ...(ambiguousChapterNumbers === undefined
          ? {}
          : { ambiguousChapterNumbers: Object.freeze([...ambiguousChapterNumbers]) }),
      }));
    };

    if (!workCoverage || coverage.integrity !== "consistent") {
      block("coverage-integrity-failed");
      continue;
    }
    if (policy.kind === "unknown") {
      block("unknown-edition");
      continue;
    }
    if (policy.kind === "requires-volume-segmentation") {
      block("volume-segmentation-required");
      continue;
    }
    if (policy.kind === "collection-sections") {
      block("collection-section-segmentation-required");
      continue;
    }

    const manifestResult = getHoidReadingManifest(source.id);
    if (manifestResult.status !== "ready") {
      block("manifest-unavailable");
      continue;
    }
    const manifest = manifestResult.manifest;
    const safeUnits = getHoidSafeIngestionUnits(manifest);

    if (inspected.some(chapter => !safeUnits.some(unit => unit.chapterNumber === chapter))) {
      block("inspected-document-outside-manifest", safeUnits.length);
      continue;
    }

    const nextUnit = safeUnits.find(unit => !inspectedSet.has(unit.chapterNumber));
    if (!nextUnit) {
      if (manifest.coverage === "partial-before-ambiguous-chapter") {
        block(
          "ambiguous-numbering-after-safe-prefix",
          safeUnits.length,
          manifest.ambiguousChapterNumbers[0],
          manifest.ambiguousChapterNumbers,
        );
      } else {
        completedWorks.push(Object.freeze({
          workId: source.id,
          title: source.title,
          numberedChapterCount: safeUnits.length,
          scope: "numbered-chapters-only",
        }));
      }
      continue;
    }

    if (!nextUnit.locatorId) {
      block("missing-verified-locator", safeUnits.length, nextUnit.chapterNumber);
      continue;
    }

    const navigationHref = resolveRelativeHref(
      nextUnit.locatorId,
      manifest.editionId,
      manifest.navigationSha256,
    );
    if (!navigationHref) {
      block("invalid-relative-locator", units.length, nextUnit.chapterNumber);
      continue;
    }

    const priority: HoidSourceIngestionTaskPriority = inspected.length > 0
      ? "continue-inspected-work"
      : source.sourceGroup === "cosmere.epub"
        ? "start-cosmere-work"
        : "start-roshar-work";

    tasks.push(Object.freeze({
      workId: source.id,
      title: source.title,
      sourceGroup: source.sourceGroup,
      editionId: manifest.editionId,
      chapterNumber: nextUnit.chapterNumber,
      locatorId: nextUnit.locatorId,
      navigationHref,
      manifestCoverage: manifest.coverage,
      safeChapterCount: safeUnits.length,
      inspectedChapterCount: inspected.length,
      priority,
      status: "awaiting-explicit-local-source-selection",
      sourceAvailability: "not-checked",
      requiresExplicitSourceSelection: true,
      minimumReaderChapter: nextUnit.chapterNumber + 1,
      scope: "numbered-chapters-only",
    }));
  }

  const bibliographyOrder = new Map(HOID_SOURCE_BIBLIOGRAPHY.map((work, index) => [work.id, index]));
  tasks.sort((left, right) =>
    priorityRank(left.priority) - priorityRank(right.priority) ||
    (left.priority === "continue-inspected-work"
      ? left.inspectedChapterCount - right.inspectedChapterCount
      : 0) ||
    (bibliographyOrder.get(left.workId) ?? 0) - (bibliographyOrder.get(right.workId) ?? 0),
  );

  return Object.freeze({
    schemaVersion: 1,
    scope: "metadata-only-planning",
    sourceAccessPerformed: false,
    authorizationEffect: "none",
    catalogueWorkCount: HOID_SOURCE_BIBLIOGRAPHY.length,
    candidateCount: tasks.length,
    continuationTaskCount: tasks.filter(task => task.priority === "continue-inspected-work").length,
    newWorkTaskCount: tasks.filter(task => task.priority !== "continue-inspected-work").length,
    blockedWorkCount: blockedWorks.length,
    completedNumberedChapterWorkCount: completedWorks.length,
    editorial: Object.freeze({
      stagedSummaryCount: coverage.editorial.stagedSummaryCount,
      pendingReviewSummaryCount: coverage.editorial.pendingReviewSummaryCount,
      productionKnowledgeEntryCount: coverage.editorial.productionKnowledgeEntryCount,
      approvedClaimCount: coverage.editorial.approvedClaimCount,
    }),
    tasks: Object.freeze(tasks),
    blockedWorks: Object.freeze(blockedWorks),
    completedWorks: Object.freeze(completedWorks),
  });
}
