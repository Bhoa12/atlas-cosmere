import { describe, expect, it, vi } from "vitest";
import { getHoidReadingManifest } from "./readingManifest";
import { HoidPipeline, type EvidenceBoundClaim, type ProviderKnowledgeContextEntry } from "./pipeline";
import type { HoidKnowledgeEntry } from "./catalog";
import type { HoidAliasDisclosurePort } from "./aliasDisclosureBoundary";
import type { HoidAnswerRequest, HoidProvider } from "./types";

function verifiedEntry(
  id: string,
  alias: string,
  bookId: string,
  chapter: number,
): HoidKnowledgeEntry {
  const manifest = getHoidReadingManifest(bookId);
  if (manifest.status !== "ready") throw new Error("Synthetic test manifest unavailable");
  const unit = manifest.manifest.units.find(candidate => candidate.chapterNumber === chapter);
  if (!unit?.locatorId) throw new Error("Synthetic test locator unavailable");

  return {
    id,
    aliases: [alias],
    kind: "concept",
    firstSafeAppearance: { bookId, chapter },
    evidenceSource: { bookId, chapter, locatorId: unit.locatorId },
    evidenceUnlock: { bookId, chapter },
    summary: "Resumen editorial original sintético, verificado para pruebas.",
    provenance: "verified",
  };
}

function allowMatchedAliases(): HoidAliasDisclosurePort {
  return {
    authorize(request) {
      return {
        status: "authorized",
        authorizedMatches: request.matches,
        progressRevision: 4,
        progressFingerprint: "a".repeat(64),
      };
    },
  };
}

describe("Hoid evidence-attributed answers", () => {
  it("returns source book and chapter metadata reconstructed from the authorized catalog", async () => {
    const knowledge = [verifiedEntry("evidence-tfe", "Concepto A", "tfe", 1)];
    const provider = {
      answer: vi.fn(async () => "The legacy path must not run."),
      answerWithEvidence: vi.fn(async (_request: HoidAnswerRequest, context: readonly ProviderKnowledgeContextEntry[]) => {
        expect(context).toHaveLength(1);
        expect(context[0].evidenceSource).toEqual({ bookId: "tfe", chapter: 1 });
        return [{ text: "Concepto A tiene una explicación respaldada.", evidenceIds: ["evidence-tfe"] }];
      }),
    };

    const result = await new HoidPipeline(provider, knowledge, 15_000, allowMatchedAliases()).answer({
      question: "¿Qué significa Concepto A?",
      reading: [{ bookId: "tfe", chapter: 1 }],
    });

    expect(result.blocked).toBe(false);
    expect(result.text).toBe("Concepto A tiene una explicación respaldada.");
    expect(result.claims).toEqual([{
      text: "Concepto A tiene una explicación respaldada.",
      evidence: [{
        evidenceId: "evidence-tfe",
        kind: "concept",
        source: {
          bookId: "tfe",
          title: "El Imperio Final",
          chapter: 1,
        },
      }],
    }]);
    expect(Object.isFrozen(result.claims)).toBe(true);
    expect(Object.isFrozen(result.claims?.[0])).toBe(true);
    expect(Object.isFrozen(result.claims?.[0].evidence)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("locatorId");
    expect(JSON.stringify(result)).not.toContain("nav:cosmere");
    expect(provider.answer).not.toHaveBeenCalled();
  });

  it("supports claims grounded in more than one authorized work without accepting provider-supplied source labels", async () => {
    const knowledge = [
      verifiedEntry("evidence-tfe", "Concepto A", "tfe", 1),
      verifiedEntry("evidence-twok", "Concepto B", "twok", 1),
    ];
    const provider = {
      answer: vi.fn(async () => "The legacy path must not run."),
      answerWithEvidence: vi.fn(async () => [{
        text: "La comparación está respaldada por ambas fuentes.",
        evidenceIds: ["evidence-twok", "evidence-tfe"],
        sourceBookId: "spoofed-book",
        sourceChapter: 999,
        locatorId: "invented-locator",
      } as EvidenceBoundClaim & Record<string, unknown>]),
    };

    const result = await new HoidPipeline(provider, knowledge, 15_000, allowMatchedAliases()).answer({
      question: "Compara Concepto A y Concepto B.",
      reading: [
        { bookId: "tfe", chapter: 1 },
        { bookId: "twok", chapter: 1 },
      ],
    });

    expect(result.blocked).toBe(false);
    expect(result.claims?.[0].evidence).toEqual([
      {
        evidenceId: "evidence-tfe",
        kind: "concept",
        source: { bookId: "tfe", title: "El Imperio Final", chapter: 1 },
      },
      {
        evidenceId: "evidence-twok",
        kind: "concept",
        source: { bookId: "twok", title: "El Camino de los Reyes", chapter: 1 },
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("spoofed-book");
    expect(JSON.stringify(result)).not.toContain("invented-locator");
  });

  it("blocks evidence-bound output when no claim has an authorized evidence identifier", async () => {
    const knowledge = [verifiedEntry("evidence-tfe", "Concepto A", "tfe", 1)];
    const provider = {
      answerWithEvidence: vi.fn(async () => [{
        text: "Afirmación sin respaldo.",
        evidenceIds: ["not-in-authorized-context"],
      }]),
    };

    const result = await new HoidPipeline(provider, knowledge, 15_000, allowMatchedAliases()).answer({
      question: "¿Qué significa Concepto A?",
      reading: [{ bookId: "tfe", chapter: 1 }],
    });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("provider-output");
    expect(result.claims).toBeUndefined();
  });

  it("does not fabricate citations for legacy free-form providers", async () => {
    const provider: HoidProvider = {
      answer: vi.fn(async () => "Respuesta sin citas estructuradas."),
    };
    const result = await new HoidPipeline(provider, []).answer({
      question: "Pregunta general sin nombres catalogados",
      reading: [],
    });

    expect(result.blocked).toBe(false);
    expect(result.text).toBe("Respuesta sin citas estructuradas.");
    expect(result.claims).toBeUndefined();
  });

  it("does not expose evidence locators or editorial summaries in the user-facing citation model", async () => {
    const knowledge = [verifiedEntry("evidence-tfe", "Concepto A", "tfe", 1)];
    const provider = {
      answerWithEvidence: vi.fn(async () => [{
        text: "Afirmación respaldada.",
        evidenceIds: ["evidence-tfe"],
      }]),
    };

    const result = await new HoidPipeline(provider, knowledge, 15_000, allowMatchedAliases()).answer({
      question: "¿Qué significa Concepto A?",
      reading: [{ bookId: "tfe", chapter: 1 }],
    });

    const serialized = JSON.stringify(result);
    expect(serialized).toContain("El Imperio Final");
    expect(serialized).toContain('"chapter":1');
    expect(serialized).not.toContain("Resumen editorial original sintético");
    expect(serialized).not.toContain("locatorId");
    expect(serialized).not.toContain("nav:cosmere");
  });
});
