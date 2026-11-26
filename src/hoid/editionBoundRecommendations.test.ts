import { describe, expect, it } from "vitest";
import { recommendEditionBoundReadingNextSteps } from "./editionBoundRecommendations";
import { createHoidReadingCursor, validateHoidReadingCursor } from "./readingManifest";

const UPDATED_AT = "2026-11-22T14:00:00.000Z";

function cursor(bookId: string, chapterNumber: number) {
  const result = createHoidReadingCursor(bookId, chapterNumber);
  if (result.status !== "ready") throw new Error("Cursor de fixture no disponible");
  return result.cursor;
}

type PositionFixture =
  | Readonly<{ bookId: string; chapter: number }>
  | Readonly<{ bookId: string; completed: true }>;

function snapshot(positions: readonly PositionFixture[] = []) {
  return {
    schemaVersion: 2,
    revision: positions.length === 0 ? 0 : 1,
    positions: positions.map(position =>
      "completed" in position
        ? { bookId: position.bookId, completed: true as const }
        : { bookId: position.bookId, cursor: cursor(position.bookId, position.chapter) },
    ),
    updatedAt: positions.length === 0 ? null : UPDATED_AT,
  };
}

describe("edition-bound reading recommendation targets", () => {
  it("binds a resume recommendation to the exact edition manifest and currently open chapter", () => {
    const result = recommendEditionBoundReadingNextSteps(snapshot([{ bookId: "tfe", chapter: 9 }]), 1);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.progressRevision).toBe(1);
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item).toMatchObject({
      sourceId: "tfe",
      reason: "resume-current-work",
      currentChapter: 9,
      completedThroughChapter: 8,
      target: { kind: "edition-cursor", editionId: "cosmere-epub-merged-v1" },
    });
    if (item.target.kind !== "edition-cursor") throw new Error("No se generó el cursor de edición");

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

  it("preserves chapter one as the current open chapter with no completed-through chapter", () => {
    const result = recommendEditionBoundReadingNextSteps(snapshot([{ bookId: "tfe", chapter: 1 }]), 1);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(result.items[0]).toMatchObject({
      reason: "resume-current-work",
      currentChapter: 1,
      completedThroughChapter: null,
      target: { kind: "edition-cursor", cursor: { chapterNumber: 1 } },
    });
  });

  it("does not infer a first work from an empty progress ledger", () => {
    expect(recommendEditionBoundReadingNextSteps(snapshot(), 1)).toEqual({
      status: "no-safe-next-work",
      reason: "no-active-work",
      progressRevision: 0,
    });
  });

  it("does not choose an unstarted catalogue entry after tracked works are complete", () => {
    expect(recommendEditionBoundReadingNextSteps(snapshot([
      { bookId: "tfe", completed: true },
      { bookId: "elantris", completed: true },
    ]), 1)).toEqual({
      status: "no-safe-next-work",
      reason: "no-active-work",
      progressRevision: 1,
    });
  });

  it("requires an explicit choice when several works are in progress", () => {
    const result = recommendEditionBoundReadingNextSteps(snapshot([
      { bookId: "tfe", chapter: 8 },
      { bookId: "elantris", chapter: 3 },
    ]), 2);
    expect(result.status).toBe("selection-required");
    if (result.status !== "selection-required") return;

    expect(result.progressRevision).toBe(1);
    expect(result.choices).toEqual([
      {
        sourceId: "tfe",
        title: "El Imperio Final",
        currentChapter: 8,
        completedThroughChapter: 7,
      },
      {
        sourceId: "elantris",
        title: "Elantris",
        currentChapter: 3,
        completedThroughChapter: 2,
      },
    ]);
    expect(Object.isFrozen(result.choices)).toBe(true);
    expect(result.choices.every(Object.isFrozen)).toBe(true);
  });

  it("uses the explicit active work to resolve multiple in-progress cursors", () => {
    const result = recommendEditionBoundReadingNextSteps(snapshot([
      { bookId: "tfe", chapter: 8 },
      { bookId: "elantris", chapter: 3 },
    ]), 1, "elantris");
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      sourceId: "elantris",
      reason: "resume-current-work",
      currentChapter: 3,
      completedThroughChapter: 2,
    });
  });

  it("rejects an explicit active work that is not actually in progress", () => {
    const result = recommendEditionBoundReadingNextSteps(snapshot([
      { bookId: "tfe", completed: true },
    ]), 1, "tfe");
    expect(result).toEqual({ status: "unavailable", reason: "invalid-active-work" });
  });

  it("does not convert a completed work into an implicit discovery recommendation", () => {
    expect(recommendEditionBoundReadingNextSteps(snapshot([
      { bookId: "tfe", completed: true },
    ]), 1)).toMatchObject({
      status: "no-safe-next-work",
      reason: "no-active-work",
    });
  });

  it("uses the exact last manifest chapter rather than inventing a chapter beyond it", () => {
    const result = recommendEditionBoundReadingNextSteps(snapshot([{ bookId: "tfe", chapter: 38 }]), 1);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.items[0]).toMatchObject({
      sourceId: "tfe",
      reason: "resume-current-work",
      currentChapter: 38,
    });
    if (result.items[0].target.kind === "edition-cursor") {
      expect(result.items[0].target.cursor.chapterNumber).toBe(38);
    }
  });

  it("rejects malformed or stale cursor progress instead of producing navigation targets", () => {
    expect(recommendEditionBoundReadingNextSteps({
      schemaVersion: 2,
      revision: 1,
      positions: [{
        bookId: "tfe",
        cursor: {
          schemaVersion: 1,
          manifestId: "wrong-manifest",
          bookId: "tfe",
          unitId: "chapter:999",
          ordinal: 999,
          chapterNumber: 999,
        },
      }],
      updatedAt: UPDATED_AT,
    })).toEqual({ status: "unavailable", reason: "invalid-progress" });
  });

  it("rejects an unknown active work", () => {
    expect(recommendEditionBoundReadingNextSteps(snapshot([{ bookId: "tfe", chapter: 8 }]), 3, "unknown-work"))
      .toEqual({ status: "unavailable", reason: "invalid-active-work" });
  });

  it("rejects non-finite limits and permits an explicit zero-item resume plan", () => {
    expect(recommendEditionBoundReadingNextSteps(snapshot(), Number.NaN))
      .toEqual({ status: "unavailable", reason: "invalid-limit" });
    expect(recommendEditionBoundReadingNextSteps(snapshot(), Number.POSITIVE_INFINITY))
      .toEqual({ status: "unavailable", reason: "invalid-limit" });
    expect(recommendEditionBoundReadingNextSteps(snapshot([
      { bookId: "tfe", chapter: 4 },
    ]), 0)).toMatchObject({ status: "ready", items: [] });
  });

  it("preserves the exact cursor when an active chapter has no verified opaque locator", () => {
    const result = recommendEditionBoundReadingNextSteps(snapshot([
      { bookId: "elantris", chapter: 1 },
    ]), 1);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const target = result.items[0].target;
    expect(target.kind).toBe("edition-cursor");
    if (target.kind !== "edition-cursor") throw new Error("Elantris chapter-one cursor was not produced");
    expect(target.cursor.chapterNumber).toBe(1);
    expect(["verified", "cursor-only"]).toContain(target.locatorStatus);
    if (target.locatorStatus === "cursor-only") {
      expect("locatorId" in target).toBe(false);
    } else {
      expect(target.locatorId).toBeTruthy();
    }
  });

});
