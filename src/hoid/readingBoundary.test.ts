import { describe, expect, it } from "vitest";
import { createHoidReadingCursor } from "./readingManifest";
import { projectHoidCursorPositionToBoundary } from "./readingBoundary";

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Cursor de prueba no disponible");
  return result.cursor;
}

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
});
