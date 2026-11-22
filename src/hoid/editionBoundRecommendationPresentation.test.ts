import { describe, expect, it } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import { createHoidEditionBoundRecommendationPresentation } from "./editionBoundRecommendationPresentation";
import { projectHoidCursorProgressSnapshot } from "./cursorEvidenceRuntime";
import { fingerprintHoidCursorProgressProjection } from "./knowledgeGraph";
import { createHoidReadingCursor } from "./readingManifest";

const UPDATED_AT = "2026-11-22T15:00:00.000Z";

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
      1,
    );
    expect(result).toMatchObject({
      status: "ready",
      progressRevision: 1,
      progressFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
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
      3,
    );
    expect(result).toMatchObject({
      status: "selection-required",
      progressRevision: 1,
      progressFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
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
      2,
      "elantris",
    );
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.items[0]).toMatchObject({
      sourceId: "elantris",
      reason: "resume-current-work",
      target: {
        kind: "edition-cursor",
        cursor: { bookId: "elantris", chapterNumber: 3 },
      },
    });
    expect(result.items[0].detail).toContain("El cursor validado señala el capítulo 3.");
  });

  it("preserves catalog-only status for an unsegmented work", () => {
    const completed = HOID_SOURCE_BIBLIOGRAPHY
      .filter(work => work.id !== "white-sand-1")
      .map(work => ({ bookId: work.id, completed: true as const }));
    const result = createHoidEditionBoundRecommendationPresentation(
      snapshot(completed, 1),
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

  it("derives a canonical fingerprint from the exact snapshot contents", () => {
    const progress = snapshot([{ bookId: "tfe", chapter: 9 }]);
    const first = createHoidEditionBoundRecommendationPresentation(progress, 1);
    const second = createHoidEditionBoundRecommendationPresentation(progress, 1);
    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    if (first.status !== "ready" || second.status !== "ready") return;
    expect(first.progressFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(second.progressFingerprint).toBe(first.progressFingerprint);
  });

  it("matches the exact fingerprint used by HoidScreen's live progress scope", () => {
    const progress = snapshot([{ bookId: "tfe", chapter: 9 }]);
    const projection = projectHoidCursorProgressSnapshot(progress);
    expect(projection.status).toBe("ready");
    if (projection.status !== "ready") return;

    const presentation = createHoidEditionBoundRecommendationPresentation(progress, 1);
    expect(presentation.status).toBe("ready");
    if (presentation.status !== "ready") return;

    expect(presentation.progressFingerprint).toBe(
      fingerprintHoidCursorProgressProjection(projection),
    );
  });

  it("uses one canonical snapshot even when an untrusted proxy changes between reads", () => {
    const original = snapshot([{ bookId: "tfe", chapter: 9 }]);
    const alternatePositions = snapshot([{ bookId: "tfe", chapter: 10 }]).positions;
    let positionsReads = 0;
    const unstable = new Proxy(original, {
      getOwnPropertyDescriptor(target, property) {
        const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
        if (property === "positions" && descriptor && "value" in descriptor) {
          positionsReads += 1;
          return {
            ...descriptor,
            value: positionsReads === 1 ? descriptor.value : alternatePositions,
          };
        }
        return descriptor;
      },
    });

    const result = createHoidEditionBoundRecommendationPresentation(unstable, 1);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;

    expect(positionsReads).toBe(1);
    expect(result.items[0].target).toMatchObject({
      kind: "edition-cursor",
      cursor: { bookId: "tfe", chapterNumber: 9 },
    });
  });

  it("changes the fingerprint when the cursor changes at the same revision", () => {
    const first = createHoidEditionBoundRecommendationPresentation(
      snapshot([{ bookId: "tfe", chapter: 9 }], 1),
      1,
    );
    const second = createHoidEditionBoundRecommendationPresentation(
      snapshot([{ bookId: "tfe", chapter: 10 }], 1),
      1,
    );
    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    if (first.status !== "ready" || second.status !== "ready") return;
    expect(first.progressRevision).toBe(second.progressRevision);
    expect(first.progressFingerprint).not.toBe(second.progressFingerprint);
  });

  it("rejects invalid progress and invalid active-work selections", () => {
    // Revision zero is only valid for the canonical empty snapshot.
    expect(createHoidEditionBoundRecommendationPresentation(
      { schemaVersion: 2, revision: 0, positions: [], updatedAt: UPDATED_AT },
      1,
    )).toEqual({ status: "unavailable", reason: "invalid-progress" });

    expect(createHoidEditionBoundRecommendationPresentation(
      snapshot([{ bookId: "tfe", chapter: 9 }]),
      1,
      "elantris",
    )).toEqual({ status: "unavailable", reason: "invalid-active-work" });
  });

  it("allows a canonical empty snapshot to discover the first verified numbered chapter", () => {
    const result = createHoidEditionBoundRecommendationPresentation(snapshot(), 1);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.items[0]).toMatchObject({
      sourceId: "tfe",
      reason: "unread-source",
      explanationCode: "start-first-numbered-chapter",
      target: {
        kind: "edition-cursor",
        cursor: { bookId: "tfe", chapterNumber: 1 },
      },
    });
  });

  it("rejects a non-finite recommendation limit", () => {
    const result = createHoidEditionBoundRecommendationPresentation(
      snapshot(),
      Number.NaN,
    );
    expect(result).toEqual({ status: "unavailable", reason: "invalid-limit" });
  });

  it("does not mutate the authoritative progress snapshot", () => {
    const progress = snapshot([{ bookId: "tfe", chapter: 9 }]);
    const before = JSON.stringify(progress);
    createHoidEditionBoundRecommendationPresentation(progress, 1);
    expect(JSON.stringify(progress)).toBe(before);
  });
});
