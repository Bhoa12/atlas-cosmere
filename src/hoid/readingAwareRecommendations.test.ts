import { describe, expect, it } from "vitest";
import { buildHoidCursorReadingContext } from "./cursorReadingContext";
import { createHoidReadingCursor } from "./readingManifest";
import { composeHoidReadingAwareRecommendations } from "./readingAwareRecommendations";

const UPDATED_AT = "2026-11-18T10:00:00.000Z";

function cursor(bookId: string, chapter: number) {
  const result = createHoidReadingCursor(bookId, chapter);
  if (result.status !== "ready") throw new Error("Cursor sintético no disponible");
  return result.cursor;
}

function context(positions: readonly Record<string, unknown>[]) {
  const snapshot = {
    schemaVersion: 2,
    revision: positions.length === 0 ? 0 : 1,
    positions,
    updatedAt: positions.length === 0 ? null : UPDATED_AT,
  };
  const result = buildHoidCursorReadingContext(snapshot);
  if (result.status !== "ready") throw new Error("Contexto sintético no disponible");
  return result.context;
}

const unread = [
  { sourceId: "tfe", title: "El Imperio Final", reason: "unread-source" },
  { sourceId: "woa", title: "El Pozo de la Ascensión", reason: "unread-source" },
  { sourceId: "hoa", title: "El Héroe de las Eras", reason: "unread-source" },
];

describe("composeHoidReadingAwareRecommendations", () => {
  it("prioritizes active works to resume before unstarted catalogue discovery", () => {
    const reading = context([{ bookId: "twok", cursor: cursor("twok", 4), order: 1 }]);
    expect(composeHoidReadingAwareRecommendations(reading, unread, 3)).toEqual([
      {
        sourceId: "twok",
        title: "El Camino de los Reyes",
        reason: "resume-current-work",
        currentChapter: 4,
        completedThroughChapter: 3,
      },
      unread[0],
      unread[1],
    ]);
  });

  it("marks chapter one as started without claiming any completed chapter", () => {
    const reading = context([{ bookId: "twok", cursor: cursor("twok", 1) }]);
    expect(composeHoidReadingAwareRecommendations(reading, unread, 1)).toEqual([
      {
        sourceId: "twok",
        title: "El Camino de los Reyes",
        reason: "resume-current-work",
        currentChapter: 1,
        completedThroughChapter: null,
      },
    ]);
  });

  it("does not recommend explicitly completed works for resumption", () => {
    const reading = context([{ bookId: "tfe", completed: true }]);
    const result = composeHoidReadingAwareRecommendations(reading, unread, 2);
    expect(result).toEqual([unread[1], unread[2]]);
  });

  it("respects reader order among multiple active works", () => {
    const reading = context([
      { bookId: "wor", cursor: cursor("wor", 5), order: 2 },
      { bookId: "twok", cursor: cursor("twok", 3), order: 1 },
    ]);
    const result = composeHoidReadingAwareRecommendations(reading, unread, 2);
    expect(result?.map(item => item.sourceId)).toEqual(["twok", "wor"]);
  });

  it("applies the limit after active works have been prioritized", () => {
    const reading = context([
      { bookId: "twok", cursor: cursor("twok", 2), order: 1 },
      { bookId: "wor", cursor: cursor("wor", 3), order: 2 },
    ]);
    const result = composeHoidReadingAwareRecommendations(reading, unread, 1);
    expect(result).toHaveLength(1);
    expect(result?.[0].reason).toBe("resume-current-work");
  });

  it("rejects unread candidates that are already started", () => {
    const reading = context([{ bookId: "tfe", cursor: cursor("tfe", 2) }]);
    expect(composeHoidReadingAwareRecommendations(reading, unread, 3)).toBeNull();
  });

  it("rejects unknown sources, manipulated titles and duplicate candidates", () => {
    const reading = context([]);
    expect(composeHoidReadingAwareRecommendations(reading, [
      { sourceId: "unknown", title: "Obra desconocida", reason: "unread-source" },
    ], 1)).toBeNull();
    expect(composeHoidReadingAwareRecommendations(reading, [
      { sourceId: "tfe", title: "Título alterado", reason: "unread-source" },
    ], 1)).toBeNull();
    expect(composeHoidReadingAwareRecommendations(reading, [unread[0], unread[0]], 2)).toBeNull();
  });

  it("rejects inconsistent current and completed chapter boundaries", () => {
    const reading = context([{ bookId: "twok", cursor: cursor("twok", 3) }]);
    const invalid = {
      ...reading,
      positions: [{
        bookId: "twok",
        title: "El Camino de los Reyes",
        status: "in-progress",
        currentChapter: 3,
        completedThroughChapter: 1,
      }],
    };
    expect(composeHoidReadingAwareRecommendations(invalid, unread, 2)).toBeNull();
  });

  it("rejects invalid limits and malformed context snapshots", () => {
    const reading = context([]);
    expect(composeHoidReadingAwareRecommendations(reading, unread, -1)).toBeNull();
    expect(composeHoidReadingAwareRecommendations(reading, unread, 1.5)).toBeNull();
    expect(composeHoidReadingAwareRecommendations({ ...reading, extra: true }, unread, 2)).toBeNull();
    expect(composeHoidReadingAwareRecommendations(reading, unread, 21)).toBeNull();
  });
});
