import { describe, expect, it } from "vitest";
import { createHoidReadingCursor } from "./readingManifest";
import { resolveHoidRereadRequest } from "./rereadRequest";

const UPDATED_AT = "2026-11-26T11:00:00.000Z";

function cursor(bookId: string, chapterNumber: number) {
  const result = createHoidReadingCursor(bookId, chapterNumber);
  if (result.status !== "ready") throw new Error("Cursor de fixture no disponible");
  return result.cursor;
}

function snapshot(
  positions: readonly (
    | Readonly<{ bookId: string; completed: true }>
    | Readonly<{ bookId: string; chapter: number }>
  )[] = [],
) {
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

describe("explicit progress-bound Hoid reread requests", () => {
  it("allows a manual chapter-one reread only for a named, completed work", () => {
    const result = resolveHoidRereadRequest(
      "Quiero volver a leer El Imperio Final",
      snapshot([{ bookId: "tfe", completed: true }]),
    );
    expect(result).toMatchObject({
      status: "ready",
      sourceId: "tfe",
      title: "El Imperio Final",
      startChapter: 1,
      selection: "manual-reader-selection-required",
      progressRevision: 1,
    });
    if (result.status === "ready") {
      expect(result.progressFingerprint).toMatch(/^[a-f0-9]{64}$/u);
      expect(result).not.toHaveProperty("cursor");
      expect(result).not.toHaveProperty("locatorId");
    }
  });

  it("does not misclassify an in-progress work as a reread", () => {
    expect(resolveHoidRereadRequest(
      "Quiero releer El Imperio Final",
      snapshot([{ bookId: "tfe", chapter: 9 }]),
    )).toMatchObject({
      status: "not-completed",
      reason: "in-progress",
      sourceId: "tfe",
      currentChapter: 9,
      completedThroughChapter: 8,
    });
  });

  it("does not misclassify an unstarted work as a reread", () => {
    expect(resolveHoidRereadRequest(
      "Me gustaría releer Elantris",
      snapshot(),
    )).toMatchObject({
      status: "not-completed",
      reason: "not-started",
      sourceId: "elantris",
    });
  });

  it("requires an exact catalog title instead of guessing the intended work", () => {
    expect(resolveHoidRereadRequest(
      "Quiero releer una novela",
      snapshot([{ bookId: "tfe", completed: true }]),
    )).toEqual({
      status: "needs-clarification",
      reason: "work-not-mentioned",
    });
  });

  it("requires the reader to name one work, not several", () => {
    expect(resolveHoidRereadRequest(
      "Quiero releer El Imperio Final y Elantris",
      snapshot([
        { bookId: "tfe", completed: true },
        { bookId: "elantris", completed: true },
      ]),
    )).toEqual({
      status: "needs-clarification",
      reason: "multiple-works-mentioned",
    });
  });

  it("does not activate the reread path for an ordinary question", () => {
    expect(resolveHoidRereadRequest(
      "¿Qué ocurre en El Imperio Final?",
      snapshot([{ bookId: "tfe", completed: true }]),
    )).toEqual({ status: "not-request" });
  });

  it("normalizes accents and punctuation without changing the catalog identity", () => {
    expect(resolveHoidRereadRequest(
      "¡Me apetece releer EL IMPERIO FINAL!",
      snapshot([{ bookId: "tfe", completed: true }]),
    )).toMatchObject({ status: "ready", sourceId: "tfe", startChapter: 1 });
  });

  it("blocks malformed progress instead of trusting the completion flag", () => {
    expect(resolveHoidRereadRequest(
      "Quiero releer El Imperio Final",
      {
        schemaVersion: 2,
        revision: 1,
        positions: [{ bookId: "tfe", completed: false }],
        updatedAt: UPDATED_AT,
      },
    )).toEqual({ status: "blocked", reason: "invalid-progress" });
  });

  it("does not mutate the reader progress snapshot", () => {
    const progress = snapshot([{ bookId: "tfe", completed: true }]);
    const before = JSON.stringify(progress);
    resolveHoidRereadRequest("Quiero releer El Imperio Final", progress);
    expect(JSON.stringify(progress)).toBe(before);
  });

  it("rejects malformed questions and control characters", () => {
    expect(resolveHoidRereadRequest(" Quiero releer El Imperio Final", snapshot()))
      .toEqual({ status: "blocked", reason: "invalid-question" });
    expect(resolveHoidRereadRequest("Quiero releer\\u0000 El Imperio Final", snapshot()))
      .toEqual({ status: "blocked", reason: "invalid-question" });
  });
});
