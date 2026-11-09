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

  it("fails closed when the runtime request is not an object", async () => {
    const provider: HoidProvider = { answer: jest.fn(async () => "respuesta") };

    const result = await new HoidPipeline(provider, []).answer(null as unknown as typeof request);

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("input-invalid");
    expect(provider.answer).not.toHaveBeenCalled();
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

  it("fails closed before the provider when reading progress is not an array", async () => {
    const provider: HoidProvider = { answer: jest.fn(async () => "respuesta") };
    const result = await new HoidPipeline(provider, []).answer({
      question: "Pregunta segura",
      reading: null as unknown as [],
    });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("input-invalid");
    expect(provider.answer).not.toHaveBeenCalled();
  });

  it("passes an immutable context snapshot to contextual providers", async () => {
    const provider = {
      answer: jest.fn(async () => "Respuesta segura"),
      answerWithContext: jest.fn(async (_request, context) => {
        expect(Object.isFrozen(context)).toBe(true);
        expect(context).toHaveLength(1);
        expect(Object.isFrozen(context[0])).toBe(true);
        expect(Object.isFrozen(context[0].aliases)).toBe(true);
        expect(Object.isFrozen(context[0].firstSafeAppearance)).toBe(true);
        return "Respuesta segura";
      }),
    } as unknown as HoidProvider;

    const knowledge = [{
      id: "safe-entry",
      aliases: ["CONCEPTO_SEGURO"],
      kind: "concept" as const,
      provenance: "verified" as const,
      firstSafeAppearance: { bookId: "book-safe", chapter: 1 },
      summary: "Resumen editorial original y seguro.",
    }];

    const result = await new HoidPipeline(provider, knowledge).answer({
      question: "¿Qué es CONCEPTO_SEGURO?",
      reading: [{ bookId: "book-safe", chapter: 1 }],
    });

    expect(result.blocked).toBe(false);
    expect((provider as unknown as { answerWithContext: jest.Mock }).answerWithContext).toHaveBeenCalled();
  });
  it("accepts evidence-bound claims only when every evidence id is in the authorized context", async () => {
    const provider = {
      answer: jest.fn(async () => "legacy response should not be used"),
      answerWithEvidence: jest.fn(async () => [
        { text: "Afirmación respaldada.", evidenceIds: ["safe-entry"] },
        { text: "Afirmación sin respaldo.", evidenceIds: ["unknown-entry"] },
        { text: "Afirmación con evidencia mezclada.", evidenceIds: ["safe-entry", "unknown-entry"] },
      ]),
    };
    const knowledge = [{
      id: "safe-entry",
      aliases: ["CONCEPTO_SEGURO"],
      kind: "concept" as const,
      provenance: "verified" as const,
      firstSafeAppearance: { bookId: "book-safe", chapter: 1 },
      summary: "Resumen editorial original y seguro.",
    }];

    const result = await new HoidPipeline(provider, knowledge).answer({
      question: "¿Qué es CONCEPTO_SEGURO?",
      reading: [{ bookId: "book-safe", chapter: 1 }],
    });

    expect(result.blocked).toBe(false);
    expect(result.text).toBe("Afirmación respaldada.");
    expect(provider.answer).not.toHaveBeenCalled();
  });

  it("fails closed when an evidence-bound provider returns no fully authorized claims", async () => {
    const provider = {
      answerWithEvidence: jest.fn(async () => [
        { text: "Afirmación no autorizada.", evidenceIds: ["unknown-entry"] },
      ]),
    };

    const result = await new HoidPipeline(provider, []).answer({
      question: "Pregunta segura",
      reading: [],
    });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("provider-output");
  });


  it("fails closed when individually valid evidence claims exceed the final output budget when combined", async () => {
    const provider = {
      answerWithEvidence: jest.fn(async () => [
        { text: "a".repeat(7_000), evidenceIds: ["safe-entry"] },
        { text: "b".repeat(7_000), evidenceIds: ["safe-entry"] },
      ]),
    };
    const knowledge = [{
      id: "safe-entry",
      aliases: ["CONCEPTO_SEGURO"],
      kind: "concept" as const,
      provenance: "verified" as const,
      firstSafeAppearance: { bookId: "book-safe", chapter: 1 },
      summary: "Resumen editorial original y seguro.",
    }];

    const result = await new HoidPipeline(provider, knowledge).answer({
      question: "¿Qué es CONCEPTO_SEGURO?",
      reading: [{ bookId: "book-safe", chapter: 1 }],
    });

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("provider-output");
  });

});
