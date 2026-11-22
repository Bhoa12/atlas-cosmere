import { describe, expect, it } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { recommendEditionBoundReadingNextSteps } from "./editionBoundRecommendations";
import { validateHoidReadingCursor } from "./readingManifest";

describe("edition-bound reading recommendation targets", () => {
  it("binds a resume recommendation to the exact edition manifest and next chapter cursor", () => {
    const result = recommendEditionBoundReadingNextSteps([{ bookId: "tfe", chapter: 8 }], 1);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item).toMatchObject({
      sourceId: "tfe",
      reason: "resume-current-work",
      currentChapter: 9,
      completedThroughChapter: 8,
      target: { kind: "edition-cursor", editionId: "cosmere-epub-merged-v1" },
    });
    if (item.target.kind !== "edition-cursor") return;

    expect(item.target.cursor).toMatchObject({
      schemaVersion: 1,
      bookId: "tfe",
      unitId: "chapter:009",
      ordinal: 9,
      chapterNumber: 9,
    });
    expect(item.target.navigationSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(validateHoidReadingCursor(item.target.cursor).status).toBe("valid");
    expect(Object.isFrozen(item.target)).toBe(true);
    expect(Object.isFrozen(item.target.cursor)).toBe(true);
  });

  it("creates a chapter-one cursor for a trackable unread source", () => {
    const result = recommendEditionBoundReadingNextSteps([], 1);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    const item = result.items[0];
    expect(item).toMatchObject({
      sourceId: "tfe",
      reason: "unread-source",
      target: {
        kind: "edition-cursor",
        editionId: "cosmere-epub-merged-v1",
        cursor: { bookId: "tfe", chapterNumber: 1, ordinal: 1 },
      },
    });
  });

  it("keeps unsegmented works as catalog-only instead of inventing a chapter target", () => {
    const reading = HOID_SOURCE_BIBLIOGRAPHY
      .filter(work => work.id !== "white-sand-1")
      .map(work => ({ bookId: work.id, completed: true as const }));
    const result = recommendEditionBoundReadingNextSteps(reading, 1);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.items).toEqual([{
      sourceId: "white-sand-1",
      title: HOID_SOURCE_BIBLIOGRAPHY.find(work => work.id === "white-sand-1")!.title,
      reason: "unread-source",
      target: { kind: "catalog-only", reason: "segmentation-unverified" },
    }]);
  });

  it("does not guess a resume target when multiple works are in progress", () => {
    const result = recommendEditionBoundReadingNextSteps([
      { bookId: "tfe", chapter: 8 },
      { bookId: "elantris", chapter: 3 },
    ], 2);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.items.every(item => item.reason === "unread-source")).toBe(true);
    expect(result.items.some(item => item.sourceId === "tfe" || item.sourceId === "elantris")).toBe(false);
  });

  it("does not emit a nonexistent next chapter at the end of a verified manifest", () => {
    const result = recommendEditionBoundReadingNextSteps([{ bookId: "tfe", chapter: 38 }], 3);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.items.some(item => item.sourceId === "tfe" && item.reason === "resume-current-work")).toBe(false);
  });

  it("rejects malformed progress instead of producing navigation targets", () => {
    expect(recommendEditionBoundReadingNextSteps([
      { bookId: "tfe", chapter: 999 },
    ])).toEqual({ status: "unavailable", reason: "invalid-progress" });
  });

  it("rejects an unknown active work", () => {
    expect(recommendEditionBoundReadingNextSteps(
      [{ bookId: "tfe", chapter: 8 }],
      3,
      "unknown-work",
    )).toEqual({ status: "unavailable", reason: "invalid-active-work" });
  });

  it("rejects non-finite limits", () => {
    expect(recommendEditionBoundReadingNextSteps([], Number.NaN))
      .toEqual({ status: "unavailable", reason: "invalid-limit" });
    expect(recommendEditionBoundReadingNextSteps([], Number.POSITIVE_INFINITY))
      .toEqual({ status: "unavailable", reason: "invalid-limit" });
  });

  it("preserves a cursor-only target without inventing an EPUB locator", () => {
    const reading = HOID_SOURCE_BIBLIOGRAPHY
      .filter(work => work.id !== "elantris")
      .map(work => ({ bookId: work.id, completed: true as const }));
    const result = recommendEditionBoundReadingNextSteps(reading, 1);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const target = result.items[0].target;
    expect(target.kind).toBe("edition-cursor");
    if (target.kind !== "edition-cursor") throw new Error("Elantris chapter-one cursor was not produced");
    expect(target.cursor.chapterNumber).toBe(1);
    expect(["verified", "cursor-only"]).toContain(target.locatorStatus);
    if (target.locatorStatus === "cursor-only") expect("locatorId" in target).toBe(false);
  });
});
