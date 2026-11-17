import { describe, expect, it } from "vitest";
import { buildHoidCursorReadingContext } from "./cursorReadingContext";
import { createHoidReadingCursor } from "./readingManifest";

const UPDATED_AT = "2026-11-17T15:00:00.000Z";

function snapshot(positions: readonly unknown[], revision = 1) {
  return {
    schemaVersion: 2,
    revision,
    positions,
    updatedAt: revision === 0 ? null : UPDATED_AT,
  };
}

function cursorPosition(bookId: string, chapter: number, order?: number) {
  const created = createHoidReadingCursor(bookId, chapter);
  if (created.status !== "ready") throw new Error("Cursor sintético no disponible");
  return {
    bookId,
    cursor: created.cursor,
    ...(order === undefined ? {} : { order }),
  };
}

describe("buildHoidCursorReadingContext", () => {
  it("returns a metadata-only empty context for a valid empty snapshot", () => {
    const result = buildHoidCursorReadingContext(snapshot([], 0));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.context.positions).toEqual([]);
    expect(result.context.startedCount).toBe(0);
    expect(result.context.unstartedCount).toBe(24);
    expect(result.context.catalogSize).toBe(24);
    expect(result.context.unitScope).toBe("verified-numbered-chapters-only");
  });

  it("reports the current chapter separately from the last completed chapter", () => {
    const result = buildHoidCursorReadingContext(snapshot([cursorPosition("twok", 7)]));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.context.positions).toEqual([{
      bookId: "twok",
      title: "El Camino de los Reyes",
      status: "in-progress",
      currentChapter: 7,
      completedThroughChapter: 6,
    }]);
  });

  it("does not mark chapter one as completed", () => {
    const result = buildHoidCursorReadingContext(snapshot([cursorPosition("tfe", 1)]));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.context.positions[0]).toMatchObject({
      bookId: "tfe",
      currentChapter: 1,
      completedThroughChapter: null,
    });
  });

  it("reports explicit completion without inventing a final chapter number", () => {
    const result = buildHoidCursorReadingContext(snapshot([{ bookId: "twok", completed: true }]));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.context.positions[0]).toEqual({
      bookId: "twok",
      title: "El Camino de los Reyes",
      status: "completed",
      completedThrough: "entire-work",
    });
  });

  it("uses explicit reading order and a deterministic fallback", () => {
    const result = buildHoidCursorReadingContext(snapshot([
      cursorPosition("tfe", 2, 2),
      cursorPosition("twok", 3, 1),
      cursorPosition("elantris", 4),
    ]));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.context.positions.map(item => item.bookId)).toEqual(["twok", "tfe", "elantris"]);
  });

  it("rejects unknown works rather than inventing a title", () => {
    expect(buildHoidCursorReadingContext(snapshot([
      { bookId: "unknown-work", completed: true },
    ]))).toEqual({ status: "unavailable", reason: "invalid-progress" });
  });

  it("rejects a cursor that does not resolve against its edition manifest", () => {
    const position = cursorPosition("twok", 2);
    const invalid = { ...position, cursor: { ...position.cursor, chapterNumber: 99 } };
    expect(buildHoidCursorReadingContext(snapshot([invalid]))).toEqual({
      status: "unavailable",
      reason: "invalid-progress",
    });
  });

  it("rejects malformed snapshots and duplicate works", () => {
    expect(buildHoidCursorReadingContext({ schemaVersion: 1 })).toEqual({
      status: "unavailable",
      reason: "invalid-progress",
    });
    expect(buildHoidCursorReadingContext(snapshot([
      cursorPosition("twok", 2),
      cursorPosition("twok", 3),
    ]))).toEqual({ status: "unavailable", reason: "invalid-progress" });
  });

  it("returns metadata only and no narrative summary", () => {
    const result = buildHoidCursorReadingContext(snapshot([cursorPosition("tfe", 3)]));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(JSON.stringify(result)).not.toContain("summary");
    expect(JSON.stringify(result)).not.toContain("plot");
    expect(JSON.stringify(result)).not.toContain("chapter title");
  });
});
