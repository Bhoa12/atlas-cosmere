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

  it("does not let a timed-out provider mutate the request snapshot used by Hoid", async () => {
    let capturedRequest: any;
    const provider: HoidProvider = {
      answer: jest.fn((request) => {
        capturedRequest = request;
        return new Promise<string>(() => undefined);
      }),
    };

    const reading = [{ bookId: "book", chapter: 1 }];
    const request = { question: "Pregunta segura", reading };

    const pending = new HoidPipeline(provider, [], 5).answer(request);
    request.question = "Pregunta mutada";
    reading[0].chapter = 99;

    await pending;

    expect(capturedRequest.question).toBe("Pregunta segura");
    expect(capturedRequest.reading[0].chapter).toBe(1);
  });
});
