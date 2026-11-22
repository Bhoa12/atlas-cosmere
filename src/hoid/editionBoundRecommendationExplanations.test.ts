import { describe, expect, it } from "vitest";
import { HOID_SOURCE_BIBLIOGRAPHY } from "./bibliography";
import {
  explainEditionBoundRecommendationResult,
} from "./editionBoundRecommendationExplanations";
import {
  recommendEditionBoundReadingNextSteps,
} from "./editionBoundRecommendations";
import { createHoidReadingCursor } from "./readingManifest";

const UPDATED_AT = "2026-11-22T14:00:00.000Z";

type PositionFixture =
  | Readonly<{ bookId: string; chapter: number }>
  | Readonly<{ bookId: string; completed: true }>;

function snapshot(positions: readonly PositionFixture[] = []) {
  return {
    schemaVersion: 2,
    revision: positions.length === 0 ? 0 : 1,
    positions: positions.map(position => {
      if ("completed" in position) return { bookId: position.bookId, completed: true as const };
      const result = createHoidReadingCursor(position.bookId, position.chapter);
      if (result.status !== "ready") throw new Error("Cursor de fixture no disponible");
      return { bookId: position.bookId, cursor: result.cursor };
    }),
    updatedAt: positions.length === 0 ? null : UPDATED_AT,
  };
}

describe("edition-bound recommendation explanations", () => {
  it("explains a resume target using only the validated chapter and progress watermark", () => {
    const recommendation = recommendEditionBoundReadingNextSteps(
      snapshot([{ bookId: "tfe", chapter: 9 }]),
      1,
    );
    expect(recommendation.status).toBe("ready");
    if (recommendation.status !== "ready") return;

    const explained = explainEditionBoundRecommendationResult(recommendation);
    expect(explained.status).toBe("ready");
    if (explained.status !== "ready") return;

    expect(explained.progressRevision).toBe(1);
    expect(explained.items[0]).toMatchObject({
      sourceId: "tfe",
      title: "El Imperio Final",
      reason: "resume-current-work",
      explanationCode: "resume-current-cursor",
      heading: "Reanudar El Imperio Final",
      detail: expect.stringContaining("El cursor validado señala el capítulo 9. El progreso registrado llega hasta el capítulo 8."),
      target: {
        kind: "edition-cursor",
        cursor: { bookId: "tfe", chapterNumber: 9 },
      },
    });
    expect(explained.items[0].detail).not.toMatch(/personaje|acontecimiento|revelación|trama/i);
  });

  it("explains an unread work as a metadata-only chapter-one starting point", () => {
    const recommendation = recommendEditionBoundReadingNextSteps(snapshot(), 1);
    expect(recommendation.status).toBe("ready");
    if (recommendation.status !== "ready") return;

    const explained = explainEditionBoundRecommendationResult(recommendation);
    expect(explained.status).toBe("ready");
    if (explained.status !== "ready") return;

    expect(explained.items[0]).toMatchObject({
      sourceId: "tfe",
      reason: "unread-source",
      explanationCode: "start-first-numbered-chapter",
      heading: "Empezar El Imperio Final",
    });
    expect(explained.items[0].detail).toContain("iniciar por el capítulo 1");
  });

  it("explains an unsegmented work without inventing a chapter or locator", () => {
    const positions = HOID_SOURCE_BIBLIOGRAPHY
      .filter(work => work.id !== "white-sand-1")
      .map(work => ({ bookId: work.id, completed: true as const }));
    const recommendation = recommendEditionBoundReadingNextSteps(snapshot(positions), 1);
    expect(recommendation.status).toBe("ready");
    if (recommendation.status !== "ready") return;

    const explained = explainEditionBoundRecommendationResult(recommendation);
    expect(explained.status).toBe("ready");
    if (explained.status !== "ready") return;

    expect(explained.items[0]).toMatchObject({
      sourceId: "white-sand-1",
      explanationCode: "catalog-only-unsegmented",
      target: { kind: "catalog-only", reason: "segmentation-unverified" },
    });
    expect(explained.items[0].detail).toContain("no se inventa un capítulo ni una ruta de navegación");
  });

  it("presents an explicit choice when several works are active", () => {
    const recommendation = recommendEditionBoundReadingNextSteps(snapshot([
      { bookId: "tfe", chapter: 8 },
      { bookId: "elantris", chapter: 3 },
    ]), 3);
    expect(recommendation.status).toBe("selection-required");
    if (recommendation.status !== "selection-required") return;

    const explained = explainEditionBoundRecommendationResult(recommendation);
    expect(explained.status).toBe("selection-required");
    if (explained.status !== "selection-required") return;

    expect(explained.heading).toBe("Elige qué obra quieres reanudar");
    expect(explained.detail).toContain("no elegirá una por ti");
    expect(explained.choices.map(choice => choice.sourceId)).toEqual(["tfe", "elantris"]);
    expect(explained.choices[0].detail).toContain("progreso llega hasta el capítulo 7");
    expect(explained.choices[1].detail).toContain("progreso llega hasta el capítulo 2");
    expect(Object.isFrozen(explained.choices)).toBe(true);
  });

  it("preserves an unavailable result without fabricating an explanation", () => {
    const explained = explainEditionBoundRecommendationResult({
      status: "unavailable",
      reason: "invalid-progress",
    });
    expect(explained).toEqual({
      status: "unavailable",
      reason: "invalid-progress",
    });
  });

  it("keeps the original edition-bound target available to the navigation layer", () => {
    const recommendation = recommendEditionBoundReadingNextSteps(
      snapshot([{ bookId: "tfe", chapter: 9 }]),
      1,
    );
    expect(recommendation.status).toBe("ready");
    if (recommendation.status !== "ready") return;

    const explained = explainEditionBoundRecommendationResult(recommendation);
    expect(explained.status).toBe("ready");
    if (explained.status !== "ready") return;

    const target = explained.items[0].target;
    expect(target.kind).toBe("edition-cursor");
    if (target.kind !== "edition-cursor") return;
    expect(target.navigationSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(target.cursor.manifestId).toBeTruthy();
  });
});
