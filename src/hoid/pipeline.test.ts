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
});
