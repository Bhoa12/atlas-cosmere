import { describe, expect, it } from "vitest";
import { createHoidReadingCursor } from "./readingManifest";
import {
  resolveHoidReadingFocus,
  validateHoidReadingFocus,
} from "./readingFocus";

const UPDATED_AT = "2026-11-26T12:00:00.000Z";

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

describe("resolveHoidReadingFocus", () => {
  it("resolves the only active work and distinguishes the open chapter from completed reading", () => {
    const progress = snapshot([cursorPosition("twok", 7)]);
    const result = resolveHoidReadingFocus({ progress });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.focus).toMatchObject({
      bookId: "twok",
      title: "El Camino de los Reyes",
      status: "in-progress",
      currentChapter: 7,
      completedThroughChapter: 6,
      completedThroughEntireWork: false,
      authorizationEffect: "none",
    });
  });

  it("does not manufacture a completed chapter while chapter one is open", () => {
    const result = resolveHoidReadingFocus({ progress: snapshot([cursorPosition("tfe", 1)]) });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.focus.currentChapter).toBe(1);
    expect(result.focus.completedThroughChapter).toBeNull();
  });

  it("represents explicit whole-work completion without inventing a final chapter number", () => {
    const result = resolveHoidReadingFocus({
      progress: snapshot([{ bookId: "twok", completed: true }]),
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.focus).toMatchObject({
      status: "completed",
      currentChapter: null,
      completedThroughChapter: null,
      completedThroughEntireWork: true,
    });
  });

  it("requires an explicit work choice when several works are active", () => {
    const result = resolveHoidReadingFocus({
      progress: snapshot([
        cursorPosition("tfe", 3, 2),
        cursorPosition("twok", 7, 1),
      ]),
    });
    expect(result.status).toBe("selection-required");
    if (result.status !== "selection-required") return;
    expect(result.reason).toBe("multiple-active-works");
    expect(result.choices.map(choice => choice.bookId)).toEqual(["tfe", "twok"]);
  });

  it("resolves the explicitly selected work from a multi-work snapshot", () => {
    const progress = snapshot([
      cursorPosition("tfe", 3, 2),
      cursorPosition("twok", 7, 1),
    ]);
    const result = resolveHoidReadingFocus({ progress, selectedBookId: "twok" });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.focus.bookId).toBe("twok");
    expect(result.focus.currentChapter).toBe(7);
  });

  it("does not select an unstarted work merely because it is in the bibliography", () => {
    expect(resolveHoidReadingFocus({
      progress: snapshot([cursorPosition("tfe", 3)]),
      selectedBookId: "elantris",
    })).toEqual({ status: "unavailable", reason: "selected-work-not-active" });
  });

  it("requires a valid selected catalog identifier", () => {
    expect(resolveHoidReadingFocus({
      progress: snapshot([cursorPosition("tfe", 3)]),
      selectedBookId: "unknown-work",
    })).toEqual({ status: "unavailable", reason: "invalid-request" });
  });

  it("reports an empty valid snapshot without inferring a default work", () => {
    expect(resolveHoidReadingFocus({ progress: snapshot([], 0 })).status).toBe("unavailable");
    expect(resolveHoidReadingFocus({ progress: snapshot([], 0 })).status === "unavailable" &&
      resolveHoidReadingFocus({ progress: snapshot([], 0 })).reason).toBe("no-active-work");
  });

  it("rejects malformed, duplicated or stale edition-bound progress", () => {
    expect(resolveHoidReadingFocus({ progress: { schemaVersion: 1 } })).toEqual({
      status: "unavailable",
      reason: "invalid-progress",
    });

    const position = cursorPosition("twok", 7);
    expect(resolveHoidReadingFocus({
      progress: snapshot([position, position]),
    })).toEqual({ status: "unavailable", reason: "invalid-progress" });

    expect(resolveHoidReadingFocus({
      progress: snapshot([{ ...position, cursor: { ...position.cursor, chapterNumber: 99 } }]),
    })).toEqual({ status: "unavailable", reason: "invalid-progress" });
  });

  it("rejects accessor-backed requests before reading their values", () => {
    const request = Object.defineProperty(
      { progress: snapshot([cursorPosition("tfe", 3)]) },
      "selectedBookId",
      { enumerable: true, get: () => "tfe" },
    );
    expect(resolveHoidReadingFocus(request)).toEqual({
      status: "unavailable",
      reason: "invalid-request",
    });
  });

  it("exposes only progress metadata and no cursor, locator, evidence or narrative summary", () => {
    const result = resolveHoidReadingFocus({ progress: snapshot([cursorPosition("twok", 4)]) });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    const serialized = JSON.stringify(result.focus);
    expect(serialized).not.toContain("cursor");
    expect(serialized).not.toContain("locator");
    expect(serialized).not.toContain("evidence");
    expect(serialized).not.toContain("summary");
    expect(result.focus.authorizationEffect).toBe("none");
  });
});

describe("validateHoidReadingFocus", () => {
  it("accepts a focus only for the exact progress revision and fingerprint", () => {
    const progress = snapshot([cursorPosition("twok", 7)]);
    const resolved = resolveHoidReadingFocus({ progress });
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") return;
    expect(validateHoidReadingFocus(resolved.focus, progress).status).toBe("valid");
  });

  it("marks a focus stale after the reader advances", () => {
    const original = snapshot([cursorPosition("twok", 7)], 1);
    const advanced = snapshot([cursorPosition("twok", 8)], 2);
    const resolved = resolveHoidReadingFocus({ progress: original });
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") return;
    expect(validateHoidReadingFocus(resolved.focus, advanced)).toEqual({
      status: "stale",
      reason: "progress-changed",
    });
  });

  it("marks a focus stale when its work is no longer active", () => {
    const original = snapshot([cursorPosition("twok", 7)]);
    const resolved = resolveHoidReadingFocus({ progress: original });
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") return;
    expect(validateHoidReadingFocus(resolved.focus, snapshot([], 2))).toEqual({
      status: "stale",
      reason: "work-no-longer-active",
    });
  });

  it("rejects focus records with extra keys or accessors", () => {
    const progress = snapshot([cursorPosition("twok", 7)]);
    const resolved = resolveHoidReadingFocus({ progress });
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") return;

    expect(validateHoidReadingFocus({ ...resolved.focus, cursor: {} }, progress)).toEqual({
      status: "invalid",
      reason: "invalid-focus",
    });

    const accessorFocus = Object.defineProperty(
      { ...resolved.focus },
      "title",
      { enumerable: true, get: () => "forged title" },
    );
    expect(validateHoidReadingFocus(accessorFocus, progress)).toEqual({
      status: "invalid",
      reason: "invalid-focus",
    });
  });

  it("rejects invalid current progress instead of trusting a previously valid focus", () => {
    const progress = snapshot([cursorPosition("twok", 7)]);
    const resolved = resolveHoidReadingFocus({ progress });
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") return;
    expect(validateHoidReadingFocus(resolved.focus, { schemaVersion: 2 })).toEqual({
      status: "invalid",
      reason: "invalid-progress",
    });
  });
});
