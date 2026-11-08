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

  it("keeps canonical progress isolated when a provider tries to mutate its request", async () => {
    const provider: HoidProvider = {
      answer: jest.fn(async (providerRequest) => {
        expect(Object.isFrozen(providerRequest.reading)).toBe(true);
        expect(Object.isFrozen(providerRequest.reading[0])).toBe(true);
        return "Thaidakar";
      }),
    };

    const result = await new HoidPipeline(provider, []).answer({
      question: "Pregunta segura",
      reading: [{ bookId: "sh", chapter: 0 }],
    });

    // The provider received a snapshot, while the post-provider guard still
    // evaluates the canonical progress and blocks the locked term.
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("provider-output");
  });

  it("rejects invalid input before spoiler checks or provider calls", async () => {
    const provider: HoidProvider = { answer: jest.fn(async () => "respuesta") };

    const result = await new HoidPipeline(provider, []).answer({
      question: "\u200B\u202E",
      reading: [],
    });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("input-invalid");
    expect(provider.answer).not.toHaveBeenCalled();
  });

  it("sends the normalized question to the provider", async () => {
    const provider: HoidProvider = {
      answer: jest.fn(async (providerRequest) => {
        expect(providerRequest.question).toBe("Pregunta");
        return "Respuesta segura";
      }),
    };

    await new HoidPipeline(provider, []).answer({
      question: "  Pre\u200Bgunta  ",
      reading: [],
    });

    expect(provider.answer).toHaveBeenCalled();
  });

});
