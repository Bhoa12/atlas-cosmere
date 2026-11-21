import { describe, expect, it } from "vitest";
import { HoidKnowledgeCatalog, type HoidKnowledgeEntry } from "./catalog";
import { HOID_EDITORIAL_DRAFTS } from "./editorialDrafts";
import { isEvidenceUnlocked } from "./evidenceScope";
import { createHoidReadingCursor } from "./readingManifest";
import {
  isChapterBeyondCompletedReadingBoundary,
  isCommunityPostBeyondReadingBoundary,
  isHoidFirstSafeAppearanceCompleted,
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
  it("keeps Run 170, Run 174, Run 175, Run 176, Run 178 and Run 181 summaries locked at their source cursor and unlocks them at the next cursor", () => {
    const ids = new Set([
      "tfe.chapter-005.kelsier-venture-atium",
      "twok.chapter-012.adolin-abismoid-hunt",
      "edgedancer.chapter-013.lift-emperor-decree",
      "dawnshard.chapter-013.lopen-akinah-landing",
      "twok.chapter-013.dalinar-elkohar-abismoid-battle",
      "edgedancer.chapter-014.lift-investigation-red-storm",
      "dawnshard.chapter-014.rysns-treasure-warning",
      "tfe.chapter-006.kelsier-rebellion-plan",
      "tfe.chapter-007.marsh-vin-training",
      "twok.chapter-014.kaladin-bridge-four-training",
      "edgedancer.chapter-015.lift-follows-skybreakers",
      "dawnshard.chapter-015.akinah-hidden-oathgate",
      "twok.chapter-015.adolin-aftermath-gavilar-message",
      "edgedancer.chapter-016.lift-pursues-skybreakers",
      "dawnshard.chapter-016.rysn-mural-acceptance",
      "tfe.chapter-008.vin-sazed-renoux-training",
    ]);
    const drafts = HOID_EDITORIAL_DRAFTS.filter(draft => ids.has(draft.id));
    expect(drafts).toHaveLength(16);

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


describe("book-bound community spoiler authority", () => {
  it("allows only posts ending before the currently open chapter", () => {
    const projected = projectHoidCursorPositionToBoundary({
      bookId: "twok",
      cursor: cursor("twok", 7),
    });
    expect(projected).not.toBeNull();

    expect(isCommunityPostBeyondReadingBoundary("twok", 6, projected?.boundary)).toBe(false);
    expect(isCommunityPostBeyondReadingBoundary("twok", 7, projected?.boundary)).toBe(true);
    expect(isCommunityPostBeyondReadingBoundary("twok", 8, projected?.boundary)).toBe(true);
  });

  it("fails closed when the boundary is missing or belongs to another work", () => {
    const projected = projectHoidCursorPositionToBoundary({
      bookId: "twok",
      cursor: cursor("twok", 7),
    });
    expect(isCommunityPostBeyondReadingBoundary("twok", 1, undefined)).toBe(true);
    expect(isCommunityPostBeyondReadingBoundary("tfe", 1, projected?.boundary)).toBe(true);
  });

  it("reveals a whole work only for its explicit completed boundary", () => {
    const projected = projectHoidCursorPositionToBoundary({
      bookId: "tfe",
      completed: true,
    });
    expect(projected?.boundary.kind).toBe("completed");
    expect(isCommunityPostBeyondReadingBoundary("tfe", 75, projected?.boundary)).toBe(false);

    const partial = projectHoidCursorPositionToBoundary({
      bookId: "tfe",
      cursor: cursor("tfe", 1),
    });
    expect(isCommunityPostBeyondReadingBoundary("tfe", 75, partial?.boundary)).toBe(true);
  });

  it("rejects inconsistent, unknown-key and accessor-bearing boundaries", () => {
    expect(isCommunityPostBeyondReadingBoundary("twok", 7, {
      kind: "in-progress",
      bookId: "twok",
      currentChapter: 7,
      completedThroughChapter: 7,
    })).toBe(true);

    expect(isCommunityPostBeyondReadingBoundary("twok", 7, {
      kind: "in-progress",
      bookId: "twok",
      currentChapter: 7,
      completedThroughChapter: 6,
      extra: true,
    })).toBe(true);

    let invoked = false;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperties(hostile, {
      kind: { enumerable: true, get: () => { invoked = true; return "in-progress"; } },
      bookId: { enumerable: true, value: "twok" },
      currentChapter: { enumerable: true, value: 7 },
      completedThroughChapter: { enumerable: true, value: 6 },
    });
    expect(isCommunityPostBeyondReadingBoundary("twok", 7, hostile)).toBe(true);
    expect(invoked).toBe(false);
  });

  it("rejects invalid comment identity and chapter metadata", () => {
    const projected = projectHoidCursorPositionToBoundary({
      bookId: "twok",
      cursor: cursor("twok", 7),
    });
    expect(isCommunityPostBeyondReadingBoundary("unknown-work", 1, projected?.boundary)).toBe(true);
    expect(isCommunityPostBeyondReadingBoundary("twok", 0, projected?.boundary)).toBe(true);
    expect(isCommunityPostBeyondReadingBoundary("twok", "7", projected?.boundary)).toBe(true);
    expect(isCommunityPostBeyondReadingBoundary("twok", 7.5, projected?.boundary)).toBe(true);
  });
});

describe("shared first-safe-appearance completion policy", () => {
  const entry: HoidKnowledgeEntry = {
    id: "synthetic.first-safe-entity",
    aliases: ["Entidad sintética"],
    kind: "character",
    firstSafeAppearance: { bookId: "twok", chapter: 7 },
  };

  it("does not disclose an entity while its first-safe chapter is open", () => {
    const projection = projectHoidCursorPositionToBoundary({
      bookId: "twok",
      cursor: cursor("twok", 7),
    });
    expect(projection?.boundary).toMatchObject({
      kind: "in-progress",
      currentChapter: 7,
      completedThroughChapter: 6,
    });
    expect(isHoidFirstSafeAppearanceCompleted(6, 7, false)).toBe(false);
    const catalog = new HoidKnowledgeCatalog([entry]);
    expect(catalog.isEntityMentionUnlocked(
      entry,
      projection?.safeReadingPosition ? [projection.safeReadingPosition] : [],
    )).toBe(false);
  });

  it("authorizes the entity only after the first-safe chapter is completed", () => {
    const projection = projectHoidCursorPositionToBoundary({
      bookId: "twok",
      cursor: cursor("twok", 8),
    });
    expect(projection?.boundary).toMatchObject({
      kind: "in-progress",
      currentChapter: 8,
      completedThroughChapter: 7,
    });
    expect(isHoidFirstSafeAppearanceCompleted(7, 7, false)).toBe(true);
    const catalog = new HoidKnowledgeCatalog([entry]);
    expect(catalog.isEntityMentionUnlocked(
      entry,
      projection?.safeReadingPosition ? [projection.safeReadingPosition] : [],
    )).toBe(true);
  });

  it("accepts explicit whole-work completion but rejects malformed markers and boundaries", () => {
    expect(isHoidFirstSafeAppearanceCompleted(null, 7, true)).toBe(true);
    expect(isHoidFirstSafeAppearanceCompleted(7, 0, false)).toBe(false);
    expect(isHoidFirstSafeAppearanceCompleted(-1, 7, false)).toBe(false);
    expect(isHoidFirstSafeAppearanceCompleted(7, Number.NaN, false)).toBe(false);
    expect(isHoidFirstSafeAppearanceCompleted(7, 7, "true")).toBe(false);
  });

  it("keeps chapter one locked when no chapter has been completed", () => {
    const projection = projectHoidCursorPositionToBoundary({
      bookId: "twok",
      cursor: cursor("twok", 1),
    });
    expect(projection?.safeReadingPosition).toBeNull();
    expect(isHoidFirstSafeAppearanceCompleted(null, 1, false)).toBe(false);
    const catalog = new HoidKnowledgeCatalog([{
      ...entry,
      firstSafeAppearance: { bookId: "twok", chapter: 1 },
    }]);
    expect(catalog.isEntityMentionUnlocked(entry, [])).toBe(false);
  });
});

