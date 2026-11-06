import { HoidPipeline } from "./pipeline";
import { HoidProvider } from "./types";

describe("HoidPipeline provider timeout", () => {
  it("fails closed when the provider does not answer before the configured deadline", async () => {
    const provider: HoidProvider = {
      answer: jest.fn(() => new Promise<string>(() => undefined)),
    };

    const result = await new HoidPipeline(provider, [], 5).answer({
      question: "Pregunta segura",
      reading: [],
    });

    expect(result.blocked).toBe(false);
    expect(result.reason).toBe("provider-unavailable");
    expect(result.text).toContain("no está disponible a tiempo");
  });

  it("still accepts a provider response that arrives before the deadline", async () => {
    const provider: HoidProvider = { answer: jest.fn(async () => "Respuesta segura") };

    const result = await new HoidPipeline(provider, [], 100).answer({
      question: "Pregunta segura",
      reading: [],
    });

    expect(result.blocked).toBe(false);
    expect(result.text).toBe("Respuesta segura");
  });
});
