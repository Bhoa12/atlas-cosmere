import { describe, expect, it } from "vitest";
import { createHoidReadingCursor } from "./readingManifest";
import { resolveHoidReadingFocusConversationScope } from "./readingFocusConversationScope";

const UPDATED_AT = "2026-11-26T13:00:00.000Z";

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

function request(
  progress: unknown,
  answerScopeMode: "automatic" | "single-work" | "cross-work" = "automatic",
  answerScopeBookIds: readonly string[] = [],
  selectedFocusBookId?: string,
) {
  return {
    progress,
    answerScopeMode,
    answerScopeBookIds,
    ...(selectedFocusBookId === undefined ? {} : { selectedFocusBookId }),
  };
}

describe("resolveHoidReadingFocusConversationScope", () => {
  it("automatically narrows a single active work and preserves exact chapter metadata locally", () => {
    const progress = snapshot([cursorPosition("tfe", 7)]);
    const result = resolveHoidReadingFocusConversationScope(request(progress));

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.source).toBe("automatic-focus");
    expect(result.scope).toEqual({ mode: "single-work", bookIds: ["tfe"] });
    expect(result.focus).toMatchObject({
      bookId: "tfe",
      currentChapter: 7,
      completedThroughChapter: 6,
      authorizationEffect: "none",
    });
  });

  it("requires an explicit focus when several works are active instead of choosing by order", () => {
    const progress = snapshot([
      cursorPosition("tfe", 3, 1),
      cursorPosition("twok", 7, 2),
    ]);
    const result = resolveHoidReadingFocusConversationScope(request(progress));

    expect(result.status).toBe("selection-required");
    if (result.status !== "selection-required") return;
    expect(result.choices.map(choice => choice.bookId)).toEqual(["tfe", "twok"]);
  });

  it("uses an explicitly selected active focus among several works", () => {
    const progress = snapshot([
      cursorPosition("tfe", 3, 1),
      cursorPosition("twok", 7, 2),
    ]);
    const result = resolveHoidReadingFocusConversationScope(
      request(progress, "automatic", [], "twok"),
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.scope).toEqual({ mode: "single-work", bookIds: ["twok"] });
    expect(result.focus?.currentChapter).toBe(7);
  });

  it("rejects a selected focus that is no longer active", () => {
    const progress = snapshot([cursorPosition("tfe", 3)], 2);
    expect(resolveHoidReadingFocusConversationScope(
      request(progress, "automatic", [], "twok"),
    )).toEqual({
      status: "unavailable",
      reason: "selected-work-not-active",
    });
  });

  it("does not invent a default when no work has started", () => {
    expect(resolveHoidReadingFocusConversationScope(request(snapshot([], 0)))).toEqual({
      status: "unavailable",
      reason: "no-active-work",
    });
  });

  it("allows explicit single-work scope only for an active, verifiable work", () => {
    const progress = snapshot([cursorPosition("twok", 8)]);
    const result = resolveHoidReadingFocusConversationScope(
      request(progress, "single-work", ["twok"]),
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.source).toBe("explicit-single-work");
    expect(result.scope).toEqual({ mode: "single-work", bookIds: ["twok"] });
    expect(result.focus?.completedThroughChapter).toBe(7);
  });

  it("blocks an explicitly selected but unstarted single work", () => {
    const progress = snapshot([cursorPosition("tfe", 3)]);
    expect(resolveHoidReadingFocusConversationScope(
      request(progress, "single-work", ["elantris"]),
    )).toEqual({
      status: "unavailable",
      reason: "selected-work-not-active",
    });
  });

  it("allows explicit cross-work scope only when every selected work is active", () => {
    const progress = snapshot([
      cursorPosition("tfe", 3, 1),
      cursorPosition("twok", 7, 2),
    ]);
    const result = resolveHoidReadingFocusConversationScope(
      request(progress, "cross-work", ["twok", "tfe"]),
    );

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.source).toBe("explicit-cross-work");
    expect(result.scope).toEqual({ mode: "cross-work", bookIds: ["tfe", "twok"] });
    expect(result.focus).toBeNull();
  });

  it("blocks a cross-work scope if even one selected work has no active progress", () => {
    const progress = snapshot([cursorPosition("tfe", 3)]);
    expect(resolveHoidReadingFocusConversationScope(
      request(progress, "cross-work", ["tfe", "elantris"]),
    )).toEqual({
      status: "unavailable",
      reason: "selected-work-not-active",
    });
  });

  it("requires two to four works for an explicit comparison", () => {
    const progress = snapshot([cursorPosition("tfe", 3)]);
    expect(resolveHoidReadingFocusConversationScope(
      request(progress, "cross-work", ["tfe"]),
    )).toEqual({
      status: "unavailable",
      reason: "invalid-scope",
    });
  });

  it("carries only the verified manifest boundary for an active single-work focus", () => {
    const progress = snapshot([cursorPosition("tfe", 3)]);
    const result = resolveHoidReadingFocusConversationScope(
      request(progress, "single-work", ["tfe"]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready" || result.focus === null) return;
    expect(result.focus.manifestId.length).toBeGreaterThan(0);
    expect(result.focus.numberedChapterCount).toBeGreaterThan(0);
    expect(result.focus.currentChapter).toBe(3);
    expect(result.focus.completedThroughChapter).toBe(2);
  });

  it("allows a completed work as an explicit single-work scope without inventing a final chapter number", () => {
    const progress = snapshot([{ bookId: "tfe", completed: true }]);
    const result = resolveHoidReadingFocusConversationScope(
      request(progress, "single-work", ["tfe"]),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready" || result.focus === null) return;
    expect(result.focus.status).toBe("completed");
    expect(result.focus.currentChapter).toBeNull();
    expect(result.focus.completedThroughChapter).toBeNull();
  });

  it("rejects an accessor-backed request before evaluating its properties", () => {
    const value = Object.defineProperty(
      request(snapshot([cursorPosition("tfe", 3)])),
      "selectedFocusBookId",
      { enumerable: true, get: () => "tfe" },
    );
    expect(resolveHoidReadingFocusConversationScope(value)).toEqual({
      status: "unavailable",
      reason: "invalid-request",
    });
  });

  it("rejects accessor-backed book identifiers", () => {
    const ids = Object.defineProperty(["tfe"], "0", {
      enumerable: true,
      configurable: true,
      get: () => "tfe",
    });
    expect(resolveHoidReadingFocusConversationScope(
      request(snapshot([cursorPosition("tfe", 3)]), "single-work", ids),
    )).toEqual({
      status: "unavailable",
      reason: "invalid-request",
    });
  });

  it("rejects invalid progress instead of trusting a previously known focus", () => {
    expect(resolveHoidReadingFocusConversationScope(
      request({ schemaVersion: 2, revision: 4 }),
    )).toEqual({
      status: "unavailable",
      reason: "invalid-progress",
    });
  });

  it("rejects contradictory focus metadata in an explicit scope mode", () => {
    expect(resolveHoidReadingFocusConversationScope(
      request(snapshot([cursorPosition("tfe", 3)]), "single-work", ["tfe"], "twok"),
    )).toEqual({
      status: "unavailable",
      reason: "invalid-request",
    });
  });

  it("never returns chapter locators, cursor data, evidence or narrative text in the scope", () => {
    const result = resolveHoidReadingFocusConversationScope(
      request(snapshot([cursorPosition("tfe", 5)])),
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(JSON.stringify(result.scope)).not.toMatch(/chapter|cursor|locator|evidence|summary/i);
    expect(result.focus?.authorizationEffect).toBe("none");
  });
});
