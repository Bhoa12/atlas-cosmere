import { describe, expect, it } from "vitest";
import { createHoidEditionBoundRecommendationPresentation } from "./editionBoundRecommendationPresentation";
import { validateHoidEditionBoundRecommendationFreshness } from "./editionBoundRecommendationFreshness";
import {
  projectHoidCursorProgressSnapshot,
  type HoidCursorProgressProjection,
} from "./cursorEvidenceRuntime";
import { createHoidReadingCursor } from "./readingManifest";

const UPDATED_AT = "2026-11-23T09:00:00.000Z";

function snapshot(bookId = "tfe", chapter = 9, revision = 1) {
  const cursor = createHoidReadingCursor(bookId, chapter);
  if (cursor.status !== "ready") throw new Error("Cursor de fixture no disponible");
  return {
    schemaVersion: 2,
    revision,
    positions: [{ bookId, cursor: cursor.cursor }],
    updatedAt: UPDATED_AT,
  };
}

function projection(progress: unknown): HoidCursorProgressProjection {
  return projectHoidCursorProgressSnapshot(progress);
}

describe("edition-bound recommendation freshness", () => {
  it("accepts a ready recommendation bound to the exact live projection", () => {
    const progress = snapshot();
    const presentation = createHoidEditionBoundRecommendationPresentation(progress, 1);
    expect(presentation.status).toBe("ready");
    expect(validateHoidEditionBoundRecommendationFreshness(
      presentation,
      projection(progress),
    )).toBe("current");
  });

  it("accepts a multi-work selection bound to the exact live projection", () => {
    const first = createHoidReadingCursor("tfe", 8);
    const second = createHoidReadingCursor("elantris", 3);
    if (first.status !== "ready" || second.status !== "ready") {
      throw new Error("Cursores de fixture no disponibles");
    }
    const progress = {
      schemaVersion: 2,
      revision: 1,
      positions: [
        { bookId: "tfe", cursor: first.cursor },
        { bookId: "elantris", cursor: second.cursor },
      ],
      updatedAt: UPDATED_AT,
    };
    const presentation = createHoidEditionBoundRecommendationPresentation(progress, 3);
    expect(presentation.status).toBe("selection-required");
    expect(validateHoidEditionBoundRecommendationFreshness(
      presentation,
      projection(progress),
    )).toBe("current");
  });

  it("marks a recommendation stale when the cursor changes at the same revision", () => {
    const original = snapshot("tfe", 9, 4);
    const changed = snapshot("tfe", 10, 4);
    const presentation = createHoidEditionBoundRecommendationPresentation(original, 1);
    expect(presentation.status).toBe("ready");
    expect(validateHoidEditionBoundRecommendationFreshness(
      presentation,
      projection(changed),
    )).toBe("stale");
  });

  it("marks a recommendation stale when the ledger revision changes", () => {
    const original = snapshot("tfe", 9, 4);
    const changed = snapshot("tfe", 9, 5);
    const presentation = createHoidEditionBoundRecommendationPresentation(original, 1);
    expect(presentation.status).toBe("ready");
    expect(validateHoidEditionBoundRecommendationFreshness(
      presentation,
      projection(changed),
    )).toBe("stale");
  });

  it("rejects malformed bindings, unexpected keys and sparse recommendation arrays", () => {
    const progress = snapshot();
    const presentation = createHoidEditionBoundRecommendationPresentation(progress, 1);
    expect(presentation.status).toBe("ready");
    if (presentation.status !== "ready") return;

    expect(validateHoidEditionBoundRecommendationFreshness(
      { ...presentation, progressFingerprint: "not-a-digest" },
      projection(progress),
    )).toBe("invalid-presentation");

    expect(validateHoidEditionBoundRecommendationFreshness(
      { ...presentation, unexpected: true },
      projection(progress),
    )).toBe("invalid-presentation");

    expect(validateHoidEditionBoundRecommendationFreshness(
      { ...presentation, items: new Array(1) },
      projection(progress),
    )).toBe("invalid-presentation");
  });

  it("rejects accessor-backed bindings without executing getters", () => {
    const progress = snapshot();
    const presentation = createHoidEditionBoundRecommendationPresentation(progress, 1);
    expect(presentation.status).toBe("ready");
    if (presentation.status !== "ready") return;

    let getterCalls = 0;
    const accessor = { ...presentation };
    Object.defineProperty(accessor, "progressFingerprint", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return presentation.progressFingerprint;
      },
    });

    expect(validateHoidEditionBoundRecommendationFreshness(
      accessor,
      projection(progress),
    )).toBe("invalid-presentation");
    expect(getterCalls).toBe(0);
  });

  it("contains throwing proxy traps", () => {
    const progress = snapshot();
    const presentation = createHoidEditionBoundRecommendationPresentation(progress, 1);
    expect(presentation.status).toBe("ready");
    const hostile = new Proxy(presentation, {
      ownKeys() {
        throw new Error("synthetic proxy trap");
      },
    });

    expect(validateHoidEditionBoundRecommendationFreshness(
      hostile,
      projection(progress),
    )).toBe("invalid-presentation");
  });

  it("fails closed when the current progress projection is unavailable", () => {
    const progress = snapshot();
    const presentation = createHoidEditionBoundRecommendationPresentation(progress, 1);
    expect(presentation.status).toBe("ready");

    expect(validateHoidEditionBoundRecommendationFreshness(
      presentation,
      { status: "unavailable", reason: "invalid-snapshot" } as HoidCursorProgressProjection,
    )).toBe("invalid-progress");
  });
});
