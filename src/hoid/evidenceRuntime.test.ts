import { describe, expect, it, vi } from "vitest";
import {
  createHoidEvidenceRuntime,
  type HoidApprovedClaim,
  type HoidClaimSelectionRequest,
} from "./evidenceRuntime";
import type { HoidKnowledgeEntry } from "./catalog";

const knowledge: HoidKnowledgeEntry[] = [
  {
    id: "e-sazed",
    aliases: ["Sazed"],
    kind: "character",
    firstSafeAppearance: { bookId: "tfe", chapter: 2 },
    provenance: "verified",
    summary: "Resumen editorial original de prueba sobre Sazed.",
  },
  {
    id: "e-kaladin",
    aliases: ["Kaladin"],
    kind: "character",
    firstSafeAppearance: { bookId: "wor", chapter: 3 },
    provenance: "verified",
    summary: "Resumen editorial original de prueba sobre Kaladin.",
  },
  {
    id: "e-limited",
    aliases: ["Concepto limitado"],
    kind: "concept",
    firstSafeAppearance: { bookId: "tfe", chapter: 1 },
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
    id: "claim-sazed",
    text: "Afirmación editorial aprobada sobre Sazed.",
    intent: "explain",
    evidenceIds: ["e-sazed"],
    review,
  },
  {
    id: "claim-cross-book",
    text: "Relación editorial aprobada que requiere ambas evidencias.",
    intent: "explain",
    evidenceIds: ["e-sazed", "e-kaladin"],
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
      expect(request.candidates.map(candidate => candidate.id)).toEqual(["claim-sazed"]);
      expect(Object.isFrozen(request)).toBe(true);
      expect(Object.isFrozen(request.candidates)).toBe(true);
      expect("aliases" in request.candidates[0]).toBe(false);
      return ["claim-sazed"];
    });
    const runtime = createRuntime(selector);

    const result = await runtime!.answer({
      question: "¿Quién es Sazed?",
      reading: [{ bookId: "tfe", chapter: 2 }],
    });

    expect(result.status).toBe("authorized");
    expect(result.text).toBe("Afirmación editorial aprobada sobre Sazed.");
    expect(result.claimIds).toEqual(["claim-sazed"]);
    expect(result.evidenceIds).toEqual(["e-sazed"]);
    expect(selector).toHaveBeenCalledTimes(1);
  });

  it("requires every cross-book evidence position to be reached", async () => {
    const selector = vi.fn(async () => ["claim-cross-book"]);
    const runtime = createRuntime(selector);

    const locked = await runtime!.answer({
      question: "¿Qué relación hay entre Sazed y Kaladin?",
      reading: [
        { bookId: "tfe", chapter: 2 },
        { bookId: "wor", chapter: 2 },
      ],
    });

    expect(locked.status).toBe("blocked");
    expect(locked.reason).toBe("reading-position");
    expect(selector).not.toHaveBeenCalled();

    const unlocked = await runtime!.answer({
      question: "¿Qué relación hay entre Sazed y Kaladin?",
      reading: [
        { bookId: "tfe", chapter: 2 },
        { bookId: "wor", chapter: 3 },
      ],
    });

    expect(unlocked.status).toBe("authorized");
    expect(unlocked.claimIds).toEqual(["claim-cross-book"]);
    expect(unlocked.evidenceIds).toEqual(["e-kaladin", "e-sazed"]);
    expect(selector).toHaveBeenCalledTimes(1);
  });

  it("never renders text supplied by the selector", async () => {
    const runtime = createRuntime(async () => [
      { id: "claim-sazed", text: "Texto inyectado por el proveedor" },
    ]);

    const result = await runtime!.answer({
      question: "¿Quién es Sazed?",
      reading: [{ bookId: "tfe", chapter: 2 }],
    });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("invalid-selection");
    expect(result.text).not.toContain("Texto inyectado por el proveedor");
  });

  it("rejects unknown or duplicated claim identifiers", async () => {
    const runtime = createRuntime(async () => ["claim-sazed", "claim-sazed"]);

    const result = await runtime!.answer({
      question: "¿Quién es Sazed?",
      reading: [{ bookId: "tfe", chapter: 2 }],
    });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("invalid-selection");
  });

  it("does not call a selector when no authorized evidence matches the question", async () => {
    const selector = vi.fn(async () => ["claim-sazed"]);
    const runtime = createRuntime(selector);

    const result = await runtime!.answer({
      question: "Pregunta sin evidencia en el catálogo",
      reading: [{ bookId: "tfe", chapter: 100 }],
    });

    expect(result.status).toBe("abstain");
    expect(result.reason).toBe("no-authorized-evidence");
    expect(selector).not.toHaveBeenCalled();
  });

  it("rejects ambiguous duplicate progress before provider invocation", async () => {
    const selector = vi.fn(async () => ["claim-sazed"]);
    const runtime = createRuntime(selector);

    const result = await runtime!.answer({
      question: "¿Quién es Sazed?",
      reading: [
        { bookId: "tfe", chapter: 2 },
        { bookId: "tfe", chapter: 99 },
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
      reading: [{ bookId: "tfe", chapter: 1 }],
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
      question: "¿Quién es Sazed?",
      reading: [{ bookId: "tfe", chapter: 2 }],
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
      question: "¿Quién es Sazed?",
      reading: [{ bookId: "tfe", chapter: 2 }],
    });

    expect(result.status).toBe("abstain");
    expect(result.reason).toBe("provider-unavailable");
    expect(result.text).toBe("");
  });

  it("returns an explicit abstention when no provider is configured", async () => {
    const runtime = createRuntime();

    const result = await runtime!.answer({
      question: "¿Quién es Sazed?",
      reading: [{ bookId: "tfe", chapter: 2 }],
    });

    expect(result.status).toBe("abstain");
    expect(result.reason).toBe("provider-unavailable");
    expect(result.text).toContain("No hay un selector de IA configurado");
  });
});
