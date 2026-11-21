import { describe, expect, it } from "vitest";
import { atlasProgressFromCursorSnapshot } from "./cursorAtlasAdapter";
import {
  emptyHoidCursorProgressSnapshot,
  type HoidCursorProgressSnapshot,
} from "./cursorProgressLedger";
import {
  createHoidReadingCursor,
  cursorToLegacyReadingPosition,
} from "./readingManifest";
import { isChapterBeyondCompletedReadingBoundary } from "./readingBoundary";

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Test cursor unavailable");
  return result.cursor;
}

function snapshot(
  positions: HoidCursorProgressSnapshot["positions"],
): HoidCursorProgressSnapshot {
  return Object.freeze({
    ...emptyHoidCursorProgressSnapshot(),
    revision: positions.length,
    positions: Object.freeze([...positions]),
    updatedAt: positions.length ? "2026-11-17T04:00:00.000Z" : null,
  });
}

describe("atlasProgressFromCursorSnapshot", () => {
  it("preserves the currently open chapter for Atlas display without marking it completed", () => {
    const openCursor = cursor("tfe", 12);
    const result = atlasProgressFromCursorSnapshot(snapshot([
      { bookId: "tfe", cursor: openCursor },
    ]));

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.chaptersByBook.tfe).toBe(12);
    expect(result.completedByBook.tfe).toBeUndefined();
    expect(result.communityBoundariesByBook.tfe).toEqual({
      kind: "in-progress",
      bookId: "tfe",
      currentChapter: 12,
      completedThroughChapter: 11,
    });
    expect(Object.getPrototypeOf(result.chaptersByBook)).toBeNull();
    expect(Object.getPrototypeOf(result.communityBoundariesByBook)).toBeNull();

    // The legacy authorization position is deliberately one chapter behind.
    // The UI retains N so the community boundary can shield N and later.
    expect(cursorToLegacyReadingPosition(openCursor)).toEqual({
      bookId: "tfe",
      chapter: 11,
    });
    expect(isChapterBeyondCompletedReadingBoundary(12, result.chaptersByBook.tfe)).toBe(true);
    expect(isChapterBeyondCompletedReadingBoundary(11, result.chaptersByBook.tfe)).toBe(false);
  });

  it("keeps chapter one visible and shields its own chapter from community spoilers", () => {
    const firstCursor = cursor("tfe", 1);
    const result = atlasProgressFromCursorSnapshot(snapshot([
      { bookId: "tfe", cursor: firstCursor },
    ]));

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.chaptersByBook.tfe).toBe(1);
    expect(cursorToLegacyReadingPosition(firstCursor)).toBeNull();
    expect(result.completedByBook.tfe).toBeUndefined();
    expect(result.communityBoundariesByBook.tfe).toEqual({
      kind: "in-progress",
      bookId: "tfe",
      currentChapter: 1,
      completedThroughChapter: null,
    });
    expect(isChapterBeyondCompletedReadingBoundary(1, result.chaptersByBook.tfe)).toBe(true);
  });

  it("preserves explicit completion without inventing a final chapter", () => {
    const result = atlasProgressFromCursorSnapshot(snapshot([
      { bookId: "woa", completed: true },
    ]));

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.completedByBook.woa).toBe(true);
    expect(result.chaptersByBook.woa).toBeUndefined();
    expect(result.communityBoundariesByBook.woa).toEqual({
      kind: "completed",
      bookId: "woa",
      completedThrough: "entire-work",
    });
    expect(Object.getPrototypeOf(result.completedByBook)).toBeNull();
  });

  it("projects multiple works independently", () => {
    const result = atlasProgressFromCursorSnapshot(snapshot([
      { bookId: "tfe", cursor: cursor("tfe", 12), order: 0 },
      { bookId: "elantris", cursor: cursor("elantris", 20), order: 1 },
      { bookId: "woa", completed: true, order: 2 },
    ]));

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect({ ...result.chaptersByBook }).toEqual({ tfe: 12, elantris: 20 });
    expect({ ...result.completedByBook }).toEqual({ woa: true });
  });

  it("fails the whole projection when the snapshot is invalid", () => {
    const invalid = {
      schemaVersion: 2,
      revision: 1,
      positions: [{ bookId: "tfe", cursor: { ...cursor("tfe", 12), chapterNumber: 80 } }],
      updatedAt: "2026-11-17T04:00:00.000Z",
    };

    expect(atlasProgressFromCursorSnapshot(invalid)).toEqual({
      status: "unavailable",
      reason: "invalid-snapshot",
    });
  });

  it("does not mutate the source snapshot", () => {
    const source = snapshot([{ bookId: "tfe", cursor: cursor("tfe", 12) }]);
    const before = JSON.stringify(source);

    atlasProgressFromCursorSnapshot(source);

    expect(JSON.stringify(source)).toBe(before);
  });

  it("returns empty null-prototype maps for a fresh profile", () => {
    const result = atlasProgressFromCursorSnapshot(emptyHoidCursorProgressSnapshot());

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(Object.keys(result.chaptersByBook)).toEqual([]);
    expect(Object.keys(result.completedByBook)).toEqual([]);
    expect(Object.keys(result.communityBoundariesByBook)).toEqual([]);
    expect(Object.getPrototypeOf(result.chaptersByBook)).toBeNull();
    expect(Object.getPrototypeOf(result.completedByBook)).toBeNull();
    expect(Object.getPrototypeOf(result.communityBoundariesByBook)).toBeNull();
  });
});
