import { HoidPipeline } from "./pipeline";
import { HoidProvider } from "./types";

const request = {
  question: "Cuéntame sobre Thaidakar",
  reading: [{ bookId: "sh", chapter: 0 }],
};

describe("HoidPipeline", () => {
  it("fails closed before calling the provider when the question is locked", async () => {
    const provider: HoidProvider = { answer: jest.fn(async () => "respuesta") };
    const result = await new HoidPipeline(provider, []).answer(request);

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("reading-position");
    expect(provider.answer).not.toHaveBeenCalled();
  });

  it("does not send a request anywhere when no provider is configured", async () => {
    const result = await new HoidPipeline(null, []).answer({
      question: "Pregunta segura",
      reading: [],
    });

    expect(result.reason).toBe("provider-unavailable");
    expect(result.text).toContain("no enviará");
  });

  it("blocks provider output that introduces a catalog alias the reader has not unlocked", async () => {
    const provider: HoidProvider = { answer: jest.fn(async () => "La identidad de NOMBRE_BLOQUEADO importa") };
    const knowledge = [{
      id: "locked-entry",
      aliases: ["NOMBRE_BLOQUEADO"],
      kind: "concept" as const,
      firstSafeAppearance: { bookId: "book-locked", chapter: 3 },
    }];

    const result = await new HoidPipeline(provider, knowledge).answer({
      question: "Pregunta segura",
      reading: [{ bookId: "book-locked", chapter: 2 }],
    });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("provider-output");
  });
});
