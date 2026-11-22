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
});
