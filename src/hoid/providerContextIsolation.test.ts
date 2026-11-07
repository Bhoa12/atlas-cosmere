import { HoidPipeline, ContextualHoidProvider } from "./pipeline";

describe("HoidPipeline provider context isolation", () => {
  it("gives contextual providers a detached copy of authorized metadata", async () => {
    const knowledge = [{
      id: "safe-entry",
      aliases: ["SAFE_ALIAS"],
      kind: "concept" as const,
      firstSafeAppearance: { bookId: "book-safe", chapter: 1 },
      summary: "Metadata-only summary",
    }];

    const provider: ContextualHoidProvider = {
      answer: async () => "respuesta segura",
      answerWithContext: async (_request, context) => {
        context[0].aliases[0] = "MUTATED";
        context[0].firstSafeAppearance.chapter = 999;
        context[0].summary = "changed";
        return "respuesta segura";
      },
    };

    const result = await new HoidPipeline(provider, knowledge).answer({
      question: "Pregunta segura",
      reading: [{ bookId: "book-safe", chapter: 1 }],
    });

    expect(result.blocked).toBe(false);
    expect(knowledge[0].aliases).toEqual(["SAFE_ALIAS"]);
    expect(knowledge[0].firstSafeAppearance.chapter).toBe(1);
    expect(knowledge[0].summary).toBe("Metadata-only summary");
  });
});
