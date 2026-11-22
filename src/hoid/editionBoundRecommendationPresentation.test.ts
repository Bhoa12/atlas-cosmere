import { describe, expect, it } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { createHoidEditionBoundRecommendationPresentation } from "./editionBoundRecommendationPresentation";
import { createHoidReadingCursor } from "./readingManifest";

const UPDATED_AT = "2026-11-22T15:00:00.000Z";
const IDENTITY = Object.freeze({ revision: 1, fingerprint: "a".repeat(64) });

type PositionFixture =
  | Readonly<{ bookId: string; chapter: number }>
  | Readonly<{ bookId: string; completed: true }>;

function snapshot(positions: readonly PositionFixture[] = [], revision?: number) {
  return {
    schemaVersion: 2,
    revision: revision ?? (positions.length === 0 ? 0 : 1),
    positions: positions.map(position => {
      if ("completed" in position) return { bookId: position.bookId, completed: true as const };
      const result = createHoidReadingCursor(position.bookId, position.chapter);
      if (result.status !== "ready") throw new Error("Cursor de fixture no disponible");
      return { bookId: position.bookId, cursor: result.cursor };
    }),
    updatedAt: positions.length === 0 ? null : UPDATED_AT,
  };
}

describe("edition-bound recommendation presentation adapter", () => {
  it("binds a single-work resume explanation to the exact progress identity", () => {
    const result = createHoidEditionBoundRecommendationPresentation(
      snapshot([{ bookId: "tfe", chapter: 9 }]),
      IDENTITY,
      1,
    );
    expect(result).toMatchObject({
      status: "ready",
      progressRevision: 1,
      progressFingerprint: IDENTITY.fingerprint,
      items: [{
        sourceId: "tfe",
        explanationCode: "resume-current-cursor",
        target: { kind: "edition-cursor", cursor: { chapterNumber: 9 } },
      }],
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("keeps multiple active works as an explicit selection state with no discovery items", () => {
    const result = createHoidEditionBoundRecommendationPresentation(
      snapshot([
        { bookId: "tfe", chapter: 8 },
        { bookId: "elantris", chapter: 3 },
      ]),
      IDENTITY,
      3,
    );
    expect(result).toMatchObject({
      status: "selection-required",
      progressRevision: 1,
      progressFingerprint: IDENTITY.fingerprint,
      choices: [
        { sourceId: "tfe", currentChapter: 8, completedThroughChapter: 7 },
        { sourceId: "elantris", currentChapter: 3, completedThroughChapter: 2 },
      ],
    });
    expect("items" in result).toBe(false);
  });

  it("returns the selected work as the resume target after explicit selection", () => {
    const result = createHoidEditionBoundRecommendationPresentation(
      snapshot([
        { bookId: "tfe", chapter: 8 },
        { bookId: "elantris", chapter: 3 },
      ]),
      IDENTITY,
      2,
      "elantris",
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.items[0]).toMatchObject({
      sourceId: "elantris",
      reason: "resume-current-work",
      currentChapter: 3,
    });
  });

  it("preserves catalog-only status for an unsegmented work", () => {
    const completed = HOID_SOURCE_BIBLIOGRAPHY
      .filter(work => work.id !== "white-sand-1")
      .map(work => ({ bookId: work.id, completed: true as const }));
    const result = createHoidEditionBoundRecommendationPresentation(
      snapshot(completed, 1),
      IDENTITY,
      1,
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.items[0]).toMatchObject({
      sourceId: "white-sand-1",
      explanationCode: "catalog-only-unsegmented",
      target: { kind: "catalog-only", reason: "segmentation-unverified" },
    });
  });

  it("rejects an identity whose revision does not match the validated snapshot", () => {
    const result = createHoidEditionBoundRecommendationPresentation(
      snapshot([{ bookId: "tfe", chapter: 9 }]),
      { revision: 2, fingerprint: IDENTITY.fingerprint },
      1,
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-progress" });
  });

  it("rejects a malformed progress fingerprint", () => {
    const result = createHoidEditionBoundRecommendationPresentation(
      snapshot([{ bookId: "tfe", chapter: 9 }]),
      { revision: 1, fingerprint: "not-a-sha256-digest" },
      1,
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-progress" });
  });

  it("rejects invalid progress and invalid active-work selections", () => {
    expect(createHoidEditionBoundRecommendationPresentation(
      { schemaVersion: 2, revision: 1, positions: [], updatedAt: UPDATED_AT },
      IDENTITY,
      1,
    )).toEqual({ status: "unavailable", reason: "invalid-progress" });

    expect(createHoidEditionBoundRecommendationPresentation(
      snapshot([{ bookId: "tfe", chapter: 9 }]),
      IDENTITY,
      1,
      "elantris",
    )).toEqual({ status: "unavailable", reason: "invalid-active-work" });
  });

  it("rejects a non-finite recommendation limit", () => {
    const result = createHoidEditionBoundRecommendationPresentation(
      snapshot(),
      { revision: 0, fingerprint: "b".repeat(64) },
      Number.NaN,
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-limit" });
  });

  it("does not mutate the authoritative progress snapshot", () => {
    const progress = snapshot([{ bookId: "tfe", chapter: 9 }]);
    const before = JSON.stringify(progress);
    createHoidEditionBoundRecommendationPresentation(progress, IDENTITY, 1);
    expect(JSON.stringify(progress)).toBe(before);
  });
});
