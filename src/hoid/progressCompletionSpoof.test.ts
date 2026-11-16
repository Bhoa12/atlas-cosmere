import { describe, expect, it, vi } from "vitest";
import { createHoidEvidenceRuntime } from "./evidenceRuntime";

const knowledge = [{
  id: "e-tfe-character",
  aliases: ["Sazed"],
  kind: "character" as const,
  firstSafeAppearance: { bookId: "tfe", chapter: 1 },
  evidenceSource: { bookId: "tfe", chapter: 1, locatorId: "synthetic-tfe-unit-1" },
  evidenceUnlock: { bookId: "tfe", chapter: 1 },
  provenance: "verified" as const,
  summary: "Resumen editorial sintético para una prueba de autorización.",
}];

const claims = [{
  id: "claim-tfe-character",
  text: "Afirmación editorial sintética.",
  intent: "explain" as const,
  evidenceIds: ["e-tfe-character"],
  review: {
    status: "approved" as const,
    origin: "original-editorial" as const,
    reviewerId: "synthetic-test-reviewer",
    reviewedAt: "2026-11-16T00:00:00.000Z",
  },
}];

describe("completion spoofing regression", () => {
  it("does not treat a chapter plus completed=true as permission to reveal the whole work", async () => {
    const selector = vi.fn(async () => ["claim-tfe-character"]);
    const runtime = createHoidEvidenceRuntime({
      knowledge,
      claims,
      selector: { selectClaims: selector },
    });

    const result = await runtime!.answer({
      question: "¿Quién es Sazed?",
      reading: [{ bookId: "tfe", chapter: 1, completed: true }],
    });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("invalid-input");
    expect(result.claimIds).toEqual([]);
    expect(selector).not.toHaveBeenCalled();
  });

  it("does not treat an invalid chapter plus completed=true as completion", async () => {
    const selector = vi.fn(async () => ["claim-tfe-character"]);
    const runtime = createHoidEvidenceRuntime({
      knowledge,
      claims,
      selector: { selectClaims: selector },
    });

    const result = await runtime!.answer({
      question: "¿Quién es Sazed?",
      reading: [{ bookId: "tfe", chapter: -1, completed: true }],
    });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("invalid-input");
    expect(selector).not.toHaveBeenCalled();
  });

  it("abstains from recommendations when completion metadata is contradictory", () => {
    const runtime = createHoidEvidenceRuntime({ knowledge, claims, selector: null });
    const result = runtime!.recommend([
      { bookId: "tfe", chapter: 1, completed: true },
    ]);

    expect(result.status).toBe("abstain");
    if (result.status === "abstain") expect(result.reason).toBe("invalid-progress");
  });
});
