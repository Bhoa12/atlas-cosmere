import { describe, expect, it } from "vitest";
import { getHoidSourceIngestionPlan, getHoidSafeIngestionUnits } from "./sourceIngestionPlan";
import { getHoidReadingManifest } from "./readingManifest";

describe("Hoid metadata-only source ingestion plan", () => {
  it("covers the full 24-work catalogue without claiming source access", () => {
    const plan = getHoidSourceIngestionPlan();

    expect(plan.catalogueWorkCount).toBe(24);
    expect(plan.candidateCount).toBe(18);
    expect(plan.blockedWorkCount).toBe(4);
    expect(plan.continuationTaskCount).toBe(2);
    expect(plan.newWorkTaskCount).toBe(16);
    expect(plan.completedNumberedChapterWorkCount).toBe(2);
    expect(plan.sourceAccessPerformed).toBe(false);
    expect(plan.authorizationEffect).toBe("none");
  });

  it("continues the two incomplete inspected works at the first missing chapter", () => {
    const plan = getHoidSourceIngestionPlan();
    const continuation = plan.tasks.filter(task => task.priority === "continue-inspected-work");

    expect(continuation.map(task => [task.workId, task.chapterNumber])).toEqual([
      ["tfe", 12],
      ["twok", 22],
    ]);
  });

  it("marks Danzante del Filo and Esquirla del amanecer complete only within their numbered-chapter manifests", () => {
    const plan = getHoidSourceIngestionPlan();
    expect(plan.completedWorks).toEqual([
      {
        workId: "edgedancer",
        title: "Danzante del Filo",
        numberedChapterCount: 20,
        scope: "numbered-chapters-only",
      },
      {
        workId: "dawnshard",
        title: "Esquirla del amanecer",
        numberedChapterCount: 19,
        scope: "numbered-chapters-only",
      },
    ]);
    expect(plan.tasks.some(task => task.workId === "edgedancer")).toBe(false);
    expect(plan.tasks.some(task => task.workId === "dawnshard")).toBe(false);
  });

  it("starts every other navigable work at chapter one", () => {
    const plan = getHoidSourceIngestionPlan();
    const newWorks = plan.tasks.filter(task => task.priority !== "continue-inspected-work");

    expect(newWorks).toHaveLength(16);
    expect(newWorks.every(task => task.chapterNumber === 1)).toBe(true);
    expect(newWorks.filter(task => task.priority === "start-cosmere-work")).toHaveLength(12);
    expect(newWorks.filter(task => task.priority === "start-roshar-work")).toHaveLength(4);
  });

  it("keeps the safe numeric prefixes of Elantris and Viento y Verdad eligible", () => {
    const plan = getHoidSourceIngestionPlan();
    const elantris = plan.tasks.find(task => task.workId === "elantris");
    const sawt = plan.tasks.find(task => task.workId === "sawt");

    expect(elantris).toMatchObject({
      chapterNumber: 1,
      safeChapterCount: 47,
      manifestCoverage: "partial-before-ambiguous-chapter",
    });
    expect(sawt).toMatchObject({
      chapterNumber: 1,
      safeChapterCount: 11,
      manifestCoverage: "partial-before-ambiguous-chapter",
    });
  });

  it("keeps duplicate-label identity units out of sequential ingestion", () => {
    const result = getHoidReadingManifest("sawt");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    const safeUnits = getHoidSafeIngestionUnits(result.manifest);
    expect(safeUnits).toHaveLength(11);
    expect(safeUnits.map(unit => unit.chapterNumber)).toEqual(
      Array.from({ length: 11 }, (_, index) => index + 1),
    );
    expect(safeUnits.some(unit => [12, 14].includes(unit.chapterNumber))).toBe(false);
    expect(Object.isFrozen(safeUnits)).toBe(true);

    const extendedManifest = Object.freeze({
      ...result.manifest,
      units: Object.freeze([
        ...result.manifest.units,
        Object.freeze({
          id: "chapter:013:synthetic",
          kind: "chapter" as const,
          ordinal: 13,
          chapterNumber: 13,
        }),
      ]),
    });
    const extendedSafeUnits = getHoidSafeIngestionUnits(extendedManifest);
    expect(extendedSafeUnits.map(unit => unit.chapterNumber)).toEqual(
      Array.from({ length: 11 }, (_, index) => index + 1),
    );
  });

  it("blocks White Sand volumes and Arcanum until their units are segmented", () => {
    const plan = getHoidSourceIngestionPlan();

    expect(plan.blockedWorks.map(work => [work.workId, work.reason])).toEqual([
      ["white-sand-1", "volume-segmentation-required"],
      ["white-sand-2", "volume-segmentation-required"],
      ["white-sand-3", "volume-segmentation-required"],
      ["arcanum", "collection-section-segmentation-required"],
    ]);
  });

  it("binds every candidate to a safe relative locator and the next-chapter unlock boundary", () => {
    const plan = getHoidSourceIngestionPlan();

    for (const task of plan.tasks) {
      expect(task.locatorId.startsWith(`nav:${task.editionId}:`)).toBe(true);
      expect(task.locatorId.endsWith(`:${task.navigationHref}`)).toBe(true);
      expect(task.navigationHref.startsWith("/")).toBe(false);
      expect(task.navigationHref.includes("\\")).toBe(false);
      expect(task.navigationHref.split("/").some(segment => segment === ".." || segment === ".")).toBe(false);
      expect(task.minimumReaderChapter).toBe(task.chapterNumber + 1);
      expect(task.requiresExplicitSourceSelection).toBe(true);
      expect(task.sourceAvailability).toBe("not-checked");
      expect(task.status).toBe("awaiting-explicit-local-source-selection");
    }
  });

  it("reports staging and production separately without exposing summaries or digests", () => {
    const plan = getHoidSourceIngestionPlan();

    expect(plan.editorial).toEqual({
      stagedSummaryCount: 67,
      pendingReviewSummaryCount: 67,
      productionKnowledgeEntryCount: 0,
      approvedClaimCount: 0,
    });
    const serialized = JSON.stringify(plan);
    expect(serialized).not.toContain("summary");
    expect(serialized).not.toContain("documentSha256");
    expect(serialized).not.toContain("navigationSha256");
    expect(serialized).not.toContain("file://");
  });

  it("returns deterministic immutable snapshots", () => {
    const first = getHoidSourceIngestionPlan();
    const second = getHoidSourceIngestionPlan();

    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.tasks)).toBe(true);
    expect(Object.isFrozen(first.tasks[0])).toBe(true);
    expect(Object.isFrozen(first.blockedWorks)).toBe(true);
  });
});
