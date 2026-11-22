import { describe, expect, it } from "vitest";
import { validateHoidPresentedAnswerScope } from "./answerScopePresentation";

function citation(
  evidenceId: string,
  sourceBookId: string,
  title: string,
  chapter = 2,
) {
  return Object.freeze({
    evidenceId,
    sourceBookId,
    title,
    chapter,
    locatorId: `Text/${sourceBookId}/chapter-${chapter}.xhtml`,
  });
}

function presentation(
  citations: readonly unknown[],
  evidenceIds = citations.map(item => (item as { evidenceId: string }).evidenceId),
) {
  return Object.freeze({
    status: "ready",
    text: "Respuesta editorial verificada.",
    claimIds: Object.freeze(["claim.answer"]),
    evidenceIds: Object.freeze([...evidenceIds]),
    citations: Object.freeze([...citations]),
  });
}

function segmentedPresentation(
  citations: readonly unknown[],
  segmentOverrides: Readonly<{
    claimId?: string;
    evidenceIds?: readonly string[];
    citations?: readonly unknown[];
  }> = {},
) {
  const evidenceIds = citations.map(item => (item as { evidenceId: string }).evidenceId);
  return Object.freeze({
    ...presentation(citations),
    layout: "plain",
    segments: Object.freeze([
      Object.freeze({
        claimId: segmentOverrides.claimId ?? "claim.answer",
        text: "Respuesta editorial verificada.",
        evidenceIds: Object.freeze([...(segmentOverrides.evidenceIds ?? evidenceIds)]),
        citations: Object.freeze([...(segmentOverrides.citations ?? citations)]),
      }),
    ]),
  });
}

const tfe = citation("evidence.tfe", "tfe", "El Imperio Final");
const twok = citation("evidence.twok", "twok", "El Camino de los Reyes");
const wor = citation("evidence.wor", "wor", "Palabras radiantes");

describe("validateHoidPresentedAnswerScope", () => {
  it("accepts a single-work presentation only for its selected work", () => {
    expect(validateHoidPresentedAnswerScope(
      presentation([tfe]),
      { mode: "single-work", bookIds: ["tfe"] },
    )).toEqual({ status: "ready", sourceBookIds: ["tfe"] });
  });

  it("accepts a cross-work presentation that cites every selected work", () => {
    expect(validateHoidPresentedAnswerScope(
      presentation([twok, tfe]),
      { mode: "cross-work", bookIds: ["twok", "tfe"] },
    )).toEqual({ status: "ready", sourceBookIds: ["tfe", "twok"] });
  });

  it("rejects a partial comparison when one selected work has no citation", () => {
    expect(validateHoidPresentedAnswerScope(
      presentation([tfe]),
      { mode: "cross-work", bookIds: ["tfe", "twok"] },
    )).toEqual({ status: "unavailable", reason: "scope-mismatch" });
  });

  it("rejects citations from a work outside the selected scope", () => {
    expect(validateHoidPresentedAnswerScope(
      presentation([tfe, wor]),
      { mode: "single-work", bookIds: ["tfe"] },
    )).toEqual({ status: "unavailable", reason: "scope-mismatch" });
  });

  it("rejects a citation whose title does not match the bibliography", () => {
    expect(validateHoidPresentedAnswerScope(
      presentation([citation("evidence.tfe", "tfe", "Título inventado")]),
      { mode: "single-work", bookIds: ["tfe"] },
    )).toEqual({ status: "unavailable", reason: "invalid-presentation" });
  });

  it("rejects duplicate evidence identities", () => {
    expect(validateHoidPresentedAnswerScope(
      presentation([tfe, tfe]),
      { mode: "single-work", bookIds: ["tfe"] },
    )).toEqual({ status: "unavailable", reason: "invalid-presentation" });
  });

  it("rejects an evidence-ID list that differs from the citation list", () => {
    expect(validateHoidPresentedAnswerScope(
      presentation([tfe], ["evidence.other"]),
      { mode: "single-work", bookIds: ["tfe"] },
    )).toEqual({ status: "unavailable", reason: "invalid-presentation" });
  });

  it("rejects accessor-backed citations without executing getters", () => {
    let invoked = false;
    const accessorCitation = {
      evidenceId: "evidence.tfe",
      sourceBookId: "tfe",
      title: "El Imperio Final",
      chapter: 2,
      locatorId: "Text/tfe/chapter-2.xhtml",
    };
    Object.defineProperty(accessorCitation, "sourceBookId", {
      enumerable: true,
      configurable: true,
      get() {
        invoked = true;
        return "tfe";
      },
    });
    const input = {
      status: "ready",
      text: "Respuesta editorial verificada.",
      claimIds: ["claim.answer"],
      evidenceIds: ["evidence.tfe"],
      citations: [accessorCitation],
    };

    expect(validateHoidPresentedAnswerScope(input, { mode: "single-work", bookIds: ["tfe"] }))
      .toEqual({ status: "unavailable", reason: "invalid-presentation" });
    expect(invoked).toBe(false);
  });

  it("rejects an unknown or malformed scope before comparing citations", () => {
    expect(validateHoidPresentedAnswerScope(
      presentation([tfe]),
      { mode: "single-work", bookIds: ["unknown-work"] },
    )).toEqual({ status: "unavailable", reason: "invalid-scope" });
  });

  it("rejects sparse citation arrays", () => {
    const citations = new Array(1);
    const input = {
      status: "ready",
      text: "Respuesta editorial verificada.",
      claimIds: ["claim.answer"],
      evidenceIds: ["evidence.tfe"],
      citations,
    };
    expect(validateHoidPresentedAnswerScope(input)).toEqual({
      status: "unavailable",
      reason: "invalid-presentation",
    });
  });

  it("derives a deterministic bibliography-ordered work set without an explicit scope", () => {
    expect(validateHoidPresentedAnswerScope(presentation([wor, twok, tfe]))).toEqual({
      status: "ready",
      sourceBookIds: ["tfe", "twok", "wor"],
    });
  });

  it("rejects a citation with a non-positive chapter", () => {
    expect(validateHoidPresentedAnswerScope(
      presentation([citation("evidence.tfe", "tfe", "El Imperio Final", 0)]),
    )).toEqual({ status: "unavailable", reason: "invalid-presentation" });
  });

  it("rejects control characters in opaque locator identifiers", () => {
    const invalidCitation = {
      ...tfe,
      locatorId: "Text/tfe/" + String.fromCharCode(0) + ".xhtml",
    };
    expect(validateHoidPresentedAnswerScope(presentation([invalidCitation]))).toEqual({
      status: "unavailable",
      reason: "invalid-presentation",
    });
  });

  it("rejects overlong evidence identifiers", () => {
    const longId = "e".repeat(129);
    const invalidCitation = {
      ...tfe,
      evidenceId: longId,
    };
    expect(validateHoidPresentedAnswerScope(
      presentation([invalidCitation], [longId]),
    )).toEqual({ status: "unavailable", reason: "invalid-presentation" });
  });

  it("accepts a segmented presentation when every claim maps to the exact top-level citations", () => {
    expect(validateHoidPresentedAnswerScope(
      segmentedPresentation([tfe, twok]),
      { mode: "cross-work", bookIds: ["tfe", "twok"] },
    )).toEqual({ status: "ready", sourceBookIds: ["tfe", "twok"] });
  });

  it("rejects a segment that introduces a citation outside the canonical top-level set", () => {
    expect(validateHoidPresentedAnswerScope(
      segmentedPresentation([tfe], {
        evidenceIds: ["evidence.tfe", "evidence.wor"],
        citations: [tfe, wor],
      }),
      { mode: "single-work", bookIds: ["tfe"] },
    )).toEqual({ status: "unavailable", reason: "invalid-presentation" });
  });

  it("rejects a segment whose claim ID does not match the ordered claim list", () => {
    expect(validateHoidPresentedAnswerScope(
      segmentedPresentation([tfe], { claimId: "claim.unrelated" }),
    )).toEqual({ status: "unavailable", reason: "invalid-presentation" });
  });

  it("rejects a segment that changes the chapter or locator for an existing evidence ID", () => {
    const altered = citation("evidence.tfe", "tfe", "El Imperio Final", 3);
    expect(validateHoidPresentedAnswerScope(
      segmentedPresentation([tfe], { citations: [altered] }),
    )).toEqual({ status: "unavailable", reason: "invalid-presentation" });
  });

  it("rejects top-level evidence that is not attached to any displayed claim", () => {
    expect(validateHoidPresentedAnswerScope(
      segmentedPresentation([tfe, twok], {
        evidenceIds: ["evidence.tfe"],
        citations: [tfe],
      }),
    )).toEqual({ status: "unavailable", reason: "invalid-presentation" });
  });

  it("rejects accessor-backed segment fields without executing getters", () => {
    let invoked = false;
    const segment = {
      text: "Respuesta editorial verificada.",
      evidenceIds: ["evidence.tfe"],
      citations: [tfe],
    };
    Object.defineProperty(segment, "claimId", {
      enumerable: true,
      configurable: true,
      get() {
        invoked = true;
        return "claim.answer";
      },
    });
    const input = {
      ...presentation([tfe]),
      layout: "plain",
      segments: [segment],
    };

    expect(validateHoidPresentedAnswerScope(input)).toEqual({
      status: "unavailable",
      reason: "invalid-presentation",
    });
    expect(invoked).toBe(false);
  });

  it("rejects sparse segment arrays", () => {
    const segments = new Array(1);
    const input = {
      ...presentation([tfe]),
      layout: "plain",
      segments,
    };
    expect(validateHoidPresentedAnswerScope(input)).toEqual({
      status: "unavailable",
      reason: "invalid-presentation",
    });
  });

  it("rejects top-level text that differs from the deterministic claim composition", () => {
    const input = {
      ...segmentedPresentation([tfe]),
      text: "Texto adicional que no pertenece a los segmentos.",
    };
    expect(validateHoidPresentedAnswerScope(input)).toEqual({
      status: "unavailable",
      reason: "invalid-presentation",
    });
  });

  it("rejects unsupported layouts even when the citation mapping is otherwise valid", () => {
    const input = {
      ...segmentedPresentation([tfe]),
      layout: "freeform",
    };
    expect(validateHoidPresentedAnswerScope(input)).toEqual({
      status: "unavailable",
      reason: "invalid-presentation",
    });
  });


  it.each([
    ["numbered", "1. Primera afirmación.\n\n2. Segunda afirmación."],
    ["grouped", "Bloque 1\n• Primera afirmación.\n\n• Segunda afirmación."],
  ] as const)("accepts canonical %s composition when its segments and citations match", (layout, text) => {
    const input = Object.freeze({
      status: "ready",
      text,
      claimIds: Object.freeze(["claim.first", "claim.second"]),
      evidenceIds: Object.freeze(["evidence.tfe", "evidence.twok"]),
      citations: Object.freeze([tfe, twok]),
      layout,
      segments: Object.freeze([
        Object.freeze({
          claimId: "claim.first",
          text: "Primera afirmación.",
          evidenceIds: Object.freeze(["evidence.tfe"]),
          citations: Object.freeze([tfe]),
        }),
        Object.freeze({
          claimId: "claim.second",
          text: "Segunda afirmación.",
          evidenceIds: Object.freeze(["evidence.twok"]),
          citations: Object.freeze([twok]),
        }),
      ]),
    });
    expect(validateHoidPresentedAnswerScope(
      input,
      { mode: "cross-work", bookIds: ["tfe", "twok"] },
    )).toEqual({ status: "ready", sourceBookIds: ["tfe", "twok"] });
  });

});
