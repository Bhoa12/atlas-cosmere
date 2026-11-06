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
});
