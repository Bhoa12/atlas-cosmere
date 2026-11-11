import { HoidPipeline, ContextualHoidProvider } from "./pipeline";

describe("HoidPipeline provider context isolation", () => {
  it("does not expose retrieval aliases across the provider boundary", async () => {
    const knowledge = [{
      id: "safe-entry",
      aliases: ["INTERNAL_ALIAS_ONLY"],
      kind: "concept" as const,
      firstSafeAppearance: { bookId: "book-safe", chapter: 1 },
      summary: "Metadata-only summary",
    }];

    let contextKeys: string[] = [];
    const provider: ContextualHoidProvider = {
      answer: async () => "respuesta segura",
      answerWithContext: async (_request, context) => {
        contextKeys = Object.keys(context[0]).sort();
        return "respuesta segura";
      },
    };

    const result = await new HoidPipeline(provider, knowledge).answer({
      question: "Pregunta segura",
      reading: [{ bookId: "book-safe", chapter: 1 }],
    });

    expect(result.blocked).toBe(false);
    expect(contextKeys).toEqual(["firstSafeAppearance", "id", "kind", "summary"]);
    expect(contextKeys).not.toContain("aliases");
  });

  it("makes the provider boundary immutable as well as detached", async () => {
    const knowledge = [{
      id: "safe-entry",
      aliases: ["SAFE_ALIAS"],
      kind: "concept" as const,
      firstSafeAppearance: { bookId: "book-safe", chapter: 1 },
      summary: "Metadata-only summary",
    }];

    let sawFrozenRequest = false;
    let sawFrozenContext = false;
    const provider: ContextualHoidProvider = {
      answer: async () => "respuesta segura",
      answerWithContext: async (request, context) => {
        sawFrozenRequest = Object.isFrozen(request)
          && Object.isFrozen(request.reading)
          && Object.isFrozen(request.reading[0]);
        sawFrozenContext = Object.isFrozen(context)
          && Object.isFrozen(context[0])
          && Object.isFrozen(context[0].firstSafeAppearance);
        return "respuesta segura";
      },
    };

    const result = await new HoidPipeline(provider, knowledge).answer({
      question: "Pregunta segura",
      reading: [{ bookId: "book-safe", chapter: 1 }],
    });

    expect(result.blocked).toBe(false);
    expect(sawFrozenRequest).toBe(true);
    expect(sawFrozenContext).toBe(true);
  });
});
