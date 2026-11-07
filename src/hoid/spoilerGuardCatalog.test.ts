import { guardQuestion, redactProviderAnswer } from "./spoilerGuard";

describe("spoiler guard catalog boundary", () => {
  const question = "¿Qué significa Thaidakar?";

  it("fails closed when a spoiler rule points to a stale catalog id", () => {
    expect(guardQuestion({
      question,
      reading: [{ bookId: "tfe", chapter: 999, completed: true }],
    })?.blocked).toBe(true);
  });

  it("applies the same fail-closed policy to provider output", () => {
    expect(redactProviderAnswer("Thaidakar", {
      question: "Resume mi lectura",
      reading: [{ bookId: "tfe", chapter: 999, completed: true }],
    }).blocked).toBe(true);
  });

  it("blocks locked terms split by invisible Unicode format characters", () => {
    const hidden = "Thai\u200Bdakar";
    expect(guardQuestion({
      question: hidden,
      reading: [{ bookId: "tfe", chapter: 999, completed: true }],
    })?.blocked).toBe(true);

    expect(redactProviderAnswer(hidden, {
      question: "Resume mi lectura",
      reading: [{ bookId: "tfe", chapter: 999, completed: true }],
    }).blocked).toBe(true);
  });
});
