import { guardQuestion, redactProviderAnswer } from "./spoilerGuard";

describe("spoiler guard lexical boundaries", () => {
  const reading = [{ bookId: "tfe", chapter: 999, completed: true }];

  it("does not block a longer unrelated word that merely contains a locked term", () => {
    expect(guardQuestion({
      question: "¿Qué significa ultrathaidakariano?",
      reading,
    })).toBeNull();

    expect(redactProviderAnswer(
      "El término ultrathaidakariano no debe activar una coincidencia parcial.",
      { question: "Resume mi lectura", reading },
    ).blocked).toBe(false);
  });

  it("still blocks the standalone locked term with punctuation", () => {
    expect(guardQuestion({
      question: "¿Qué significa Thaidakar?",
      reading,
    })?.blocked).toBe(true);

    expect(redactProviderAnswer(
      "Thaidakar.",
      { question: "Resume mi lectura", reading },
    ).blocked).toBe(true);
  });
});
