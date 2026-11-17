import { describe, expect, it, vi } from "vitest";
import { createHoidEvidenceRuntime } from "./evidenceRuntime";
import { getHoidReadingManifest } from "./readingManifest";

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Manifest de prueba no disponible");
  const unit = result.manifest.units.find(candidate => candidate.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Localizador de prueba no disponible");
  return unit.locatorId;
}

const knowledge = [{
  id: "e-test-character",
  aliases: ["Personaje de prueba"],
  kind: "character" as const,
  firstSafeAppearance: { bookId: "twok", chapter: 1 },
  evidenceSource: { bookId: "twok", chapter: 1, locatorId: locator("twok", 1) },
  evidenceUnlock: { bookId: "twok", chapter: 1 },
  provenance: "verified" as const,
  summary: "Resumen editorial sintético para una prueba de autorización.",
}];

const claims = [{
  id: "claim-test-character",
  text: "Afirmación editorial sintética.",
  intent: "explain" as const,
  evidenceIds: ["e-test-character"],
  review: {
    status: "approved" as const,
    origin: "original-editorial" as const,
    reviewerId: "synthetic-test-reviewer",
    reviewedAt: "2026-11-16T00:00:00.000Z",
  },
}];

describe("completion spoofing regression", () => {
  it("does not treat a chapter plus completed=true as permission to reveal the whole work", async () => {
    const selector = vi.fn(async () => ["claim-test-character"]);
    const runtime = createHoidEvidenceRuntime({
      knowledge,
      claims,
      selector: { selectClaims: selector },
    });

    const result = await runtime!.answer({
      question: "¿Quién es Personaje de prueba?",
      reading: [{ bookId: "twok", chapter: 1, completed: true }],
    });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("invalid-input");
    expect(result.claimIds).toEqual([]);
    expect(selector).not.toHaveBeenCalled();
  });

  it("does not treat an invalid chapter plus completed=true as completion", async () => {
    const selector = vi.fn(async () => ["claim-test-character"]);
    const runtime = createHoidEvidenceRuntime({
      knowledge,
      claims,
      selector: { selectClaims: selector },
    });

    const result = await runtime!.answer({
      question: "¿Quién es Personaje de prueba?",
      reading: [{ bookId: "twok", chapter: -1, completed: true }],
    });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("invalid-input");
    expect(selector).not.toHaveBeenCalled();
  });

  it("abstains from recommendations when completion metadata is contradictory", () => {
    const runtime = createHoidEvidenceRuntime({ knowledge, claims, selector: null });
    const result = runtime!.recommend([
      { bookId: "twok", chapter: 1, completed: true },
    ]);

    expect(result.status).toBe("abstain");
    if (result.status === "abstain") expect(result.reason).toBe("invalid-progress");
  });
});
