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

  it("accepts the last chapter inside a partial verified safe prefix", () => {
    const reading = context([{ bookId: "elantris", cursor: cursor("elantris", 47) }]);
    expect(composeHoidReadingAwareRecommendations(reading, unread, 1)).toEqual([
      {
        sourceId: "elantris",
        title: "Elantris",
        reason: "resume-current-work",
        currentChapter: 47,
        completedThroughChapter: 46,
      },
    ]);
  });

  it("rejects a plausible chapter number beyond the exact manifest safe prefix", () => {
    const reading = context([{ bookId: "elantris", cursor: cursor("elantris", 47) }]);
    const invalid = {
      ...reading,
      positions: [{
        bookId: "elantris",
        title: "Elantris",
        status: "in-progress",
        currentChapter: 48,
        completedThroughChapter: 47,
      }],
    };
    expect(composeHoidReadingAwareRecommendations(invalid, unread, 1)).toBeNull();
  });

  it("does not recommend explicitly completed works for resumption", () => {
    const reading = context([{ bookId: "tfe", completed: true }]);
    const result = composeHoidReadingAwareRecommendations(reading, unread.slice(1), 2);
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

  it("rejects trackable-work counts that do not match the checked-in manifests", () => {
    const reading = context([{ bookId: "twok", cursor: cursor("twok", 4), order: 1 }]);
    const invalid = {
      ...reading,
      trackableWorkCount: reading.trackableWorkCount - 1,
      untrackedWorkCount: reading.untrackedWorkCount + 1,
    };
    expect(composeHoidReadingAwareRecommendations(invalid, unread, 3)).toBeNull();
  });

  it("rejects an in-range but incorrect trackable-unstarted count", () => {
    const reading = context([{ bookId: "twok", cursor: cursor("twok", 4), order: 1 }]);
    const invalid = {
      ...reading,
      trackableUnstartedCount: reading.trackableUnstartedCount + 1,
    };
    expect(composeHoidReadingAwareRecommendations(invalid, unread, 3)).toBeNull();
  });

  it("rejects revision and timestamp combinations impossible in the v2 ledger", () => {
    const empty = context([]);
    expect(composeHoidReadingAwareRecommendations({
      ...empty,
      updatedAt: UPDATED_AT,
    }, unread, 2)).toBeNull();
    expect(composeHoidReadingAwareRecommendations({
      ...empty,
      revision: 1,
    }, unread, 2)).toBeNull();
  });

  it("requires the canonical ISO timestamp emitted by the ledger", () => {
    const reading = context([{ bookId: "twok", cursor: cursor("twok", 2) }]);
    expect(composeHoidReadingAwareRecommendations({
      ...reading,
      updatedAt: "2026-11-18T10:00:00Z",
    }, unread, 2)).toBeNull();
  });

  it("rejects positions that are not in canonical reader order", () => {
    const reading = context([
      { bookId: "twok", cursor: cursor("twok", 2), order: 1 },
      { bookId: "wor", cursor: cursor("wor", 3), order: 2 },
    ]);
    const invalid = {
      ...reading,
      positions: [...reading.positions].reverse(),
    };
    expect(composeHoidReadingAwareRecommendations(invalid, unread, 2)).toBeNull();
  });

  it("accepts an empty ledger after a durable clear with a positive revision", () => {
    const empty = context([]);
    const cleared = {
      ...empty,
      revision: 2,
      updatedAt: UPDATED_AT,
    };
    expect(composeHoidReadingAwareRecommendations(cleared, unread, 2)).toEqual(unread.slice(0, 2));
  });
});
