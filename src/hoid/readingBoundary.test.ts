import { describe, expect, it } from "vitest";
import type { HoidKnowledgeEntry } from "./catalog";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { isEvidenceUnlocked } from "./evidenceScope";
import { createHoidReadingCursor } from "./readingManifest";
import {
  isChapterBeyondCompletedReadingBoundary,
  projectHoidCursorPositionToBoundary,
} from "./readingBoundary";

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Cursor de prueba no disponible");
  return result.cursor;
}

describe("community chapter spoiler boundary", () => {
  it("shields a post that reaches the chapter currently open", () => {
    expect(isChapterBeyondCompletedReadingBoundary(7, 7)).toBe(true);
    expect(isChapterBeyondCompletedReadingBoundary(8, 7)).toBe(true);
  });

  it("allows posts ending before the current chapter", () => {
    expect(isChapterBeyondCompletedReadingBoundary(6, 7)).toBe(false);
    expect(isChapterBeyondCompletedReadingBoundary(1, 2)).toBe(false);
  });

  it("reveals valid chapter posts after explicit whole-work completion", () => {
    expect(isChapterBeyondCompletedReadingBoundary(75, 0, true)).toBe(false);
  });

  it("shields every chapter when no reading position is recorded", () => {
    expect(isChapterBeyondCompletedReadingBoundary(1, 0)).toBe(true);
  });

  it("fails closed for malformed chapter metadata or progress", () => {
    expect(isChapterBeyondCompletedReadingBoundary("7", 8)).toBe(true);
    expect(isChapterBeyondCompletedReadingBoundary(7, -1)).toBe(true);
    expect(isChapterBeyondCompletedReadingBoundary(0, 8)).toBe(true);
  });
});

describe("Hoid reader spoiler boundary", () => {
  it("does not treat the currently open chapter as completed", () => {
    const result = projectHoidCursorPositionToBoundary({
      bookId: "twok",
      cursor: cursor("twok", 7),
    });

    expect(result).not.toBeNull();
    expect(result?.boundary).toEqual({
      kind: "in-progress",
      bookId: "twok",
      currentChapter: 7,
      completedThroughChapter: 6,
    });
    expect(result?.safeReadingPosition).toEqual({
      bookId: "twok",
      chapter: 6,
    });
  });

  it("authorizes no chapter summary while the reader is on chapter one", () => {
    const result = projectHoidCursorPositionToBoundary({
      bookId: "twok",
      cursor: cursor("twok", 1),
    });

    expect(result?.boundary).toEqual({
      kind: "in-progress",
      bookId: "twok",
      currentChapter: 1,
      completedThroughChapter: null,
    });
    expect(result?.safeReadingPosition).toBeNull();
  });

  it("keeps explicit completion distinct from a chapter cursor", () => {
    const result = projectHoidCursorPositionToBoundary({
      bookId: "twok",
      completed: true,
    });

    expect(result?.boundary).toEqual({
      kind: "completed",
      bookId: "twok",
      completedThrough: "entire-work",
    });
    expect(result?.safeReadingPosition).toEqual({
      bookId: "twok",
      completed: true,
    });
  });

  it("rejects a cursor whose book identity differs from its position", () => {
    const result = projectHoidCursorPositionToBoundary({
      bookId: "wor",
      cursor: cursor("twok", 7),
    });

    expect(result).toBeNull();
  });

  it("rejects accessors without executing them", () => {
    let invoked = false;
    const input = { cursor: cursor("twok", 7) } as Record<string, unknown>;
    Object.defineProperty(input, "bookId", {
      enumerable: true,
      get: () => {
        invoked = true;
        return "twok";
      },
    });

    expect(projectHoidCursorPositionToBoundary(input)).toBeNull();
    expect(invoked).toBe(false);
  });

  it("rejects explicit completion for a work outside the bibliography", () => {
    expect(projectHoidCursorPositionToBoundary({
      bookId: "unknown-work",
      completed: true,
    })).toBeNull();
  });

  it("rejects unknown fields and contradictory completion/cursor states", () => {
    expect(projectHoidCursorPositionToBoundary({
      bookId: "twok",
      cursor: cursor("twok", 7),
      completed: true,
    })).toBeNull();
    expect(projectHoidCursorPositionToBoundary({
      bookId: "twok",
      cursor: cursor("twok", 7),
      extra: "ignored?",
    })).toBeNull();
  });

  it("rejects an obsolete or forged cursor instead of projecting it", () => {
    const valid = cursor("twok", 7);
    const result = projectHoidCursorPositionToBoundary({
      bookId: "twok",
      cursor: { ...valid, chapterNumber: 8 },
    });

    expect(result).toBeNull();
  });
  it("keeps each Run 170 summary locked at its source cursor and unlocks it at the next cursor", () => {
    const ids = new Set([
      "tfe.chapter-005.kelsier-venture-atium",
      "twok.chapter-012.adolin-abismoid-hunt",
      "edgedancer.chapter-013.lift-emperor-decree",
      "dawnshard.chapter-013.lopen-akinah-landing",
    ]);
    const drafts = HOID_EDITORIAL_DRAFTS.filter(draft => ids.has(draft.id));
    expect(drafts).toHaveLength(4);

    for (const draft of drafts) {
      const source = draft.evidenceSource;
      expect(draft.evidenceUnlock).toEqual({
        bookId: source.bookId,
        chapter: source.chapter,
      });
      const entry: HoidKnowledgeEntry = {
        id: draft.id,
        aliases: [...draft.aliases],
        kind: draft.kind,
        firstSafeAppearance: { ...draft.firstSafeAppearance },
        evidenceSource: { ...source },
        evidenceUnlock: { ...draft.evidenceUnlock },
        summary: draft.summary,
      };

      const sourceCursor = projectHoidCursorPositionToBoundary({
        bookId: source.bookId,
        cursor: cursor(source.bookId, source.chapter),
      });
      expect(sourceCursor?.safeReadingPosition?.chapter).toBe(source.chapter - 1);
      expect(isEvidenceUnlocked(
        entry,
        sourceCursor?.safeReadingPosition ? [sourceCursor.safeReadingPosition] : [],
      )).toBe(false);

      const nextCursor = projectHoidCursorPositionToBoundary({
        bookId: source.bookId,
        cursor: cursor(source.bookId, source.chapter + 1),
      });
      expect(nextCursor?.safeReadingPosition?.chapter).toBe(source.chapter);
      if (!nextCursor?.safeReadingPosition) throw new Error("Falta la posición completada de prueba");
      expect(isEvidenceUnlocked(entry, [nextCursor.safeReadingPosition])).toBe(true);

      const otherBookId = source.bookId === "tfe" ? "twok" : "tfe";
      const otherCursor = projectHoidCursorPositionToBoundary({
        bookId: otherBookId,
        cursor: cursor(otherBookId, source.chapter + 1),
      });
      if (!otherCursor?.safeReadingPosition) throw new Error("Falta la posición del otro libro");
      expect(isEvidenceUnlocked(entry, [otherCursor.safeReadingPosition])).toBe(false);
    }
  });

});
