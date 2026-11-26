import { describe, expect, it } from "vitest";
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

  it("explains why Hoid abstains when there is no active work and no approved path", () => {
    const recommendation = recommendEditionBoundReadingNextSteps(snapshot(), 1);
    expect(recommendation).toEqual({
      status: "no-safe-next-work",
      reason: "no-active-work",
      progressRevision: 0,
    });
    const explained = explainEditionBoundRecommendationResult(recommendation);
    expect(explained).toMatchObject({
      status: "no-safe-next-work",
      reason: "no-active-work",
      progressRevision: 0,
      heading: "No hay una ruta de lectura aprobada",
    });
    expect(explained.status === "no-safe-next-work" ? explained.detail : "")
      .toContain("no elegirá otra por orden bibliográfico");
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


  it("rejects forged catalogue identities and titles", () => {
    const recommendation = recommendEditionBoundReadingNextSteps(
      snapshot([{ bookId: "tfe", chapter: 9 }]),
      1,
    );
    expect(recommendation.status).toBe("ready");
    if (recommendation.status !== "ready") return;

    expect(explainEditionBoundRecommendationResult({
      ...recommendation,
      items: [{ ...recommendation.items[0], title: "Título manipulado" }],
    })).toEqual({ status: "unavailable", reason: "invalid-recommendation" });

    expect(explainEditionBoundRecommendationResult({
      ...recommendation,
      items: [{ ...recommendation.items[0], sourceId: "unknown-work" }],
    })).toEqual({ status: "unavailable", reason: "invalid-recommendation" });
  });

  it("rejects a completed-through watermark that does not precede the current chapter in the manifest", () => {
    const recommendation = recommendEditionBoundReadingNextSteps(
      snapshot([{ bookId: "tfe", chapter: 9 }]),
      1,
    );
    expect(recommendation.status).toBe("ready");
    if (recommendation.status !== "ready") return;

    expect(explainEditionBoundRecommendationResult({
      ...recommendation,
      items: [{
        ...recommendation.items[0],
        completedThroughChapter: 7,
      }],
    })).toEqual({ status: "unavailable", reason: "invalid-recommendation" });
  });

  it("rejects a substituted edition locator even when the chapter number is unchanged", () => {
    const recommendation = recommendEditionBoundReadingNextSteps(
      snapshot([{ bookId: "tfe", chapter: 9 }]),
      1,
    );
    expect(recommendation.status).toBe("ready");
    if (recommendation.status !== "ready") return;
    const target = recommendation.items[0].target;
    expect(target.kind).toBe("edition-cursor");
    if (target.kind !== "edition-cursor" || !target.locatorId) return;

    expect(explainEditionBoundRecommendationResult({
      ...recommendation,
      items: [{
        ...recommendation.items[0],
        target: { ...target, locatorId: "nav:forged:chapter.xhtml" },
      }],
    })).toEqual({ status: "unavailable", reason: "invalid-recommendation" });
  });

  it("rejects multiple resume items and legacy unread-source recommendations", () => {
    const first = recommendEditionBoundReadingNextSteps(snapshot([{ bookId: "tfe", chapter: 8 }]), 1);
    const second = recommendEditionBoundReadingNextSteps(snapshot([{ bookId: "elantris", chapter: 3 }]), 1);
    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    if (first.status !== "ready" || second.status !== "ready") return;
    expect(explainEditionBoundRecommendationResult({
      status: "ready",
      progressRevision: 1,
      items: [...first.items, ...second.items],
    })).toEqual({ status: "unavailable", reason: "invalid-recommendation" });
    expect(explainEditionBoundRecommendationResult({
      ...first,
      items: [{ ...first.items[0], reason: "unread-source" }],
    })).toEqual({ status: "unavailable", reason: "invalid-recommendation" });
  });

  it("rejects duplicate or out-of-order explicit resume choices", () => {
    const recommendation = recommendEditionBoundReadingNextSteps(snapshot([
      { bookId: "tfe", chapter: 8 },
      { bookId: "elantris", chapter: 3 },
    ]), 3);
    expect(recommendation.status).toBe("selection-required");
    if (recommendation.status !== "selection-required") return;

    expect(explainEditionBoundRecommendationResult({
      ...recommendation,
      choices: [...recommendation.choices].reverse(),
    })).toEqual({ status: "unavailable", reason: "invalid-recommendation" });

    expect(explainEditionBoundRecommendationResult({
      ...recommendation,
      choices: [recommendation.choices[0], recommendation.choices[0]],
    })).toEqual({ status: "unavailable", reason: "invalid-recommendation" });
  });

  it("rejects accessor-backed result fields without invoking their getters", () => {
    const recommendation = recommendEditionBoundReadingNextSteps(
      snapshot([{ bookId: "tfe", chapter: 9 }]),
      1,
    );
    expect(recommendation.status).toBe("ready");
    if (recommendation.status !== "ready") return;

    let getterCalls = 0;
    const accessorResult = { ...recommendation };
    Object.defineProperty(accessorResult, "items", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return recommendation.items;
      },
    });

    expect(explainEditionBoundRecommendationResult(accessorResult)).toEqual({
      status: "unavailable",
      reason: "invalid-recommendation",
    });
    expect(getterCalls).toBe(0);
  });

  it("contains throwing proxy traps and rejects sparse arrays and extra properties", () => {
    const recommendation = recommendEditionBoundReadingNextSteps(
      snapshot([{ bookId: "tfe", chapter: 9 }]),
      1,
    );
    expect(recommendation.status).toBe("ready");
    if (recommendation.status !== "ready") return;

    const throwingProxy = new Proxy(recommendation, {
      ownKeys() {
        throw new Error("synthetic proxy trap");
      },
    });
    expect(explainEditionBoundRecommendationResult(throwingProxy)).toEqual({
      status: "unavailable",
      reason: "invalid-recommendation",
    });

    expect(explainEditionBoundRecommendationResult({
      ...recommendation,
      items: new Array(1),
    })).toEqual({ status: "unavailable", reason: "invalid-recommendation" });

    expect(explainEditionBoundRecommendationResult({
      ...recommendation,
      unexpected: true,
    })).toEqual({ status: "unavailable", reason: "invalid-recommendation" });

    expect(explainEditionBoundRecommendationResult({
      ...recommendation,
      progressRevision: -1,
    })).toEqual({ status: "unavailable", reason: "invalid-recommendation" });
  });

});
