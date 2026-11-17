import { describe, expect, it, vi } from "vitest";
import {
  createHoidEvidenceRuntime,
  type HoidApprovedClaim,
  type HoidClaimSelectionRequest,
} from "./evidenceRuntime";
import type { HoidKnowledgeEntry } from "./catalog";
import { getHoidReadingManifest } from "./readingManifest";

function locator(bookId: string, chapter: number): string {
  const result = getHoidReadingManifest(bookId);
  if (result.status !== "ready") throw new Error("Manifest de prueba no disponible");
  const unit = result.manifest.units.find(candidate => candidate.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Localizador de prueba no disponible");
  return unit.locatorId;
}

const knowledge: HoidKnowledgeEntry[] = [
  {
    id: "e-alpha",
    aliases: ["Personaje Alfa"],
    kind: "character",
    firstSafeAppearance: { bookId: "twok", chapter: 2 },
    evidenceSource: { bookId: "twok", chapter: 2, locatorId: locator("twok", 2) },
    evidenceUnlock: { bookId: "twok", chapter: 2 },
    provenance: "verified",
    summary: "Resumen editorial original de prueba sobre Personaje Alfa.",
  },
  {
    id: "e-beta",
    aliases: ["Personaje Beta"],
    kind: "character",
    firstSafeAppearance: { bookId: "wor", chapter: 3 },
    evidenceSource: { bookId: "wor", chapter: 3, locatorId: locator("wor", 3) },
    evidenceUnlock: { bookId: "wor", chapter: 3 },
    provenance: "verified",
    summary: "Resumen editorial original de prueba sobre Personaje Beta.",
  },
  {
    id: "e-limited",
    aliases: ["Concepto limitado"],
    kind: "concept",
    firstSafeAppearance: { bookId: "twok", chapter: 1 },
    evidenceSource: { bookId: "twok", chapter: 1, locatorId: locator("twok", 1) },
    evidenceUnlock: { bookId: "twok", chapter: 1 },
    provenance: "limited",
    summary: "Resumen que todavía no puede utilizarse como evidencia.",
  },
];

const review: HoidApprovedClaim["review"] = {
  status: "approved",
  origin: "original-editorial",
  reviewerId: "editorial-test",
  reviewedAt: "2026-11-16T06:00:00.000Z",
};

const claims: HoidApprovedClaim[] = [
  {
    id: "claim-alpha",
    text: "Afirmación editorial aprobada sobre Personaje Alfa.",
    intent: "explain",
    evidenceIds: ["e-alpha"],
    review,
  },
  {
    id: "claim-cross-book",
    text: "Relación editorial aprobada que requiere ambas evidencias.",
    intent: "explain",
    evidenceIds: ["e-alpha", "e-beta"],
    review,
  },
  {
    id: "claim-limited",
    text: "Esta afirmación no debe quedar disponible.",
    intent: "explain",
    evidenceIds: ["e-limited"],
    review,
  },
];

function createRuntime(
  selectClaims?: (request: HoidClaimSelectionRequest) => Promise<unknown>,
) {
  return createHoidEvidenceRuntime({
    knowledge,
    claims,
    selector: selectClaims ? { selectClaims } : null,
  });
}

describe("HoidEvidenceRuntime", () => {
  it("sends only claims whose complete evidence set is authorized", async () => {
    const selector = vi.fn(async (request: HoidClaimSelectionRequest) => {
      expect(request.candidates.map(candidate => candidate.id)).toEqual(["claim-alpha"]);
      expect(Object.isFrozen(request)).toBe(true);
      expect(Object.isFrozen(request.candidates)).toBe(true);
      expect("aliases" in request.candidates[0]).toBe(false);
      return ["claim-alpha"];
    });
    const runtime = createRuntime(selector);

    const result = await runtime!.answer({
      question: "¿Quién es Personaje Alfa?",
      reading: [{ bookId: "twok", chapter: 2 }],
    });

    expect(result.status).toBe("authorized");
    expect(result.text).toBe("Afirmación editorial aprobada sobre Personaje Alfa.");
    expect(result.claimIds).toEqual(["claim-alpha"]);
    expect(result.evidenceIds).toEqual(["e-alpha"]);
    expect(result.sources).toEqual([{
      evidenceId: "e-alpha",
      sourceBookId: "twok",
      sourceChapter: 2,
      locatorId: locator("twok", 2),
      unlockBookId: "twok",
      unlockChapter: 2,
    }]);
    expect(selector).toHaveBeenCalledTimes(1);
  });

  it("requires every cross-book evidence position to be reached", async () => {
    const selector = vi.fn(async () => ["claim-cross-book"]);
    const runtime = createRuntime(selector);

    const locked = await runtime!.answer({
      question: "¿Qué relación hay entre Personaje Alfa y Personaje Beta?",
      reading: [
        { bookId: "twok", chapter: 2 },
        { bookId: "wor", chapter: 2 },
      ],
    });

    expect(locked.status).toBe("blocked");
    expect(locked.reason).toBe("reading-position");
    expect(selector).not.toHaveBeenCalled();

    const unlocked = await runtime!.answer({
      question: "¿Qué relación hay entre Personaje Alfa y Personaje Beta?",
      reading: [
        { bookId: "twok", chapter: 2 },
        { bookId: "wor", chapter: 3 },
      ],
    });

    expect(unlocked.status).toBe("authorized");
    expect(unlocked.claimIds).toEqual(["claim-cross-book"]);
    expect(unlocked.evidenceIds).toEqual(["e-alpha", "e-beta"]);
    expect(selector).toHaveBeenCalledTimes(1);
  });


  it("requires every cross-book evidence summary to reach its own unlock chapter", async () => {
    const scopedKnowledge = knowledge.map(entry => entry.id === "e-beta"
      ? { ...entry, evidenceUnlock: { bookId: "wor", chapter: 4 } }
      : entry);
    const selector = vi.fn(async () => ["claim-cross-book"]);
    const runtime = createHoidEvidenceRuntime({
      knowledge: scopedKnowledge,
      claims: [claims[1]],
      selector: { selectClaims: selector },
    });

    const oneChapterShort = await runtime!.answer({
      question: "¿Qué relación hay entre Personaje Alfa y Personaje Beta?",
      reading: [
        { bookId: "twok", chapter: 2 },
        { bookId: "wor", chapter: 3 },
      ],
    });
    expect(oneChapterShort.status).toBe("abstain");
    expect(oneChapterShort.reason).toBe("no-authorized-evidence");
    expect(selector).not.toHaveBeenCalled();

    const bothUnlocked = await runtime!.answer({
      question: "¿Qué relación hay entre Personaje Alfa y Personaje Beta?",
      reading: [
        { bookId: "twok", chapter: 2 },
        { bookId: "wor", chapter: 4 },
      ],
    });
    expect(bothUnlocked.status).toBe("authorized");
    expect(bothUnlocked.evidenceIds).toEqual(["e-alpha", "e-beta"]);
    expect(selector).toHaveBeenCalledTimes(1);
  });

  it("never renders text supplied by the selector", async () => {
    const runtime = createRuntime(async () => [
      { id: "claim-alpha", text: "Texto inyectado por el proveedor" },
    ]);

    const result = await runtime!.answer({
      question: "¿Quién es Personaje Alfa?",
      reading: [{ bookId: "twok", chapter: 2 }],
    });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("invalid-selection");
    expect(result.text).not.toContain("Texto inyectado por el proveedor");
  });

  it("rejects unknown or duplicated claim identifiers", async () => {
    const runtime = createRuntime(async () => ["claim-alpha", "claim-alpha"]);

    const result = await runtime!.answer({
      question: "¿Quién es Personaje Alfa?",
      reading: [{ bookId: "twok", chapter: 2 }],
    });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("invalid-selection");
  });

  it("does not call a selector when no authorized evidence matches the question", async () => {
    const selector = vi.fn(async () => ["claim-alpha"]);
    const runtime = createRuntime(selector);

    const result = await runtime!.answer({
      question: "Pregunta sin evidencia en el catálogo",
      reading: [{ bookId: "tfe", chapter: 38 }],
    });

    expect(result.status).toBe("abstain");
    expect(result.reason).toBe("no-authorized-evidence");
    expect(selector).not.toHaveBeenCalled();
  });

  it("rejects ambiguous duplicate progress before provider invocation", async () => {
    const selector = vi.fn(async () => ["claim-alpha"]);
    const runtime = createRuntime(selector);

    const result = await runtime!.answer({
      question: "¿Quién es Personaje Alfa?",
      reading: [
        { bookId: "twok", chapter: 2 },
        { bookId: "twok", chapter: 99 },
      ],
    });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("invalid-input");
    expect(selector).not.toHaveBeenCalled();
  });

  it("excludes evidence without verified provenance", async () => {
    const selector = vi.fn(async () => ["claim-limited"]);
    const runtime = createRuntime(selector);

    const result = await runtime!.answer({
      question: "¿Qué es Concepto limitado?",
      reading: [{ bookId: "twok", chapter: 1 }],
    });

    expect(result.status).toBe("abstain");
    expect(result.reason).toBe("no-authorized-evidence");
    expect(selector).not.toHaveBeenCalled();
  });

  it("converts provider exceptions into a safe abstention", async () => {
    const runtime = createRuntime(async () => {
      throw new Error("synthetic provider failure");
    });

    const result = await runtime!.answer({
      question: "¿Quién es Personaje Alfa?",
      reading: [{ bookId: "twok", chapter: 2 }],
    });

    expect(result.status).toBe("abstain");
    expect(result.reason).toBe("provider-unavailable");
    expect(result.text).toContain("El selector no está disponible");
  });

  it("keeps recommendations metadata-only and rejects malformed progress", () => {
    const runtime = createRuntime();

    const recommendations = runtime!.recommend([{ bookId: "tfe", chapter: 1 }], 2);
    expect(recommendations.status).toBe("ready");
    if (recommendations.status === "ready") {
      expect(recommendations.items.map(item => item.sourceId)).toEqual(["woa", "hoa"]);
      expect(recommendations.items.every(item => item.reason === "unread-source")).toBe(true);
    }

    const invalid = runtime!.recommend(null);
    expect(invalid.status).toBe("abstain");
    if (invalid.status === "abstain") expect(invalid.reason).toBe("invalid-progress");
  });

  it("rejects an editorial claim that cites an unknown evidence identifier", () => {
    const invalidRuntime = createHoidEvidenceRuntime({
      knowledge,
      claims: [{
        id: "claim-invalid",
        text: "Afirmación sintética.",
        intent: "explain",
        evidenceIds: ["missing-evidence"],
        review,
      }],
      selector: null,
    });

    expect(invalidRuntime).toBeNull();
  });


  it("converts synchronous selector exceptions into a safe abstention", async () => {
    const runtime = createRuntime(() => {
      throw new Error("synthetic synchronous failure");
    });

    const result = await runtime!.answer({
      question: "¿Quién es Personaje Alfa?",
      reading: [{ bookId: "twok", chapter: 2 }],
    });

    expect(result.status).toBe("abstain");
    expect(result.reason).toBe("provider-unavailable");
    expect(result.text).toContain("El selector no está disponible");
  });


  it("keeps a summary locked until its explicit evidence unlock chapter", async () => {
    const delayedKnowledge = knowledge.map(entry => entry.id === "e-alpha"
      ? {
          ...entry,
          evidenceUnlock: { bookId: "twok", chapter: 5 },
        }
      : entry);
    const selector = vi.fn(async () => ["claim-alpha"]);
    const runtime = createHoidEvidenceRuntime({
      knowledge: delayedKnowledge,
      claims: [claims[0]],
      selector: { selectClaims: selector },
    });

    const beforeUnlock = await runtime!.answer({
      question: "¿Quién es Personaje Alfa?",
      reading: [{ bookId: "twok", chapter: 4 }],
    });
    expect(beforeUnlock.status).toBe("abstain");
    expect(beforeUnlock.reason).toBe("no-authorized-evidence");
    expect(selector).not.toHaveBeenCalled();

    const atUnlock = await runtime!.answer({
      question: "¿Quién es Personaje Alfa?",
      reading: [{ bookId: "twok", chapter: 5 }],
    });
    expect(atUnlock.status).toBe("authorized");
    expect(atUnlock.sources[0].unlockChapter).toBe(5);
    expect(selector).toHaveBeenCalledTimes(1);
  });

  it("fails closed when evidence source or unlock metadata is missing", () => {
    const missingUnlock = knowledge.map(entry => {
      if (entry.id !== "e-alpha") return entry;
      const { evidenceUnlock: _ignored, ...withoutUnlock } = entry;
      return withoutUnlock as HoidKnowledgeEntry;
    });
    expect(createHoidEvidenceRuntime({ knowledge: missingUnlock, claims, selector: null })).toBeNull();
  });

  it("rejects evidence whose unlock precedes its source chapter", () => {
    const invalidScope = knowledge.map(entry => entry.id === "e-alpha"
      ? { ...entry, evidenceUnlock: { bookId: "twok", chapter: 1 } }
      : entry);
    expect(createHoidEvidenceRuntime({ knowledge: invalidScope, claims, selector: null })).toBeNull();
  });

  it("rejects unknown source works and malformed chapter locators", () => {
    const unknownSource = knowledge.map(entry => entry.id === "e-alpha"
      ? { ...entry, evidenceSource: { bookId: "unknown-work", chapter: 2, locatorId: "x" }, evidenceUnlock: { bookId: "unknown-work", chapter: 2 } }
      : entry);
    expect(createHoidEvidenceRuntime({ knowledge: unknownSource, claims, selector: null })).toBeNull();

    const invalidLocator = knowledge.map(entry => entry.id === "e-alpha"
      ? { ...entry, evidenceSource: { bookId: "twok", chapter: 2, locatorId: "bad\nlocator" } }
      : entry);
    expect(createHoidEvidenceRuntime({ knowledge: invalidLocator, claims, selector: null })).toBeNull();
  });

  it("returns an explicit abstention when no provider is configured", async () => {
    const runtime = createRuntime();

    const result = await runtime!.answer({
      question: "¿Quién es Personaje Alfa?",
      reading: [{ bookId: "twok", chapter: 2 }],
    });

    expect(result.status).toBe("abstain");
    expect(result.reason).toBe("provider-unavailable");
    expect(result.text).toContain("No hay un selector de IA configurado");
  });

  it("rejects progress beyond the inspected chapter count before selector invocation", async () => {
    const selector = vi.fn(async () => ["claim-alpha"]);
    const runtime = createRuntime(selector);

    const result = await runtime!.answer({
      question: "¿Quién es Personaje Alfa?",
      reading: [{ bookId: "tfe", chapter: 39 }],
    });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("invalid-input");
    expect(selector).not.toHaveBeenCalled();
  });

  it("rejects ambiguous numeric chapter positions before selector invocation", async () => {
    const selector = vi.fn(async () => ["claim-alpha"]);
    const runtime = createRuntime(selector);

    const result = await runtime!.answer({
      question: "¿Quién es Personaje Alfa?",
      reading: [{ bookId: "elantris", chapter: 48 }],
    });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("invalid-input");
    expect(selector).not.toHaveBeenCalled();
  });

  it("rejects partial progress for a combined-volume or collection source", async () => {
    const selector = vi.fn(async () => ["claim-alpha"]);
    const runtime = createRuntime(selector);

    const result = await runtime!.answer({
      question: "¿Quién es Personaje Alfa?",
      reading: [{ bookId: "white-sand-1", chapter: 1 }],
    });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("invalid-input");
    expect(selector).not.toHaveBeenCalled();
  });

});
