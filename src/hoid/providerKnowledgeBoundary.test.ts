import { HoidPipeline } from "./pipeline";
import { HoidProvider } from "./types";

describe("Hoid provider boundary", () => {
  it("never forwards caller-supplied knowledgeContext to a provider", async () => {
    const provider: HoidProvider = {
      answer: jest.fn(async (request) => {
        expect(request.knowledgeContext).toBeUndefined();
        return "Respuesta segura";
      }),
    };

    const result = await new HoidPipeline(provider, []).answer({
      question: "Pregunta segura",
      reading: [],
      knowledgeContext: [{
        id: "untrusted",
        kind: "event",
        source: { bookId: "unknown", chapter: 999 },
        summary: "Contenido que no ha sido autorizado por el catálogo.",
      }],
    });

    expect(result.blocked).toBe(false);
    expect(provider.answer).toHaveBeenCalledTimes(1);
  });
});
